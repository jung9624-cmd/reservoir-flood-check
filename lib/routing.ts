// 방류량과 수정 Puls 홍수추적. 근거: CLAUDE.md 5-9, 5-12, docs/calc-rules.md 5.2·5.3
import type { Outlet, TimeSeries } from "./types";
import type { StorageCurve } from "./storage";
import { interpLinear } from "./hyetograph";
import { flowCmsToVolumeM3 } from "./units";

/** O(h) = Σ C·L·max(0, h − 마루)^1.5, 열린 시설만 */
export function outflowCms(levelElM: number, outlets: readonly Outlet[]): number {
  let q = 0;
  for (const o of outlets) {
    if (!o.open) continue;
    const head = levelElM - o.crestElM;
    if (head > 0) q += o.coefficient * o.widthM * head ** 1.5;
  }
  return q;
}

/** 등간격 시계열을 더 촘촘한 간격으로 선형보간 (보간 방법 확인 필요, calc-rules 5.3) */
export function resample(s: TimeSeries, dtMin: number): TimeSeries {
  const xs = s.values.map((_, i) => i * s.dtMin);
  const end = xs[xs.length - 1];
  const values: number[] = [];
  for (let t = 0; t <= end + 1e-9; t += dtMin) values.push(interpLinear(t, xs, s.values));
  return { dtMin, values };
}

export interface RoutingOptions {
  dtMin?: number; // 추적 간격, 기본 1분
  tolM?: number; // 이분법 수위 허용, 기본 1e-6 m
  maxIter?: number; // 이분법 최대 반복, 기본 100
  extraMin?: number; // 유입이 끝난 뒤 더 추적할 시간, 기본 60분
}

export interface RoutingResult {
  outflowCms: TimeSeries;
  levelElM: TimeSeries;
  peakOutflowCms: number;
  maxLevelElM: number;
  maxStorageM3: number;
  timeOfMaxLevelMin: number;
  initialOutflowCms: number;
}

/**
 * 수정 Puls: (I_i + I_(i+1))/2·Δt + S_i − O_i·Δt/2 = S_(i+1) + O_(i+1)·Δt/2.
 * 오른쪽을 h_(i+1)의 함수로 보고 이분법(수위 tolM 또는 maxIter회)으로 푼다.
 * 초기 수위의 방류량(열린 시설)은 처음부터 흐른다.
 */
export function modifiedPuls(
  inflow: TimeSeries,
  curve: StorageCurve,
  outlets: readonly Outlet[],
  initialLevelElM: number,
  opt: RoutingOptions = {},
): RoutingResult {
  const dtMin = opt.dtMin ?? 1;
  const tol = opt.tolM ?? 1e-6;
  const maxIter = opt.maxIter ?? 100;
  const extra = Math.round((opt.extraMin ?? 60) / dtMin);
  const fine = resample(inflow, dtMin).values;
  for (let i = 0; i < extra; i++) fine.push(0);

  const half = (q: number) => flowCmsToVolumeM3(q, dtMin) / 2;
  const f = (h: number) => curve.storageAt(h) + half(outflowCms(h, outlets));

  let h = initialLevelElM;
  let o = outflowCms(h, outlets);
  const levels = [h];
  const outs = [o];
  let peakO = o;
  let maxH = h;
  let tMax = 0;
  let hiGuess = Math.max(h, curve.minLevelElM) + 1;

  for (let i = 0; i < fine.length - 1; i++) {
    const rhs = flowCmsToVolumeM3((fine[i] + fine[i + 1]) / 2, dtMin) + curve.storageAt(h) - half(o);
    let lo = curve.minLevelElM;
    let hi = Math.max(hiGuess, h + 1);
    while (f(hi) < rhs) hi += (hi - lo) || 1; // 위로 넓힌다
    if (f(lo) >= rhs) {
      h = lo;
    } else {
      for (let k = 0; k < maxIter && hi - lo > tol; k++) {
        const mid = (lo + hi) / 2;
        if (f(mid) > rhs) hi = mid;
        else lo = mid;
      }
      h = (lo + hi) / 2;
    }
    hiGuess = h + 1;
    o = outflowCms(h, outlets);
    levels.push(h);
    outs.push(o);
    if (o > peakO) peakO = o;
    if (h > maxH) {
      maxH = h;
      tMax = (i + 1) * dtMin;
    }
  }
  return {
    outflowCms: { dtMin, values: outs },
    levelElM: { dtMin, values: levels },
    peakOutflowCms: peakO,
    maxLevelElM: maxH,
    maxStorageM3: curve.storageAt(maxH),
    timeOfMaxLevelMin: tMax,
    initialOutflowCms: outs[0],
  };
}
