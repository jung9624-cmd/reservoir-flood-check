// 방류시설과 수정 Puls 홍수추적. 근거: CLAUDE.md 5-9
import type { TimeSeries } from "./types";
import type { StorageCurve } from "./storage";
import { notImplemented } from "./not-implemented";

export interface Outlet {
  width_m: number;
  crest_el: number;
  coefficient: number;
}

/** Σ C·L·max(0, h − 마루)^1.5 */
export function outflow(level_el: number, outlets: Outlet[]): number {
  void level_el; void outlets;
  return notImplemented("outflow");
}

export interface RoutingResult {
  outflow: TimeSeries; // m³/s, 1분
  level: TimeSeries; // EL.m, 1분
}

export function modifiedPuls(inflow: TimeSeries, curve: StorageCurve, outlets: Outlet[], initialLevel_el: number): RoutingResult {
  void inflow; void curve; void outlets; void initialLevel_el;
  return notImplemented("modifiedPuls");
}
