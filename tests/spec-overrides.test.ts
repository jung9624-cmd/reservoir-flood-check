// 제원 값이 이상한 저수지: 사용자가 제원 값 대신 입력값을 넣어 계산한다 (data-audit 9.1)
import { describe, expect, it } from "vitest";
import reservoirsFile from "@/data/reservoirs.json";
import { applySpecOverrides, overriddenFields, specAnomalies } from "@/lib/spec";
import { runAll, toPublicSpec } from "@/lib/run";
import { validateInputs } from "@/lib/validate";
import type { PublicSpec, ReservoirsFile, RunResult, UserInputs } from "@/lib/types";
import { huff, inputsSpecCurve, optionsReport, spec } from "./helpers/kwoni";

const file = reservoirsFile as unknown as ReservoirsFile;
const ok = (r: RunResult) => {
  if (!r.ok) throw new Error(JSON.stringify(r.issues));
  return r;
};
const fail = (r: RunResult) => {
  if (r.ok) throw new Error("계산이 막혀야 합니다");
  return r.issues;
};

describe("applySpecOverrides", () => {
  it("넣은 항목만 바꾸고 원본은 그대로, undefined는 무시", () => {
    const before = structuredClone(spec);
    const s = applySpecOverrides(spec, { fullAreaHa: 12, catchmentHa: undefined });
    expect(s.fullAreaHa).toBe(12);
    expect(s.catchmentHa).toBe(spec.catchmentHa);
    expect(spec).toEqual(before);
    expect(overriddenFields({ fullAreaHa: 12, catchmentHa: undefined })).toEqual(["fullAreaHa"]);
    expect(applySpecOverrides(spec, undefined)).toEqual(spec);
  });
});

describe("막힌 제원을 입력값으로 풀기 (권이로 만든 사례)", () => {
  const broken: PublicSpec = { ...spec, fullAreaHa: 0 };
  const base = ok(runAll(spec, inputsSpecCurve, optionsReport, { huff }));

  it("만수면적 0 → 이유에 specField = fullAreaHa", () => {
    const issues = fail(runAll(broken, inputsSpecCurve, optionsReport, { huff }));
    expect(issues).toContainEqual(expect.objectContaining({ field: "제원.만수면적", specField: "fullAreaHa" }));
  });
  it("만수면적을 입력하면 계산하고, 출처는 입력", () => {
    const fixed: UserInputs = { ...inputsSpecCurve, specOverrides: { fullAreaHa: 9.9 } };
    const r = ok(runAll(broken, fixed, optionsReport, { huff }));
    expect(r.used.fullAreaHa).toEqual({ value: 9.9, source: { kind: "input" } });
    expect(r.used.catchmentHa.source).toMatchObject({ kind: "auto" });
    expect(r.used.storageCurve.source).toMatchObject({ kind: "auto", source: expect.stringContaining("입력값 사용: 만수면적") });
    expect(r.verdict).toEqual(base.verdict); // 원래 제원과 같은 값이면 같은 결과
    expect(broken.fullAreaHa).toBe(0); // 원본 제원은 그대로
  });
  it("입력값도 같은 검사를 받는다 (만수면적 −1은 막힘)", () => {
    const issues = fail(runAll(broken, { ...inputsSpecCurve, specOverrides: { fullAreaHa: -1 } }, optionsReport, { huff }));
    expect(issues.map((i) => i.specField)).toContain("fullAreaHa");
  });
  it("사수위 ≥ 만수위, 유역면적 0, 만수위 0도 specField가 붙는다", () => {
    const issues = fail(runAll({ ...spec, deadLevelElM: 170, catchmentHa: 0 }, inputsSpecCurve, optionsReport, { huff }));
    expect(issues.map((i) => i.specField)).toEqual(expect.arrayContaining(["deadLevelElM", "catchmentHa"]));
    const r = ok(runAll({ ...spec, deadLevelElM: 170, catchmentHa: 0 }, { ...inputsSpecCurve, specOverrides: { deadLevelElM: 154, catchmentHa: 640 } }, optionsReport, { huff }));
    expect(r.verdict).toEqual(base.verdict);
    expect(fail(runAll({ ...spec, fullLevelElM: 0 }, { ...inputsSpecCurve, spillway: { widthM: 61 } }, optionsReport, { huff })).map((i) => i.specField)).toContain("fullLevelElM");
  });
  it("유역면적을 바꿔 넣으면 결과가 바뀌고 출처는 입력", () => {
    const r = ok(runAll(spec, { ...inputsSpecCurve, specOverrides: { catchmentHa: 800 } }, optionsReport, { huff }));
    expect(r.used.catchmentHa).toEqual({ value: 800, source: { kind: "input" } });
    expect(r.durations[1].peakInflowCms).toBeGreaterThan(base.durations[1].peakInflowCms);
  });
  it("제체형식을 넣으면 할증이 그에 따른다", () => {
    const r = ok(runAll(spec, { ...inputsSpecCurve, specOverrides: { damType: "콘크리트댐(중력형)" } }, optionsReport, { huff }));
    expect(r.used.designFactor.value).toBe(1);
    expect(r.used.damType.source).toEqual({ kind: "input" });
  });
});

describe("홍수위 < 만수위: 계산은 하고 경고, 홍수위를 입력하면 경고 없음", () => {
  const odd: PublicSpec = { ...spec, floodLevelElM: 160 };
  it("경고 specAnomaly", () => {
    expect(specAnomalies(odd)).toEqual([expect.objectContaining({ specField: "floodLevelElM" })]);
    const r = ok(runAll(odd, inputsSpecCurve, optionsReport, { huff }));
    expect(r.warnings.map((w) => w.code)).toContain("specAnomaly");
  });
  it("홍수위를 입력하면 경고가 사라지고 출처는 입력", () => {
    const r = ok(runAll(odd, { ...inputsSpecCurve, specOverrides: { floodLevelElM: 167.1 } }, optionsReport, { huff }));
    expect(r.warnings.map((w) => w.code)).not.toContain("specAnomaly");
    expect(r.used.floodLevelElM).toEqual({ value: 167.1, source: { kind: "input" } });
  });
});

describe("전국 제원: 제원 문제로 막히는 이유에는 모두 specField가 있다", () => {
  // 사용자 입력 쪽 문제가 생기지 않게 입력값은 제원에 맞춘다(제정 = 만수위 + 3 m)
  const issues = file.reservoirs.flatMap((r) => {
    const s = toPublicSpec(r, file.asOf);
    const inp: UserInputs = { spillway: { widthM: 10 }, extraOutlets: [], damCrestElM: (r.fullLevelElM ?? 0) + 3, cn: { amc: "III", value: 85 }, timing: { tcHr: 0.5, kHr: 0.5 } };
    return validateInputs(s, inp, optionsReport).map((i) => ({ code: r.code, ...i }));
  });
  it("제원.* 이유 = specField 있음", () => {
    const specIssues = issues.filter((i) => i.field.startsWith("제원."));
    expect(specIssues.length).toBeGreaterThan(0);
    expect(specIssues.filter((i) => !i.specField)).toEqual([]);
    expect(issues.filter((i) => !i.field.startsWith("제원."))).toEqual([]);
  });
  it("홍수위 < 만수위 15곳은 경고 대상", () => {
    const n = file.reservoirs.filter((r) => specAnomalies(toPublicSpec(r, file.asOf)).length > 0).length;
    expect(n).toBe(15);
  });
});
