// 입력 폼의 글자 상태(draft) ↔ 계산 입력(UserInputs). 순수 함수, React와 무관 (CLAUDE.md 4절).
import type { Outlet, SpecOverrideField, SpecOverrides, StoragePoint, UserInputs } from "./types";

/** 추가 방류시설 한 줄 (글자 상태) */
export interface OutletDraft {
  name: string;
  widthM: string;
  crestElM: string;
  coefficient: string;
  open: boolean;
}

/** 입력 폼 상태. 숫자는 사용자가 친 글자 그대로 둔다 */
export interface InputDraft {
  spillwayWidthM: string;
  spillwayCrestElM: string; // 빈 칸이면 만수위
  spillwayCoefficient: string; // 빈 칸이면 2.0
  extraOutlets: OutletDraft[];
  damCrestElM: string;
  cnAmc: "II" | "III";
  cnValue: string;
  tcKMethod: "direct" | "seokyeong";
  tcHr: string;
  kHr: string;
  channelLengthKm: string;
  farthestPointElM: string;
  storageTableText: string; // 엑셀 두 열 붙여넣기
  specOverrides: Partial<Record<SpecOverrideField, string>>;
}

export const emptyDraft = (): InputDraft => ({
  spillwayWidthM: "",
  spillwayCrestElM: "",
  spillwayCoefficient: "",
  extraOutlets: [],
  damCrestElM: "",
  cnAmc: "III",
  cnValue: "",
  tcKMethod: "direct",
  tcHr: "",
  kHr: "",
  channelLengthKm: "",
  farthestPointElM: "",
  storageTableText: "",
  specOverrides: {},
});

export const emptyOutlet = (): OutletDraft => ({ name: "비상수문", widthM: "", crestElM: "", coefficient: "", open: true });

/** 폼 칸 이름 (오류 표시 위치) */
export type DraftField =
  | "spillwayWidthM" | "spillwayCrestElM" | "spillwayCoefficient" | "damCrestElM" | "cnValue"
  | "tcHr" | "kHr" | "channelLengthKm" | "farthestPointElM" | "storageTableText" | `outlet${number}`
  | `spec.${SpecOverrideField}`;

export interface DraftResult {
  /** 필수 칸이 모두 숫자로 채워졌을 때만 */
  inputs: UserInputs | null;
  /** 비어 있는 필수 칸 (화면 이름) */
  missing: { field: DraftField; label: string }[];
  /** 숫자가 아니거나 표를 읽을 수 없는 칸 */
  errors: Partial<Record<DraftField, string>>;
  storageRows: number;
  /** 필수 칸이 비어도 읽을 수 있는 값 (제원 검사용) */
  specOverrides: SpecOverrides | undefined;
  storageTable: StoragePoint[] | undefined;
}

const num = (s: string): number | null => {
  const t = s.trim().replace(/,/g, "");
  if (t === "") return null;
  const v = Number(t);
  return Number.isFinite(v) ? v : NaN;
};

/** 엑셀 두 열(표고, 저수량 m³) 붙여넣기 → 행. 머리글 줄과 빈 줄은 건너뛴다 */
export function parseStorageTable(text: string): { points: StoragePoint[]; error: string | null } {
  const points: StoragePoint[] = [];
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  for (const [i, line] of lines.entries()) {
    // 엑셀 복사는 탭으로 나뉘고 천 단위 쉼표가 붙을 수 있다. 탭·세미콜론이 없으면 공백, 그것도 없으면 쉼표로 나눈다
    const parts = /[\t;]/.test(line) ? line.split(/[\t;]/) : /\s/.test(line) ? line.split(/\s+/) : line.split(",");
    const cells = parts.map((c) => c.trim().replace(/,/g, "")).filter(Boolean);
    const [a, b] = cells.map(Number);
    if (cells.length < 2 || !Number.isFinite(a) || !Number.isFinite(b)) {
      if (i === 0 && points.length === 0) continue; // 머리글
      return { points, error: `${i + 1}째 줄을 읽을 수 없습니다: "${line}"` };
    }
    points.push({ levelElM: a, storageM3: b });
  }
  return { points, error: null };
}

