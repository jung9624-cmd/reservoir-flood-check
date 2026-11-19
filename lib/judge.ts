// 임계지속기간, 여유고 판정, 홍수조절 미고려 안내. 근거: CLAUDE.md 5-10, 5.4, docs/calc-rules.md 1-12·13, 7-6·8
import type { DurationResult, Verdict } from "./types";
import { FLOOD_CONTROL_CATCHMENT_KM2 } from "./units";

/** 필댐, 게이트 없음 (CLAUDE.md 5.4) */
export const REQUIRED_FREEBOARD_M = 2.0;

/** 최고수위가 가장 높은 지속기간 (최대 유입량 기준이 아님). 같으면 짧은 쪽 */
export function criticalDuration<T extends Pick<DurationResult, "durationMin" | "maxLevelElM">>(results: readonly T[]): T {
  if (results.length === 0) throw new RangeError("criticalDuration: 결과가 없습니다");
  return results.reduce((best, r) => (r.maxLevelElM > best.maxLevelElM ? r : best));
}

/** 유역 ≤ 5 km² 또는 Tc < 1 hr → 홍수조절 미고려 대상(제5편 8.2.1) */
export function isFloodControlNotConsidered(catchmentKm2: number, tcHr: number): boolean {
  return catchmentKm2 <= FLOOD_CONTROL_CATCHMENT_KM2 || tcHr < 1;
}

/** 반올림 단위 step(m)로 반올림. step ≤ 0이면 그대로 */
export function roundTo(x: number, step: number): number {
  if (!(step > 0)) return x;
  const k = 1 / step; // 0.01 → 100: 167.104 × 100 → 16710 / 100 = 167.1 (부동소수 오차 없이)
  return Math.round(x * k) / k;
}

const EPS = 1e-9; // 부동소수 비교 여유 (169.10 − 167.10 = 1.99999…)

/**
 * 여유고 = 제정표고 − 최고수위 ≥ 2.0 m → 적합.
 * 최고수위는 levelRoundingM 단위로 반올림한 뒤 비교한다(기본 0.01 m, 보고서 표기 자릿수. 확인 필요 calc-rules 7-6).
 */
export function judge(
  results: readonly DurationResult[],
  damCrestElM: number,
  catchmentKm2: number,
  tcHr: number,
  levelRoundingM = 0.01,
): Verdict {
  const c = criticalDuration(results);
  const rounded = roundTo(c.maxLevelElM, levelRoundingM);
  const freeboard = damCrestElM - rounded;
  const pass = freeboard >= REQUIRED_FREEBOARD_M - EPS;
  const passRaw = damCrestElM - c.maxLevelElM >= REQUIRED_FREEBOARD_M - EPS;
  return {
    criticalDurationMin: c.durationMin,
    maxLevelElM: c.maxLevelElM,
    maxLevelRoundedElM: rounded,
    damCrestElM,
    freeboardM: freeboard,
    requiredM: REQUIRED_FREEBOARD_M,
    pass,
    boundaryCase: pass !== passRaw,
    floodControlNotConsidered: isFloodControlNotConsidered(catchmentKm2, tcHr),
  };
}
