// 공통 타입. 숫자 필드는 이름 끝에 단위를 붙인다(Ha, Km2, M, M3, ThousandM3 = 천m³, ElM = EL.m, Hr, Min, Mm, Cms = m³/s, Pct, Yr).
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

// ---------------------------------------------------------------------------
// 계산 엔진 (lib/*.ts) 입력·출력
// ---------------------------------------------------------------------------

/** 제원에서 온 값 (공공데이터포털 15044339). 계산에 쓰는 것만 */
export interface PublicSpec {
  code: string;
  name: string;
  catchmentHa: number | null;
  fullLevelElM: number | null; // 만수위
  floodLevelElM: number | null; // 홍수위 (표시·비교용, 계산에는 쓰지 않음)
  deadLevelElM: number | null; // 사수위
  totalStorageThousandM3: number | null; // 총저수량
  fullAreaHa: number | null; // 만수면적
  damType: string | null; // 제체형식 ("필댐(…)"이면 × 1.2)
  floodFreqYr: number | null; // 홍수빈도 (표시용)
  asOf: string; // 제원 기준일
}

/** 사용자가 제원 값 대신 넣을 수 있는 항목 (제원 값이 이상하거나 비어 있을 때) */
export type SpecOverrideField =
  | "catchmentHa"
  | "fullLevelElM"
  | "floodLevelElM"
  | "deadLevelElM"
  | "totalStorageThousandM3"
  | "fullAreaHa"
  | "damType";

/** 제원 대신 쓸 값. 넣은 항목만 바뀌고 출처는 "입력"이 된다 */
export type SpecOverrides = { [K in SpecOverrideField]?: NonNullable<PublicSpec[K]> };

/** 방류시설 하나: O = C·L·max(0, h − 마루)^1.5 */
export interface Outlet {
  name: string;
  widthM: number;
  crestElM: number; // 마루(바닥)표고
  coefficient: number; // 유량계수 C
  open: boolean;
}

/** 설계 내용적표 한 행 */
export interface StoragePoint {
  levelElM: number;
  storageM3: number;
}

/** Tc·K 입력. 방식은 RunOptions.tcKMethod로 고른다 */
export interface TimingInputs {
  tcHr?: number; // 직접 입력
  kHr?: number;
  channelLengthKm?: number; // 서경대 공식 L
  farthestPointElM?: number; // 서경대 공식 H (최원점 표고)
}

/** 사용자 입력값 6가지 (CLAUDE.md 4절) + 선택: 설계 내용적표 */
export interface UserInputs {
  spillway: {
    widthM: number; // 1. 물넘이 폭
    crestElM?: number; // 2. 물넘이 마루표고 (없으면 만수위)
    coefficient?: number; // 유량계수 (없으면 2.0)
  };
  extraOutlets: Outlet[]; // 3. 추가 방류시설 (없으면 [])
  damCrestElM: number; // 4. 제정표고
  cn: { amc: "II" | "III"; value: number }; // 5. CN
  timing: TimingInputs; // 6. Tc·K 또는 L·최원점 표고
  storageTable?: StoragePoint[]; // 있으면 제원 근사 대신 사용 (CLAUDE.md 5.3)
  specOverrides?: SpecOverrides; // 제원 값이 이상할 때 대신 쓸 값 (선택)
}

export type TimeConvention = "actual" | "khas";

/** 계산 옵션 */
export interface RunOptions {
  returnPeriodYr: number; // 기본 200
  stationCode: string; // ASOS 3자리
  firstYear: number; // 자료기간
  lastYear: number;
  timeConvention: TimeConvention; // 기본 actual, khas는 검증용
  huff: "khas-q3"; // Huff 3분위 (K-HAS)
  tcKMethod: "direct" | "seokyeong";
  seokyeongAlpha?: 1.45 | 1.2 | 1.7; // 서경대 K 식 α (어느 값을 쓸지 확인 필요, calc-rules 4)
  initialLevelElM?: number; // 없으면 만수위
  /** 지속기간 10개 확률강우량을 직접 넣을 때(예: 보고서 값). 있으면 연최대 자료를 쓰지 않는다 */
  rainfallOverrideMm?: number[];
  /** 여유고 비교 전 최고수위 반올림 단위(m). 기본 0.01 (calc-rules 7-6, 확인 필요). 0이면 반올림 안 함 */
  levelRoundingM?: number;
}

/** 값 하나와 그 출처 */
export interface Sourced<T> {
  value: T;
  source: ValueSource;
}

/** 입력 검사 결과 한 줄 (예외 대신 목록으로 돌려준다) */
export interface ValidationIssue {
  field: string;
  reason: string;
  /** 제원 값 문제면 그 항목. 이 값을 specOverrides로 넣으면 풀 수 있다 */
  specField?: SpecOverrideField;
}

/** 등간격 시계열 */
export interface TimeSeries {
  dtMin: number;
  values: number[];
}

/** 지속기간 하나의 계산 결과 */
export interface DurationResult {
  durationMin: number;
  rainfallMm: number; // T년 확률강우량
  effectiveRainfallMm: number; // 총 유효우량
  peakInflowRawCms: number; // Clark 첨두 (할증 전)
  peakInflowCms: number; // 할증 후 (필댐 × 1.2)
  peakOutflowCms: number;
  initialOutflowCms: number;
  maxLevelElM: number;
  maxStorageM3: number;
  timeOfMaxLevelMin: number;
  inflowCms: TimeSeries; // 할증 후, 10분
  outflowCms: TimeSeries; // 1분
  levelElM: TimeSeries; // 1분
}

/** 여유고 판정 (화면에는 적합/부적합만 표시) */
export interface Verdict {
  criticalDurationMin: number; // 최고수위가 가장 높은 지속기간
  maxLevelElM: number; // 반올림 전
  maxLevelRoundedElM: number; // 비교에 쓴 값
  damCrestElM: number;
  freeboardM: number; // 제정 − maxLevelRoundedElM
  requiredM: number; // 2.0
  pass: boolean; // 적합
  /** 반올림 전 값으로 비교하면 판정이 바뀌는 경우 */
  boundaryCase: boolean;
  /** 유역 ≤ 5 km² 또는 Tc < 1 hr → "홍수조절 미고려 대상(제5편 8.2.1)" 안내 */
  floodControlNotConsidered: boolean;
}

export interface RunWarning {
  code: "areaReduction" | "floodControlNotConsidered" | "boundaryFreeboard" | "seokyeongDefinition" | "shortRecord" | "specAnomaly";
  message: string;
}

/** 확률강우량 표 */
export interface ProbableRainfall {
  durationMin: number[];
  conversionFactor: number[]; // 환산계수 Y (override면 NaN)
  rainfallMm: number[];
  nYears: number; // 표본 수 (override면 0)
  source: ValueSource;
}

export type RunResult =
  | {
      ok: true;
      durations: DurationResult[];
      verdict: Verdict;
      rainfall: ProbableRainfall;
      /** 계산에 쓴 값과 출처 (화면의 "자동(출처)"/"입력" 표시) */
      used: Record<string, Sourced<number | string>>;
      warnings: RunWarning[];
    }
  | { ok: false; issues: ValidationIssue[] };

/** 지속기간 10개 (분) — CLAUDE.md 5-10 */
export const DURATIONS_MIN = [60, 120, 180, 240, 360, 540, 720, 900, 1080, 1440] as const;