/** 글자 상태 → 계산 입력. 계산은 하지 않는다 */
export function draftToInputs(d: InputDraft): DraftResult {
  const missing: DraftResult["missing"] = [];
  const errors: DraftResult["errors"] = {};
  const read = (field: DraftField, label: string, s: string, required: boolean): number | undefined => {
    const v = num(s);
    if (v === null) {
      if (required) missing.push({ field, label });
      return undefined;
    }
    if (Number.isNaN(v)) {
      errors[field] = "숫자가 아닙니다";
      return undefined;
    }
    return v;
  };

  const widthM = read("spillwayWidthM", "물넘이 폭", d.spillwayWidthM, true);
  const crestElM = read("spillwayCrestElM", "물넘이 마루표고", d.spillwayCrestElM, false);
  const coefficient = read("spillwayCoefficient", "물넘이 유량계수", d.spillwayCoefficient, false);
  const damCrestElM = read("damCrestElM", "제정표고", d.damCrestElM, true);
  const cn = read("cnValue", "CN", d.cnValue, true);
  let tcHr: number | undefined, kHr: number | undefined, channelLengthKm: number | undefined, farthestPointElM: number | undefined;
  if (d.tcKMethod === "direct") {
    tcHr = read("tcHr", "Tc", d.tcHr, true);
    kHr = read("kHr", "K", d.kHr, true);
  } else {
    channelLengthKm = read("channelLengthKm", "유로연장", d.channelLengthKm, true);
    farthestPointElM = read("farthestPointElM", "최원점 표고", d.farthestPointElM, true);
  }

  const extraOutlets: Outlet[] = [];
  d.extraOutlets.forEach((o, i) => {
    const w = num(o.widthM), z = num(o.crestElM), c = num(o.coefficient);
    if (w === null || z === null) {
      missing.push({ field: `outlet${i}`, label: `추가 방류시설 ${i + 1}의 폭·표고` });
      return;
    }
    if ([w, z, c].some((v) => Number.isNaN(v))) {
      errors[`outlet${i}`] = "숫자가 아닌 값이 있습니다";
      return;
    }
    extraOutlets.push({ name: o.name || `방류시설 ${i + 1}`, widthM: w, crestElM: z, coefficient: c ?? 2.0, open: o.open });
  });

  let storageTable: StoragePoint[] | undefined;
  let storageRows = 0;
  if (d.storageTableText.trim()) {
    const { points, error } = parseStorageTable(d.storageTableText);
    if (error) errors.storageTableText = error;
    else {
      storageTable = points;
      storageRows = points.length;
    }
  }

  const specOverrides: SpecOverrides = {};
  for (const [k, s] of Object.entries(d.specOverrides) as [SpecOverrideField, string][]) {
    if (!s || !s.trim()) continue;
    if (k === "damType") {
      specOverrides.damType = s.trim();
      continue;
    }
    const v = num(s);
    if (v === null) continue;
    if (Number.isNaN(v)) errors[`spec.${k}`] = "숫자가 아닙니다";
    else specOverrides[k] = v;
  }

  const ok = missing.length === 0 && Object.keys(errors).length === 0;
  const inputs: UserInputs | null = ok
    ? {
        spillway: { widthM: widthM!, crestElM, coefficient },
        extraOutlets,
        damCrestElM: damCrestElM!,
        cn: { amc: d.cnAmc, value: cn! },
        timing: { tcHr, kHr, channelLengthKm, farthestPointElM },
        storageTable,
        specOverrides: Object.keys(specOverrides).length ? specOverrides : undefined,
      }
    : null;
  return { inputs, missing, errors, storageRows, specOverrides: Object.keys(specOverrides).length ? specOverrides : undefined, storageTable };
}

/** validateInputs의 항목 이름 → 폼 칸 */
export function issueToDraftField(field: string): DraftField | null {
  const map: Record<string, DraftField> = {
    "물넘이 폭": "spillwayWidthM",
    "물넘이 유량계수": "spillwayCoefficient",
    "물넘이 마루표고": "spillwayCrestElM",
    "제정표고": "damCrestElM",
    CN: "cnValue",
    Tc: "tcHr",
    K: "kHr",
    유로연장: "channelLengthKm",
    "최원점 표고": "farthestPointElM",
    "설계 내용적표": "storageTableText",
  };
  if (map[field]) return map[field];
  const m = /^추가 방류시설 (\d+)/.exec(field);
  return m ? (`outlet${Number(m[1]) - 1}` as DraftField) : null;
}
