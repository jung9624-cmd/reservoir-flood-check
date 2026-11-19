// 단위 변환. 변환 상수는 이 파일에만 둔다. 근거: CLAUDE.md 5.3, 5-12, docs/calc-rules.md 6절

const M2_PER_HA = 10_000;
const HA_PER_KM2 = 100;
const M3_PER_THOUSAND_M3 = 1_000;
const MIN_PER_HR = 60;
const SEC_PER_MIN = 60;

/** ha → km² */
export const haToKm2 = (ha: number): number => ha / HA_PER_KM2;

/** km² → ha */
export const km2ToHa = (km2: number): number => km2 * HA_PER_KM2;

/** ha → m² */
export const haToM2 = (ha: number): number => ha * M2_PER_HA;

/** 천m³ → m³ */
export const thousandM3ToM3 = (thm3: number): number => thm3 * M3_PER_THOUSAND_M3;

/** m³ → 천m³ */
export const m3ToThousandM3 = (m3: number): number => m3 / M3_PER_THOUSAND_M3;

/** 시간 → 분 */
export const hrToMin = (hr: number): number => hr * MIN_PER_HR;

/** 분 → 시간 */
export const minToHr = (min: number): number => min / MIN_PER_HR;

/** 분 → 초 */
export const minToSec = (min: number): number => min * SEC_PER_MIN;

/**
 * Δt분 동안의 유효우량 깊이(mm) → 평균 유량(m³/s).
 * Q = P[mm] × A[km²] / (0.06 × Δt[분])  (CLAUDE.md 5-12)
 * 1 mm × 1 km² = 1,000 m³, Δt분 = 60Δt초 → 1,000 / 60 = 1 / 0.06
 */
export const depthMmToFlowCms = (depthMm: number, areaKm2: number, dtMin: number): number =>
  (depthMm * areaKm2) / (0.06 * dtMin);

/** 유량(m³/s)이 Δt분 동안 흐른 체적(m³) */
export const flowCmsToVolumeM3 = (flowCms: number, dtMin: number): number => flowCms * minToSec(dtMin);

/** 비율(0~1) → % */
export const fractionToPct = (f: number): number => f * 100;

/** km² 기준값 (판정 안내) */
export const FLOOD_CONTROL_CATCHMENT_KM2 = 5; // 유역 5 km² 이하 → 홍수조절 미고려 대상 (CLAUDE.md 5.4)
export const AREA_REDUCTION_CATCHMENT_KM2 = 25.9; // 면적감소계수 대상 (CLAUDE.md 5-2)
