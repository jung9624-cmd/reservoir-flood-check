// 일반 검사: 질량보존, 경계 사례, 시나리오 독립성
import { describe, expect, it } from "vitest";
import { huffHyetograph } from "@/lib/hyetograph";
import { clarkHydrograph, effectiveRainfall } from "@/lib/runoff";
import { modifiedPuls, outflowCms } from "@/lib/routing";
import { storageFromSpec, storageFromTable, type StorageCurve } from "@/lib/storage";
import { runAll } from "@/lib/run";
import type { Outlet, RunResult, TimeSeries } from "@/lib/types";
import { flowCmsToVolumeM3 } from "@/lib/units";
import { huff, inputs, inputsSpecCurve, optionsReport, spec, storageTable } from "./helpers/kwoni";

function ok(r: RunResult) {
  if (!r.ok) throw new Error(JSON.stringify(r.issues));
  return r;
}
/** 사다리꼴 적분 체적 (m³) */
const volume = (s: TimeSeries) => s.values.reduce((acc, v, i) => (i === 0 ? 0 : acc + flowCmsToVolumeM3((v + s.values[i - 1]) / 2, s.dtMin)), 0);
const allFinite = (xs: readonly number[]) => xs.every((x) => Number.isFinite(x));

const tableCurve = storageFromTable(storageTable);
const specCurve = storageFromSpec({
  fullLevelElM: spec.fullLevelElM!, deadLevelElM: spec.deadLevelElM!,
  totalStorageThousandM3: spec.totalStorageThousandM3!, fullAreaHa: spec.fullAreaHa!, asOf: spec.asOf,
});
const spillwayOnly: Outlet[] = [{ name: "물넘이", widthM: 61, crestElM: 165.9, coefficient: 2.05, open: true }];
const withGate: Outlet[] = [...spillwayOnly, ...inputs.extraOutlets];

/** 유입 − 방류 − 저류량 변화 / 유입 (%) */
function massError(inflow: TimeSeries, curve: StorageCurve, outlets: Outlet[], h0: number) {
  const r = modifiedPuls(inflow, curve, outlets, h0);
  const vin = volume(inflow);
  const vout = volume(r.outflowCms);
  const ds = curve.storageAt(r.levelElM.values.at(-1)!) - curve.storageAt(h0);
  return { r, vin, vout, ds, errPct: ((vin - vout - ds) / vin) * 100 };
}

describe("8. 질량보존: 유입 총량 − 방류 총량 = 저류량 변화 (0.1 % 이내)", () => {
  const runs = {
    설계표: ok(runAll(spec, inputs, optionsReport, { huff })),
    제원곡선: ok(runAll(spec, inputsSpecCurve, optionsReport, { huff })),
  };
  for (const [name, res] of Object.entries(runs)) {
    const curve = name === "설계표" ? tableCurve : specCurve;
    it.each(res.durations.map((d) => ({ d })))(`${name} $d.durationMin분`, ({ d }) => {
      const vin = volume(d.inflowCms);
      const vout = volume(d.outflowCms);
      const ds = curve.storageAt(d.levelElM.values.at(-1)!) - curve.storageAt(d.levelElM.values[0]);
      expect(Math.abs((vin - vout - ds) / vin) * 100).toBeLessThan(0.1);
    });
  }
});

