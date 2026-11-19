// 권이 재현 (보고서 기준) + 공공데이터만 썼을 때의 차이. 검증값: tests/fixtures/kwoni-report.json (CLAUDE.md 6절)
import { describe, expect, it } from "vitest";
import { probableRainfall } from "@/lib/rainfall";
import { runAll } from "@/lib/run";
import { storageFromSpec, storageFromTable } from "@/lib/storage";
import type { RunResult } from "@/lib/types";
import { DURATIONS_MIN } from "@/lib/types";
import { annualMax, huff, inputs, inputsSpecCurve, kwoni, optionsReport, optionsStation, pct, spec, storageTable } from "./helpers/kwoni";

const tol = kwoni.check2_routing.tolerance;
const rows = kwoni.check2_routing.rows;

function ok(r: RunResult) {
  if (!r.ok) throw new Error(JSON.stringify(r.issues));
  return r;
}

describe("1. 확률강우량: 포항(138) 1961~2022, 200년, K-HAS 시각 방식", () => {
  const r = probableRainfall(annualMax, { timeConvention: "khas", firstYear: 1961, lastYear: 2022, returnPeriodYr: 200 });
  it("표본 62년, 지속기간 10개", () => {
    expect(r.nYears).toBe(62);
    expect(r.durationMin).toEqual(kwoni.check1_probableRainfall200.duration_min);
  });
  it.each(DURATIONS_MIN.map((d, j) => ({ d, j })))("$d분: 0.3 % 이내", ({ j }) => {
    expect(Math.abs(pct(r.rainfallMm[j], kwoni.check1_probableRainfall200.rainfall_mm[j]))).toBeLessThan(kwoni.check1_probableRainfall200.tolerance_pct);
  });
});

describe("2~5. 보고서 확률강우량 + 설계 내용적표", () => {
  const res = ok(runAll(spec, inputs, optionsReport, { huff }));
  const byD = new Map(res.durations.map((d) => [d.durationMin, d]));

  it.each(rows)("2. $duration_min분 유입량 × 1.2: 0.5 % 이내", (r) => {
    expect(Math.abs(pct(byD.get(r.duration_min)!.peakInflowCms, r.inflowX1_2_cms))).toBeLessThan(tol.flow_pct);
  });
  it("2. (참고) 할증 전 Clark 첨두 10개도 보고서 표 3.13과 0.5 % 이내", () => {
    res.durations.forEach((d, j) => expect(Math.abs(pct(d.peakInflowRawCms, kwoni.clarkPeakRaw_cms.peak_cms[j]))).toBeLessThan(tol.flow_pct));
  });
  it.each(rows)("3. $duration_min분 최대방류량 0.5 %, 최고수위 ±0.01 m", (r) => {
    const d = byD.get(r.duration_min)!;
    expect(Math.abs(pct(d.peakOutflowCms, r.peakOutflow_cms))).toBeLessThan(tol.flow_pct);
    expect(Math.abs(d.maxLevelElM - r.maxLevel_el)).toBeLessThanOrEqual(tol.level_m);
  });
  it("4. 임계지속기간 120분, 최고수위 EL.167.10, 여유고 2.00 m, 적합", () => {
    const v = res.verdict;
    expect(v.criticalDurationMin).toBe(kwoni.check2_routing.criticalDuration_min);
    expect(v.maxLevelRoundedElM).toBe(kwoni.check2_routing.maxLevelCritical_el);
    expect(v.freeboardM).toBeCloseTo(kwoni.check2_routing.freeboard_m, 9);
    expect(v.pass).toBe(true);
    expect(kwoni.check2_routing.verdict).toBe("적합");
  });
  it("5. 초기 방류량 약 15 m³/s (만수위 시작, 비상수문 열림 → 2.0 × 4 × 1.5^1.5 = 14.70)", () => {
    expect(res.used.initialLevelElM.value).toBe(spec.fullLevelElM);
    for (const d of res.durations) expect(d.initialOutflowCms).toBeCloseTo(14.697, 2);
    expect(Math.abs(res.durations[0].initialOutflowCms - kwoni.check2_routing.initialOutflow_cms_approx)).toBeLessThan(0.5);
  });
});

