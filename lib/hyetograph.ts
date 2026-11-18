// Huff 3분위 시간분포. 근거: CLAUDE.md 5-3, data/huff/khas-q3.json
import type { TimeSeries } from "./types";
import { notImplemented } from "./not-implemented";

export function huffHyetograph(total_mm: number, duration_min: number, dt_min = 10): TimeSeries {
  void total_mm; void duration_min; void dt_min;
  return notImplemented("huffHyetograph");
}