describe("9. 경계 사례", () => {
  it("무강우: 유효우량·유입 0, 수문곡선이 길게 늘어나지 않는다", () => {
    const eff = effectiveRainfall(huffHyetograph(0, 120, huff), 89);
    expect(eff.values.every((v) => v === 0)).toBe(true);
    const q = clarkHydrograph(eff, 6.4, 0.26, 0.2);
    expect(q.values.every((v) => v === 0)).toBe(true);
    expect(q.values.length).toBeLessThan(50);
  });
  it("무강우: 물넘이만 있으면 만수위 그대로, 방류 0", () => {
    const r = modifiedPuls({ dtMin: 10, values: [0, 0, 0] }, tableCurve, spillwayOnly, 165.9);
    expect(r.maxLevelElM).toBe(165.9);
    expect(r.peakOutflowCms).toBe(0);
    for (const h of r.levelElM.values) expect(h).toBeCloseTo(165.9, 5);
  });
  it("무강우: 비상수문(EL.164.4)이 열려 있으면 수위가 내려가기만 한다", () => {
    const r = modifiedPuls({ dtMin: 10, values: [0, 0, 0] }, tableCurve, withGate, 165.9);
    const h = r.levelElM.values;
    expect(allFinite(h)).toBe(true);
    for (let i = 1; i < h.length; i++) expect(h[i]).toBeLessThanOrEqual(h[i - 1] + 1e-9);
    expect(h.at(-1)!).toBeGreaterThan(164.4);
  });
  it("단일 펄스(10분 10 mm): 체적 보존, 첨두는 하나, 추적 질량보존", () => {
    const q = clarkHydrograph({ dtMin: 10, values: [10] }, 6.4, 0.26, 0.2);
    expect(volume(q) / (10 * 6.4 * 1000)).toBeCloseTo(1, 6);
    const peakAt = q.values.indexOf(Math.max(...q.values));
    for (let i = peakAt + 1; i < q.values.length; i++) expect(q.values[i]).toBeLessThanOrEqual(q.values[i - 1]);
    expect(Math.abs(massError(q, tableCurve, withGate, 165.9).errPct)).toBeLessThan(0.1);
  });
  it("Tc < 10분(0.1 hr): 시간-면적 구간 1개, 계산 끝까지 유한", () => {
    const res = ok(runAll(spec, { ...inputs, timing: { tcHr: 0.1, kHr: 0.2 } }, optionsReport, { huff }));
    for (const d of res.durations) {
      expect(allFinite(d.inflowCms.values) && allFinite(d.levelElM.values)).toBe(true);
      expect(Math.min(...d.inflowCms.values)).toBeGreaterThanOrEqual(0);
    }
  });
  it("물넘이 마루가 초기수위보다 높을 때(초기 EL.165.0, 수문 닫힘): 초기 방류 0, 수위 상승", () => {
    const closed = { ...inputs, extraOutlets: inputs.extraOutlets.map((o) => ({ ...o, open: false })) };
    const res = ok(runAll(spec, closed, { ...optionsReport, initialLevelElM: 165.0 }, { huff }));
    for (const d of res.durations) {
      expect(d.initialOutflowCms).toBe(0);
      expect(d.outflowCms.values[0]).toBe(0);
      expect(d.maxLevelElM).toBeGreaterThan(165.0);
      expect(allFinite(d.levelElM.values)).toBe(true);
    }
    expect(res.used.initialLevelElM.source).toEqual({ kind: "input" });
  });
  it("유역 25.9 km² 이상: 경고만, 계산은 한다", () => {
    const res = ok(runAll({ ...spec, catchmentHa: 2590 }, inputs, optionsReport, { huff }));
    expect(res.warnings.map((w) => w.code)).toContain("areaReduction");
    const below = ok(runAll({ ...spec, catchmentHa: 2589 }, inputs, optionsReport, { huff }));
    expect(below.warnings.map((w) => w.code)).not.toContain("areaReduction");
  });
});

describe("10. 시나리오 독립성", () => {
  it("같은 입력 두 번 → 같은 결과", () => {
    const a = runAll(spec, inputs, optionsReport, { huff });
    const b = runAll(spec, inputs, optionsReport, { huff });
    expect(b).toEqual(a);
  });
  it("다른 시나리오를 사이에 돌려도, 결과를 고쳐도 서로 영향 없음", () => {
    const a1 = ok(runAll(spec, inputs, optionsReport, { huff }));
    const snapshot = structuredClone(a1);
    const b = ok(runAll(spec, { ...inputs, spillway: { ...inputs.spillway, widthM: 30 }, cn: { amc: "III", value: 80 } }, optionsReport, { huff }));
    expect(b.verdict.maxLevelElM).not.toBeCloseTo(a1.verdict.maxLevelElM, 3);
    expect(a1).toEqual(snapshot); // B를 돌려도 A 결과는 그대로
    // A 결과 배열을 고쳐도 다음 계산과 B에는 영향이 없다
    a1.durations[0].inflowCms.values.fill(0);
    a1.rainfall.rainfallMm[0] = -1;
    const a2 = ok(runAll(spec, inputs, optionsReport, { huff }));
    expect(a2).toEqual(snapshot);
    expect(b.rainfall.rainfallMm[0]).toBe(optionsReport.rainfallOverrideMm![0]);
    expect(optionsReport.rainfallOverrideMm![0]).toBe(94.32);
  });
  it("방류량 함수는 시설 배열을 바꾸지 않는다", () => {
    const before = JSON.stringify(withGate);
    outflowCms(167, withGate);
    expect(JSON.stringify(withGate)).toBe(before);
  });
});