describe("6. 제원 근사 내용적 곡선 vs 설계표 (EL.163 이상)", () => {
  const sc = storageFromSpec({
    fullLevelElM: spec.fullLevelElM!, deadLevelElM: spec.deadLevelElM!,
    totalStorageThousandM3: spec.totalStorageThousandM3!, fullAreaHa: spec.fullAreaHa!, asOf: spec.asOf,
  });
  const rowsAbove = storageTable.filter((p) => p.levelElM >= kwoni.specCurveCheck.fromLevel_el);
  const diff = rowsAbove.map((p) => ({ h: p.levelElM, pct: pct(sc.storageAt(p.levelElM), p.storageM3) }));

  it("EL.167.1에서 약 +0.1 %", () => {
    expect(diff.find((x) => x.h === 167.1)!.pct).toBeCloseTo(0.08, 1);
  });
  it("홍수추적 구간(만수위 EL.165.9 ~ 168.5)은 1 % 이내", () => {
    for (const x of diff.filter((x) => x.h >= spec.fullLevelElM!)) expect(Math.abs(x.pct)).toBeLessThan(kwoni.specCurveCheck.tolerance_pct);
  });
  it("EL.163 이상에서 1 %를 넘는 행은 EL.164.0 하나 (+1.04 %, 곡선 모양 차이 — 보고 참조)", () => {
    // 허용오차를 키우지 않고 넘는 행을 그대로 기록한다. 원인: 멱함수 한 개로는 설계표의 곡률을 다 따라가지 못함(식 차이 아님)
    const over = diff.filter((x) => Math.abs(x.pct) >= kwoni.specCurveCheck.tolerance_pct);
    expect(over.map((x) => x.h)).toEqual([164.0]);
    expect(over[0].pct).toBeCloseTo(1.04, 2);
  });
  it("설계표는 표의 점을 그대로 지난다", () => {
    const tc = storageFromTable(storageTable);
    for (const p of storageTable) expect(tc.storageAt(p.levelElM)).toBe(p.storageM3);
  });
});

describe("7. 공공데이터만 쓴 권이 결과 (기록용, 통과 기준 없음)", () => {
  const cases = {
    "설계표+보고서강우": ok(runAll(spec, inputs, optionsReport, { huff })),
    "제원곡선+보고서강우": ok(runAll(spec, inputsSpecCurve, optionsReport, { huff })),
    "제원곡선+actual(1961~2022)": ok(runAll(spec, inputsSpecCurve, optionsStation("actual"), { huff, annualMax })),
    "제원곡선+actual(1961~2024)": ok(runAll(spec, inputsSpecCurve, optionsStation("actual", 1961, 2024), { huff, annualMax })),
  };

  it("보고서와 나란히 출력", () => {
    const lines: string[] = [];
    const head = ["지속(분)", "항목", "보고서", ...Object.keys(cases)];
    lines.push(`| ${head.join(" | ")} |`, `|${head.map(() => "---").join("|")}|`);
    const f = (x: number, n = 2) => x.toFixed(n);
    for (const r of rows) {
      const ds = Object.values(cases).map((c) => c.durations.find((d) => d.durationMin === r.duration_min)!);
      lines.push(`| ${r.duration_min} | 유입×1.2 | ${f(r.inflowX1_2_cms)} | ${ds.map((d) => f(d.peakInflowCms)).join(" | ")} |`);
      lines.push(`| ${r.duration_min} | 최대방류 | ${f(r.peakOutflow_cms)} | ${ds.map((d) => f(d.peakOutflowCms)).join(" | ")} |`);
      lines.push(`| ${r.duration_min} | 최고수위 | ${f(r.maxLevel_el)} | ${ds.map((d) => f(d.maxLevelElM, 3)).join(" | ")} |`);
    }
    const vs = Object.values(cases).map((c) => c.verdict);
    lines.push(`| — | 임계(분) | 120 | ${vs.map((v) => v.criticalDurationMin).join(" | ")} |`);
    lines.push(`| — | 여유고(m) | 2.00 | ${vs.map((v) => f(v.freeboardM)).join(" | ")} |`);
    lines.push(`| — | 판정 | 적합 | ${vs.map((v) => (v.pass ? "적합" : "부적합")).join(" | ")} |`);
    console.log(`\n[권이 공공데이터 비교]\n${lines.join("\n")}\n`);
    for (const c of Object.values(cases)) {
      expect(c.durations).toHaveLength(10);
      for (const d of c.durations) expect(Number.isFinite(d.maxLevelElM)).toBe(true);
    }
  });
});
