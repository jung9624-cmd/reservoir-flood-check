// Huff 시간분포 → Δt(기본 10분) 강우. 근거: CLAUDE.md 5-3, data/huff/khas-q3.json, docs/calc-rules.md 3절
// 누가곡선은 k has.xlsx 1 % 간격 표를 선형보간한다. 표 합계(100.00004 %)로 나눠 총량을 P_D에 맞춘다.
// (10 % 점을 보간하면 권이 Clark 첨두가 보고서보다 1~3 % 작다. 1 % 표는 +0.03 % 이내, 60·120분)
import type { HuffFile, TimeSeries } from "./types";
import { fractionToPct } from "./units";

/** 정렬된 xs에서 선형보간 */
export function interpLinear(x: number, xs: readonly number[], ys: readonly number[]): number {
  if (x <= xs[0]) return ys[0];
  const last = xs.length - 1;
  if (x >= xs[last]) return ys[last];
  let lo = 0;
  let hi = last;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (xs[mid] <= x) lo = mid;
    else hi = mid;
  }
  const t = (x - xs[lo]) / (xs[hi] - xs[lo]);
  return ys[lo] + t * (ys[hi] - ys[lo]);
}

/** 총강우 P_D(mm)를 지속기간 D(분) 동안 Δt 간격으로 나눈다. 구간 k = (C(k+1)/n − C(k/n)) × P_D */
export function huffHyetograph(totalMm: number, durationMin: number, huff: Pick<HuffFile, "timePct" | "cumulativePct">, dtMin = 10): TimeSeries {
  const n = Math.round(durationMin / dtMin);
  if (n < 1 || Math.abs(n * dtMin - durationMin) > 1e-9) {
    throw new RangeError(`huffHyetograph: 지속기간 ${durationMin}분이 Δt ${dtMin}분의 배수가 아닙니다`);
  }
  const total = huff.cumulativePct[huff.cumulativePct.length - 1];
  const cum = (k: number) => interpLinear(fractionToPct(k / n), huff.timePct, huff.cumulativePct) / total;
  const values: number[] = [];
  for (let k = 0; k < n; k++) values.push((cum(k + 1) - cum(k)) * totalMm);
  return { dtMin, values };
}
