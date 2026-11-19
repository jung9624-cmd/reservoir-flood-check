// 제원 값 대신 사용자 입력값 쓰기. 제원이 이상하거나 비어 있는 저수지(data-audit 9.1)를 계산할 수 있게 한다.
import type { PublicSpec, SpecOverrideField, SpecOverrides } from "./types";

/** 화면에 보일 항목 이름 */
export const SPEC_FIELD_LABEL: Record<SpecOverrideField, string> = {
  catchmentHa: "유역면적",
  fullLevelElM: "만수위",
  floodLevelElM: "홍수위",
  deadLevelElM: "사수위",
  totalStorageThousandM3: "총저수량",
  fullAreaHa: "만수면적",
  damType: "제체형식",
};

/** 넣은 항목만 바꾼 새 제원 (원본은 그대로). undefined인 항목은 무시한다 */
export function applySpecOverrides(spec: PublicSpec, overrides: SpecOverrides | undefined): PublicSpec {
  const out: PublicSpec = { ...spec };
  if (!overrides) return out;
  for (const k of Object.keys(SPEC_FIELD_LABEL) as SpecOverrideField[]) {
    const v = overrides[k];
    if (v !== undefined) (out as unknown as Record<string, unknown>)[k] = v;
  }
  return out;
}

/** 실제로 바뀐 항목 */
export function overriddenFields(overrides: SpecOverrides | undefined): SpecOverrideField[] {
  if (!overrides) return [];
  return (Object.keys(SPEC_FIELD_LABEL) as SpecOverrideField[]).filter((k) => overrides[k] !== undefined);
}

/** 계산은 하지만 확인이 필요한 제원 값 (막지 않고 경고) */
export function specAnomalies(spec: PublicSpec): { specField: SpecOverrideField; message: string }[] {
  const out: { specField: SpecOverrideField; message: string }[] = [];
  const { floodLevelElM: fl, fullLevelElM: hf } = spec;
  if (typeof fl === "number" && typeof hf === "number" && fl < hf) {
    out.push({ specField: "floodLevelElM", message: `제원 홍수위(EL.${fl})가 만수위(EL.${hf})보다 낮습니다. 제원 값을 확인하고 필요하면 직접 입력하세요` });
  }
  return out;
}
