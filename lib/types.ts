// 공통 타입. 단위는 이름 끝에 붙인다(_ha, _km2, _m3, _thm3 = 천m³, _el = EL.m, _hr, _min, _mm, _cms = m³/s).
// 근거: CLAUDE.md 3~5절, docs/calc-rules.md

/** 값 옆에 붙이는 출처 표시 (CLAUDE.md 4절: "자동(출처)" 또는 "입력") */
export type ValueSource =
  | { kind: "auto"; source: string }
  | { kind: "input" };

/** 제원 플래그 (값은 고치지 않고 표시만, scripts/preprocess.py A) */
export type SpecFlag =
  | "floodLevelNotAboveFull" // 홍수위 ≤ 만수위
  | "fullLevelNotAboveDead" // 만수위 ≤ 사수위
  | "zeroLevel"
  | "negativeDeadLevel"
  | "zeroCatchment"
  | "zeroFullArea"
  | "zeroFloodArea"
  | "effectiveExceedsTotal"
  | "storageSumMismatch" // 총 ≠ 유효 + 사수 (1 % 초과)
  | "zeroDamHeight"
  | "zeroDamLength"
  | "zeroFloodFreq"
  | "missingGrade";

/** 저수지 제원 (공공데이터포털 15044339) — data/reservoirs.json의 reservoirs[] */
export interface ReservoirSpec {
  code: string; // 표준코드 10자리 (문자열로 다룬다)
  hq: string | null; // 본부
  branch: string | null; // 지사
  name: string; // 시설명 (중복 있음, 키로 쓰지 않음)
  address: string | null; // 소재지 (리·동까지)
  startDate: string | null; // 착공년도
  completeDate: string | null; // 준공년도
  grade: string | null; // 종별
  category: string | null; // 구분
  catchmentHa: number | null; // 유역면적
  floodAreaHa: number | null; // 홍수면적
  fullAreaHa: number | null; // 만수면적
  benefitAreaHa: number | null; // 수혜면적
  droughtFreqYr: number | null; // 한발빈도
  floodFreqYr: number | null; // 홍수빈도
  damType: string | null; // 제체형식
  damLengthM: number | null; // 제체길이
  damHeightM: number | null; // 제체높이
  totalStorageThousandM3: number | null; // 총저수량 (천m³)
  effectiveStorageThousandM3: number | null; // 유효저수량 (천m³)
  deadStorageThousandM3: number | null; // 사수량 (천m³)
  intakeType: string | null; // 취수형식
  floodLevelElM: number | null; // 홍수위
  fullLevelElM: number | null; // 만수위
  deadLevelElM: number | null; // 사수위
  contact: string | null; // 연락처
  flags: SpecFlag[];
}

/** data/reservoirs.json */
export interface ReservoirsFile {
  source: string;
  asOf: string; // 제원 기준일 (화면 표시, CLAUDE.md 3.1)
  count: number;
  flagCounts: Partial<Record<SpecFlag, number>>;
  reservoirs: ReservoirSpec[];
}

/** 저수지 위치 — data/coords.json의 coords[] */
export type ReservoirCoord =
  | { code: string; lat: number; lon: number; source: "safetydata"; decimals: number; precisionM: number }
  | { code: string; lat: number; lon: number; source: "approx"; approxLevel: string; approxQuery: string } // 위치 근사
  | { code: string; lat: null; lon: null; source: "none" };

/** 2025 홍수기 저수율 — data/storage-2025.json의 items[] */
export interface StorageRate2025 {
  code: string;
  floodSeasonMeanPct: number | null;
  floodSeasonMaxPct: number | null;
  matchedBy: "name+address" | "name+last2" | "name+effective";
}

/** ASOS 관측소 — data/stations.json의 stations[] */
export interface Station {
  code: string; // 3자리 문자열 (예: "138")
  name: string;
  lat: number;
  lon: number;
  firstYear: number | null;
  lastYear: number | null;
  nYears: number;
}

/** 한 시각 배치의 고정시간 연최대 */
export interface AnnualMaxTable {
  years: number[];
  valuesMm: number[][]; // [해][지속기간]
  blankHours: number[];
  dataHours: number[];
}

/** data/rainfall/annual-max/<관측소>.json */
export interface AnnualMaxFile {
  station: string;
  durationsHr: number[]; // 1, 2, 3, 4, 6, 9, 12, 15, 18, 24
  actual: AnnualMaxTable; // 실제 시각 (기본)
  khas: AnnualMaxTable; // K-HAS 방식 (검증용)
}

/** data/huff/khas-q3.json */
export interface HuffFile {
  source: string;
  timePct: number[]; // 0~100
  incrementPct: number[];
  cumulativePct: number[];
  sumPct: number;
}

/** 추가 방류시설 (선택) */
export interface ExtraOutlet {
  width_m: number;
  crest_el: number; // 마루(바닥)표고
  coefficient: number; // 유량계수
  open: boolean;
}

/** 사용자 입력값 6가지 (CLAUDE.md 4절) */
export interface UserInputs {
  spillwayWidth_m: number; // 1. 물넘이 폭
  spillwayCrest_el: number; // 2. 물넘이 마루표고 (기본 = 만수위)
  spillwayCoefficient: number; // 물넘이 유량계수 (기본 2.0)
  extraOutlet: ExtraOutlet | null; // 3. 추가 방류시설
  damCrest_el: number; // 4. 제정표고
  cn: { amc: "II" | "III"; value: number }; // 5. CN
  timing: // 6. Tc·K
    | { mode: "direct"; tc_hr: number; k_hr: number }
    | { mode: "seokyeong"; channelLength_km: number; farthestPointElevation_el: number };
}

/** 설계 내용적표 한 행 */
export interface StoragePoint {
  level_el: number;
  storage_m3: number;
}

/** 시계열 (등간격) */
export interface TimeSeries {
  dt_min: number;
  values: number[];
}

/** 지속기간 하나의 계산 결과 */
export interface DurationResult {
  duration_min: number;
  rainfall_mm: number;
  peakInflow_cms: number; // × 1.2 적용 후
  peakOutflow_cms: number;
  maxLevel_el: number;
}

/** 여유고 판정 (화면에는 적합/부적합만 표시) */
export interface Verdict {
  criticalDuration_min: number;
  maxLevel_el: number;
  freeboard_m: number;
  required_m: number; // 2.0
  pass: boolean; // 적합
  floodControlNotConsidered: boolean; // 유역 ≤ 5 km² 또는 Tc < 1 hr
}

/** 지속기간 10개 (분) — CLAUDE.md 5-10 */
export const DURATIONS_MIN = [60, 120, 180, 240, 360, 540, 720, 900, 1080, 1440] as const;
