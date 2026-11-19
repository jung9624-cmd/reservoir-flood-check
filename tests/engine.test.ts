// 엔진 단위 테스트. 권이 보고서 재현은 kwoni-report.test.ts
import { describe, expect, it } from "vitest";
import { conversionFactor, gumbelPwm, gumbelQuantile, probableRainfall } from "@/lib/rainfall";
import { huffHyetograph } from "@/lib/hyetograph";
import { clarkHydrograph, cn2ToCn3, effectiveRainfall, timeAreaIncrements } from "@/lib/runoff";
import { powerExponent, storageFromSpec, storageFromTable } from "@/lib/storage";
import { outflowCms } from "@/lib/routing";
import { judge, roundTo } from "@/lib/judge";
import { nearestStation } from "@/lib/station";
import { runAll } from "@/lib/run";
import { depthMmToFlowCms } from "@/lib/units";
import type { DurationResult, UserInputs } from "@/lib/types";
import { annualMax, huff, inputs, kwoni, optionsReport as options, pct, spec } from "./helpers/kwoni";

describe("확률강우량 (CLAUDE.md 5.1)", () => {
  it("환산계수 Y(1시간) = 0.1346 + 1.0014", () => {
    expect(conversionFactor(1)).toBeCloseTo(1.136, 12);
    expect(conversionFactor(24)).toBeCloseTo(0.1346 * 24 ** -1.417 + 1.0014, 12);
  });
  it("Gumbel PWM: 입력 배열을 바꾸지 않는다, 정렬과 무관", () => {
    const x = [30, 10, 20, 40];
    const a = gumbelPwm(x);
    expect(x).toEqual([30, 10, 20, 40]);
    expect(gumbelPwm([10, 20, 30, 40])).toEqual(a);
    expect(a.b0).toBe(25);
    expect(a.b1).toBeCloseTo((0 * 10 + (1 / 3) * 20 + (2 / 3) * 30 + 1 * 40) / 4, 12);
    expect(gumbelQuantile(a, 200)).toBeCloseTo(a.xi - a.alpha * Math.log(-Math.log(1 - 1 / 200)), 12);
  });
  it("실제 시각 방식은 120분 +1.0 %, 240분 −1.3 %, 1440분 −2.1 % (data-audit 5.1)", () => {
    const r = probableRainfall(annualMax, { timeConvention: "actual", firstYear: 1961, lastYear: 2022, returnPeriodYr: 200 });
    const rep = kwoni.check1_probableRainfall200.rainfall_mm;
    expect(pct(r.rainfallMm[1], rep[1])).toBeCloseTo(1.02, 1);
    expect(pct(r.rainfallMm[3], rep[3])).toBeCloseTo(-1.28, 1);
    expect(pct(r.rainfallMm[9], rep[9])).toBeCloseTo(-2.07, 1);
  });
});

describe("Huff · 유효우량 · Clark", () => {
  it("Huff: 합계 = 총강우, 10분 n = D/10", () => {
    const h = huffHyetograph(100, 120, huff);
    expect(h.values).toHaveLength(12);
    expect(h.values.reduce((s, v) => s + v, 0)).toBeCloseTo(100, 9);
    expect(() => huffHyetograph(100, 125, huff)).toThrow(RangeError);
  });
  it("CN-Ⅲ = 23·CN/(10+0.13·CN): 78.24 → 89.21 (calc-rules 7-2)", () => {
    expect(cn2ToCn3(78.24)).toBeCloseTo(89.21, 2);
  });
  it("총 유효우량 = (P − Ia)² / (P + 0.8S)", () => {
    const e = effectiveRainfall(huffHyetograph(94.32, 60, huff), 89);
    const S = 25400 / 89 - 254;
    expect(e.values.reduce((s, v) => s + v, 0)).toBeCloseTo((94.32 - 0.2 * S) ** 2 / (94.32 + 0.8 * S), 9);
  });
  it("시간-면적 dA 합 = 1, Tc 15.6분 → 구간 2개 (반올림 안 함)", () => {
    const dA = timeAreaIncrements(15.6, 10);
    expect(dA).toHaveLength(2);
    expect(dA[0] + dA[1]).toBeCloseTo(1, 12);
  });
  it("Clark: 유출 체적 = 유효우량 × 면적", () => {
    const e = effectiveRainfall(huffHyetograph(200, 240, huff), 89);
    const q = clarkHydrograph(e, 6.4, 0.26, 0.2);
    const vol = q.values.reduce((s, v) => s + v, 0) * 600;
    expect(vol / (e.values.reduce((s, v) => s + v, 0) * 6.4 * 1000)).toBeCloseTo(1, 6);
    expect(depthMmToFlowCms(1, 1, 10)).toBeCloseTo(1000 / 600, 12);
  });
});

