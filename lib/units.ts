// 단위 변환. 근거: CLAUDE.md 5.3, 5-12, docs/calc-rules.md 6절

/** ha → km² */
export const haToKm2 = (ha: number): number => ha / 100;

/** km² → ha */
export const km2ToHa = (km2: number): number => km2 * 100;

/** ha → m² */
export const haToM2 = (ha: number): number => ha * 10_000;

/** 천m³ → m³ */
export const thousandM3ToM3 = (thm3: number): number => thm3 * 1_000;

/** 시간 → 분 */
export const hrToMin = (hr: number): number => hr * 60;

/** 분 → 시간 */
export const minToHr = (min: number): number => min / 60;

/** 분 → 초 */
export const minToSec = (min: number): number => min * 60;
