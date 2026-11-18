// 환산계수, Gumbel(PWM), 확률강우량. 근거: CLAUDE.md 5.1, docs/calc-rules.md 2절
import type { AnnualMaxTable } from "./types";
import { notImplemented } from "./not-implemented";

/** 고정시간 → 임의시간 환산계수 (X = 지속기간, 시간) */
export function conversionFactor(duration_hr: number): number {
  void duration_hr;
  return notImplemented("conversionFactor");
}

export interface GumbelFit {
  alpha: number;
  xi: number;
}

/** Gumbel 확률가중모멘트법 */
export function gumbelPwm(sample_mm: number[]): GumbelFit {
  void sample_mm;
  return notImplemented("gumbelPwm");
}

/** 재현기간 T의 확률값 */
export function gumbelQuantile(fit: GumbelFit, returnPeriod_yr: number): number {
  void fit; void returnPeriod_yr;
  return notImplemented("gumbelQuantile");
}

/** 지속기간별 확률강우량 (mm) */
export function probableRainfall(table: AnnualMaxTable, durationsHr: number[], returnPeriod_yr: number): number[] {
  void table; void durationsHr; void returnPeriod_yr;
  return notImplemented("probableRainfall");
}
