// 임계지속기간, 여유고 판정. 근거: CLAUDE.md 5-10, 5.4
import type { DurationResult, Verdict } from "./types";
import { notImplemented } from "./not-implemented";

export const REQUIRED_FREEBOARD_M = 2.0;

export function judge(results: DurationResult[], damCrest_el: number, catchment_km2: number, tc_hr: number): Verdict {
  void results; void damCrest_el; void catchment_km2; void tc_hr;
  return notImplemented("judge");
}