describe("내용적 곡선 · 방류량", () => {
  it("제원 곡선: 만수위에서 S만수, 사수위 아래 0, m = 99,000 × 11.9 / 550,000", () => {
    const c = storageFromSpec({ fullLevelElM: 165.9, deadLevelElM: 154, totalStorageThousandM3: 550, fullAreaHa: 9.9, asOf: "x" });
    expect(c.storageAt(165.9)).toBeCloseTo(550_000, 6);
    expect(c.storageAt(150)).toBe(0);
    expect(powerExponent({ fullLevelElM: 165.9, deadLevelElM: 154, totalStorageThousandM3: 550, fullAreaHa: 9.9 })).toBeCloseTo((99_000 * 11.9) / 550_000, 9);
  });
  it("설계표: 선형보간, 168.5 위는 마지막 구간 기울기로 외삽, 입력 배열 그대로", () => {
    const table = inputs.storageTable!;
    const before = JSON.stringify(table);
    const c = storageFromTable(table);
    expect(c.storageAt(165.9)).toBe(550007);
    expect(c.storageAt(166.5)).toBeCloseTo(550007 + (0.6 / 1.2) * (675136 - 550007), 6);
    expect(c.storageAt(169.9)).toBeCloseTo(842962 + 1.4 * ((842962 - 675136) / 1.4), 6);
    expect(JSON.stringify(table)).toBe(before);
  });
  it("방류량: 만수위에서 비상수문만 2.0·4·1.5^1.5 = 14.70 m³/s, 닫히면 0", () => {
    const all = [...inputs.extraOutlets, { name: "s", widthM: 61, crestElM: 165.9, coefficient: 2.05, open: true }];
    expect(outflowCms(165.9, all)).toBeCloseTo(14.697, 3);
    expect(outflowCms(167, [{ name: "g", widthM: 4, crestElM: 164.4, coefficient: 2, open: false }])).toBe(0);
  });
});

describe("입력 검사 (예외 대신 목록)", () => {
  it("이상 입력은 항목 + 이유", () => {
    const bad: UserInputs = { ...inputs, spillway: { widthM: 0 }, damCrestElM: 165, cn: { amc: "III", value: 120 }, timing: { tcHr: 0, kHr: -1 }, storageTable: undefined };
    const r = runAll({ ...spec, fullAreaHa: 0, deadLevelElM: 170 }, bad, options, { huff });
    expect(r.ok).toBe(false);
    const fields = !r.ok ? r.issues.map((i) => i.field) : [];
    expect(fields).toEqual(expect.arrayContaining(["물넘이 폭", "제정표고", "CN", "Tc", "K", "제원.만수면적", "제원.사수위"]));
  });
  it("유역 25.9 km² 이상은 면적감소계수 경고만", () => {
    const r = runAll({ ...spec, catchmentHa: 3000 }, inputs, options, { huff });
    expect(r.ok && r.warnings.some((w) => w.code === "areaReduction")).toBe(true);
  });
});

describe("판정 · 관측소", () => {
  const mk = (d: number, h: number) => ({ durationMin: d, maxLevelElM: h }) as DurationResult;
  it("임계지속기간 = 최고수위 최대", () => {
    const v = judge([mk(60, 167.0), mk(120, 167.2), mk(180, 167.1)], 170, 6.4, 0.26);
    expect(v.criticalDurationMin).toBe(120);
    expect(v.freeboardM).toBeCloseTo(2.8, 9);
    expect(roundTo(167.104, 0.01)).toBe(167.1);
  });
  it("30년 이상 중 가장 가까운 관측소", () => {
    const st = [
      { code: "1", name: "a", lat: 36, lon: 129, firstYear: 2000, lastYear: 2020, nYears: 21 },
      { code: "2", name: "b", lat: 36.5, lon: 129, firstYear: 1961, lastYear: 2024, nYears: 64 },
      { code: "3", name: "c", lat: 37.5, lon: 129, firstYear: 1961, lastYear: 2024, nYears: 64 },
    ];
    expect(nearestStation(36, 129, st)!.station.code).toBe("2");
    expect(nearestStation(36, 129, st)!.distanceKm).toBeCloseTo(55.6, 0);
    expect(nearestStation(36, 129, [])).toBeNull();
  });
});
