// 공통 타입. 단위는 이름 끝에 붙인다(_ha, _km2, _m3, _thm3 = 천m³, _el = EL.m, _hr, _min, _mm, _cms = m³/s).
// 근거: CLAUDE.md 3~5절, docs/calc-rules.md

/** 값 옆에 붙이는 출처 표시 (CLAUDE.md 4절: "자동(출처)" 또는 "입력") */
export type ValueSource =
  | { kind: "auto"; source: string }
  | { kind: "input" };

/** 저수지 제원 (공공데이터포털 15044339) — 값은 이 자료를 따른다 */
export interface ReservoirSpec {
  code: string; // 표준코드 10자리 (문자열로 다룬다)
  hq: string; // 본부
  branch: string; // 지사
  name: string; // 시설명 (중복 있음, 키로 쓰지 않음)
  address: string; // 소재지 (리·동까지)
  startDate: string; // 착공년도
  completeDate: string; // 준공년도
  grade: string | null; // 종별
  category: string; // 구분
  catchment_ha: number; // 유역면적
  floodArea_ha: number; // 홍수면적
  fullArea_ha: number; // 만수면적
  benefitArea_ha: number; // 수혜면적
  droughtFreq_yr: number; // 한발빈도
  floodFreq_yr: number; // 홍수빈도
  damType: string; // 제체형식
  damLength_m: number; // 제체길이
  damHeight_m: number; // 제체높이
  totalStorage_thm3: number; // 총저수량 (천m³)
  effectiveStorage_thm3: number; // 유효저수량 (천m³)
  deadStorage_thm3: number; // 사수량 (천m³)
  intakeType: string | null; // 취수형식
  floodLevel_el: number; // 홍수위
  fullLevel_el: number; // 만수위
  deadLevel_el: number; // 사수위
}

/** 저수지 위치. 공유플랫폼 좌표가 없으면 리·동 중심(위치 근사) */
export interface ReservoirCoord {
  code: string;
  lat: number;
  lon: number;
  approximate: boolean; // true = 위치 근사
  decimals: number | null; // 좌표 소수자리
}

/** ASOS 관측소 */
export interface Station {
  code: string; // 3자리 문자열 (예: "138")
  name: string;
  lat: number;
  lon: number;
  firstYear: number;
  lastYear: number;
}

/** 지속기간별 고정시간 연최대 강우량 (mm) */
export interface AnnualMaxSeries {
  station: string;
  durations_hr: number[]; // 1, 2, 3, 4, 6, 9, 12, 15, 18, 24
  years: number[];
  values_mm: number[][]; // [해][지속기간]
  timeConvention: "actual" | "khas"; // 실제 시각(기본) / K-HAS 방식(검증용)
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
