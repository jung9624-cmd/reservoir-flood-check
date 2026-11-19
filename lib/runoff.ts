// CN-Ⅱ→Ⅲ, NRCS 누가 유효우량, Clark 단위도(시간-면적 + 선형저수지), 할증.
// 근거: CLAUDE.md 5-4, 5.2, 5-6, 5-7, 5-12, docs/calc-rules.md 3·4절
import type { TimeSeries } from "./types";
import { depthMmToFlowCms, hrToMin } from "./units";

/** CN-Ⅲ = 23·CNⅡ / (10 + 0.13·CNⅡ) */
export function cn2ToCn3(cn2: number): number {
  return (23 * cn2) / (10 + 0.13 * cn2);
}

/** 최대잠재보유수량 S (mm) = 25400/CN − 254 (calc-rules 3: Reference에 원문 없음, 표준 NRCS 식) */
export function potentialRetentionMm(cn: number): number {
  return 25400 / cn - 254;
}

/** 누가 유효우량 Q(P) = (P − Ia)² / (P − Ia + S), P > Ia. Ia = 0.2S */
export function cumulativeRunoffMm(cumRainMm: number, cn: number): number {
  const s = potentialRetentionMm(cn);
  const ia = 0.2 * s;
  return cumRainMm > ia ? (cumRainMm - ia) ** 2 / (cumRainMm - ia + s) : 0;
}

/** 구간 유효우량 = 누가 유효우량의 차분 (calc-rules 3) */
export function effectiveRainfall(rain: TimeSeries, cn: number): TimeSeries {
  let cumP = 0;
  let prevQ = 0;
  const values = rain.values.map((p) => {
    cumP += p;
    const q = cumulativeRunoffMm(cumP, cn);
    const inc = q - prevQ;
    prevQ = q;
    return inc;
  });
  return { dtMin: rain.dtMin, values };
}

/**
 * 서경대 공식 (CLAUDE.md 5-6): Tc = 0.214·L·H^−0.144, K = α·(A/L²)^0.02·Tc
 * L: 유로연장(km), H: 최원점 표고(EL.m)를 그대로 넣는다, A: 유역(km²).
 * H의 정의(표고/표고차)와 α 선택 기준은 확인 필요 (calc-rules 4).
 */
export function seokyeongTcK(channelLengthKm: number, farthestPointElM: number, catchmentKm2: number, alpha: number): { tcHr: number; kHr: number } {
  const tcHr = 0.214 * channelLengthKm * farthestPointElM ** -0.144;
  const kHr = alpha * (catchmentKm2 / channelLengthKm ** 2) ** 0.02 * tcHr;
  return { tcHr, kHr };
}

/** 무차원 시간-면적 곡선 At/A (T = t/Tc) */
export function timeArea(t: number): number {
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  return t <= 0.5 ? 1.414 * t ** 1.5 : 1 - 1.414 * (1 - t) ** 1.5;
}

/** 구간 면적비 dA_k = TA((k+1)Δt/Tc) − TA(kΔt/Tc). Tc는 반올림하지 않는다 */
export function timeAreaIncrements(tcMin: number, dtMin: number): number[] {
  const n = Math.ceil(tcMin / dtMin - 1e-12);
  const out: number[] = [];
  for (let k = 0; k < n; k++) out.push(timeArea(((k + 1) * dtMin) / tcMin) - timeArea((k * dtMin) / tcMin));
  return out;
}

/**
 * Clark 직접유출 수문곡선 (m³/s). 값 i는 시각 i·Δt (i = 0에서 0).
 * 1) 이동: I(t) = Σ_k Pe(t−k) · dA_k · A / (0.06Δt)
 * 2) 선형저수지: O_i = CA·(I_i + I_(i−1))/2 + (1 − CA)·O_(i−1), CA = Δt/(K + 0.5Δt)
 *    평균유입 형태 (HEC-1 형). 권이에서 보고서 표 3.13과 +0.03 % (60분), I_i 하나만 쓰면 +7.9 %
 * 3) 꼬리: O가 첨두의 1e-6 아래로 내려갈 때까지 (최대 Δt × 20,000)
 */
export function clarkHydrograph(effective: TimeSeries, catchmentKm2: number, tcHr: number, kHr: number): TimeSeries {
  const dt = effective.dtMin;
  const dA = timeAreaIncrements(hrToMin(tcHr), dt);
  const kMin = hrToMin(kHr);
  const nIn = effective.values.length + dA.length - 1;
  const inflow: number[] = [0];
  for (let j = 0; j < nIn; j++) {
    let s = 0;
    for (let k = 0; k < dA.length; k++) {
      const i = j - k;
      if (i >= 0 && i < effective.values.length) s += effective.values[i] * dA[k];
    }
    inflow.push(depthMmToFlowCms(s, catchmentKm2, dt));
  }
  const ca = dt / (kMin + 0.5 * dt);
  const out: number[] = [0];
  let peak = 0;
  for (let i = 1; i < 20_000; i++) {
    const iNow = inflow[i] ?? 0;
    const iPrev = inflow[i - 1] ?? 0;
    const o = ca * 0.5 * (iNow + iPrev) + (1 - ca) * out[i - 1];
    out.push(o);
    peak = Math.max(peak, o);
    if (i >= inflow.length && Math.abs(o) <= peak * 1e-6) break; // <= : 무강우(첨두 0)에서도 끝난다
  }
  return { dtMin: dt, values: out };
}

/** 설계홍수량 할증: 필댐이면 수문곡선 전체 × 1.2 (CLAUDE.md 5-7) */
export const FILL_DAM_FACTOR = 1.2;

export function isFillDam(damType: string | null): boolean {
  return damType !== null && damType.startsWith("필댐");
}

export function scaleSeries(s: TimeSeries, factor: number): TimeSeries {
  return { dtMin: s.dtMin, values: s.values.map((v) => v * factor) };
}
