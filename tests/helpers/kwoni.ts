// 권이 저수지 공통 입력 (tests/fixtures/kwoni-report.json → 엔진 타입). 근거: CLAUDE.md 6절
import kwoni from "@/tests/fixtures/kwoni-report.json";
import pohang from "@/data/rainfall/annual-max/138.json";
import huffFile from "@/data/huff/khas-q3.json";
import { DEFAULT_SPILLWAY_COEFFICIENT } from "@/lib/run";
import type { AnnualMaxFile, PublicSpec, RunOptions, UserInputs } from "@/lib/types";

export { kwoni };
export const huff = huffFile;
export const annualMax = pohang as unknown as AnnualMaxFile;

/** 상대오차(%) */
export const pct = (a: number, b: number) => (a / b - 1) * 100;

// 자동값(제원) — 제체형식은 제원 2026판 '필댐(존형)'
export const spec: PublicSpec = {
  code: kwoni.code,
  name: kwoni.name,
  catchmentHa: kwoni.spec.catchment_ha,
  fullLevelElM: kwoni.spec.fullLevel_el,
  floodLevelElM: kwoni.spec.floodLevel_el,
  deadLevelElM: kwoni.spec.deadLevel_el,
  totalStorageThousandM3: kwoni.spec.totalStorage_thm3,
  fullAreaHa: kwoni.spec.fullArea_ha,
  damType: "필댐(존형)",
  floodFreqYr: 100,
  asOf: "2026-09-07",
};

const gate = kwoni.inputs.emergencyGate;
export const storageTable = kwoni.storageTable.map((p) => ({ levelElM: p.level_el, storageM3: p.storage_m3 }));

/** 보고서 입력값 + 설계 내용적표. 비상수문 C는 CLAUDE.md에 없어 기본 2.0 (calc-rules 7-11) */
export const inputs: UserInputs = {
  spillway: { widthM: kwoni.inputs.spillway.width_m, crestElM: kwoni.inputs.spillway.crest_el, coefficient: kwoni.inputs.spillway.coefficient },
  extraOutlets: [{ name: "비상수문", widthM: gate.width_m, crestElM: gate.crest_el, coefficient: gate.coefficient ?? DEFAULT_SPILLWAY_COEFFICIENT, open: gate.open }],
  damCrestElM: kwoni.inputs.damCrest_el,
  cn: { amc: "III", value: kwoni.inputs.cn.value },
  timing: { tcHr: kwoni.inputs.tc_hr, kHr: kwoni.inputs.k_hr },
  storageTable,
};

/** 같은 입력에서 설계표를 뺀 것 (제원 근사 곡선) */
export const inputsSpecCurve: UserInputs = { ...inputs, storageTable: undefined };

const st = kwoni.inputs.station;
/** 보고서 확률강우량을 그대로 넣는 옵션 */
export const optionsReport: RunOptions = {
  returnPeriodYr: 200,
  stationCode: st.code,
  firstYear: st.firstYear,
  lastYear: st.lastYear,
  timeConvention: "khas",
  huff: "khas-q3",
  tcKMethod: "direct",
  rainfallOverrideMm: kwoni.check1_probableRainfall200.rainfall_mm,
};

/** 포항 자료로 확률강우량을 계산하는 옵션 */
export const optionsStation = (timeConvention: "khas" | "actual", firstYear = st.firstYear, lastYear = st.lastYear): RunOptions => ({
  ...optionsReport,
  rainfallOverrideMm: undefined,
  timeConvention,
  firstYear,
  lastYear,
});
