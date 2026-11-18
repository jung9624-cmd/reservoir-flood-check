// CN, NRCS 유효우량, Clark 단위도. 근거: CLAUDE.md 5-4, 5.2, 5-6, 5-12
import type { TimeSeries } from "./types";
import { notImplemented } from "./not-implemented";

/** CN-Ⅱ → CN-Ⅲ */
export function cn2ToCn3(cn2: number): number {
  void cn2;
  return notImplemented("cn2ToCn3");
}

/** NRCS-CN 유효우량 (Ia = 0.2S) */
export function effectiveRainfall(rain: TimeSeries, cn3: number): TimeSeries {
  void rain; void cn3;
  return notImplemented("effectiveRainfall");
}

/** 서경대 공식 Tc·K (hr) */
export function seokyeongTcK(channelLength_km: number, farthestPointElevation_el: number, catchment_km2: number): { tc_hr: number; k_hr: number } {
  void channelLength_km; void farthestPointElevation_el; void catchment_km2;
  return notImplemented("seokyeongTcK");
}

/** Clark 단위도로 직접유출 수문곡선 (m³/s) */
export function clarkHydrograph(effective: TimeSeries, catchment_km2: number, tc_hr: number, k_hr: number): TimeSeries {
  void effective; void catchment_km2; void tc_hr; void k_hr;
  return notImplemented("clarkHydrograph");
}
