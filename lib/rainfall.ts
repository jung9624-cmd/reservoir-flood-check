// 확률강우량: 고정시간 연최대 × 환산계수 → Gumbel(PWM) → T년 값.
// 근거: CLAUDE.md 5.1, docs/calc-rules.md 2절, ../Reference/04_스크립트/khas_freq.py (conv, gumbel_pwm)
import type { AnnualMaxFile, ProbableRainfall, TimeConvention } from "./types";
import { hrToMin } from "./units";

/** Euler 상수(Gumbel 평균 보정). khas_freq.py와 같이 0.5772를 쓴다 */
const EULER = 0.5772;

/** 고정시간 → 임의시간 환산계수 Y = 0.1346·X^−1.417 + 1.0014 (X = 지속기간, 시간) */
export function conversionFactor(durationHr: number): number {
  return 0.1346 * durationHr ** -1.417 + 1.0014;
}

export interface GumbelFit {
  alpha: number; // 척도
  xi: number; // 위치
  b0: number;
  b1: number;
  n: number;
}

/**
 * Gumbel 확률가중모멘트법 (오름차순 x(1) ≤ … ≤ x(n))
 * b0 = 평균, b1 = Σ (i−1)/(n−1) · x(i) / n, α = (2b1 − b0)/ln2, ξ = b0 − 0.5772α
 */
export function gumbelPwm(sample: readonly number[]): GumbelFit {
  const x = [...sample].sort((a, b) => a - b);
  const n = x.length;
  if (n < 2) throw new RangeError("gumbelPwm: 표본이 2개 이상이어야 합니다");
  const b0 = x.reduce((s, v) => s + v, 0) / n;
  let b1 = 0;
  for (let i = 0; i < n; i++) b1 += (i / (n - 1)) * x[i]; // i는 0부터 → (i−1)
  b1 /= n;
  const alpha = (2 * b1 - b0) / Math.LN2;
  const xi = b0 - EULER * alpha;
  return { alpha, xi, b0, b1, n };
}

/** x_T = ξ − α · ln(−ln(1 − 1/T)) */
export function gumbelQuantile(fit: Pick<GumbelFit, "alpha" | "xi">, returnPeriodYr: number): number {
  return fit.xi - fit.alpha * Math.log(-Math.log(1 - 1 / returnPeriodYr));
}

export interface ProbableRainfallOptions {
  timeConvention: TimeConvention;
  firstYear: number;
  lastYear: number;
  returnPeriodYr: number;
}

/** 지속기간별 T년 확률강우량 (mm). 자료기간 [firstYear, lastYear]의 해만 쓴다 */
export function probableRainfall(file: AnnualMaxFile, opt: ProbableRainfallOptions): ProbableRainfall {
  const table = file[opt.timeConvention];
  const rows: number[] = [];
  table.years.forEach((y, i) => {
    if (y >= opt.firstYear && y <= opt.lastYear) rows.push(i);
  });
  const durationMin: number[] = [];
  const factor: number[] = [];
  const rainfallMm: number[] = [];
  file.durationsHr.forEach((dHr, j) => {
    const y = conversionFactor(dHr);
    const sample = rows.map((i) => table.valuesMm[i][j] * y);
    durationMin.push(hrToMin(dHr));
    factor.push(y);
    rainfallMm.push(gumbelQuantile(gumbelPwm(sample), opt.returnPeriodYr));
  });
  return {
    durationMin,
    conversionFactor: factor,
    rainfallMm,
    nYears: rows.length,
    source: {
      kind: "auto",
      source: `ASOS ${file.station} 시간강우 ${opt.firstYear}~${opt.lastYear} (${rows.length}년), ${
        opt.timeConvention === "khas" ? "K-HAS 방식" : "실제 시각"
      }, Gumbel PWM`,
    },
  };
}
