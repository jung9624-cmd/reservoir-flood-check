import { describe, expect, it } from "vitest";
import kwoni from "@/tests/fixtures/kwoni-report.json";
import { DURATIONS_MIN } from "@/lib/types";

// 권이 검증값이 CLAUDE.md 6절과 같은지 (계산 검증 아님, 자료 확인)
describe("tests/fixtures/kwoni-report.json", () => {
  it("입력값 (CLAUDE.md 6.1)", () => {
    expect(kwoni.code).toBe("4713010226");
    expect(kwoni.inputs.spillway).toEqual({ width_m: 61.0, crest_el: 165.9, coefficient: 2.05 });
    expect(kwoni.inputs.emergencyGate.width_m).toBe(4.0);
    expect(kwoni.inputs.emergencyGate.crest_el).toBe(164.4);
    expect(kwoni.inputs.damCrest_el).toBe(169.1);
    expect(kwoni.inputs.cn).toEqual({ amc: "III", value: 89.0 });
    expect([kwoni.inputs.tc_hr, kwoni.inputs.k_hr]).toEqual([0.26, 0.2]);
  });

  it("설계 내용적표 17행, 표고 오름차순, 저수량 증가 (CLAUDE.md 6.3)", () => {
    const t = kwoni.storageTable;
    expect(t).toHaveLength(17);
    expect(t[0]).toEqual({ level_el: 154.0, storage_m3: 0 });
    expect(t.at(-1)).toEqual({ level_el: 168.5, storage_m3: 842962 });
    for (let i = 1; i < t.length; i++) {
      expect(t[i].level_el).toBeGreaterThan(t[i - 1].level_el);
      expect(t[i].storage_m3).toBeGreaterThan(t[i - 1].storage_m3);
    }
  });

  it("검증값 1: 지속기간 10개 확률강우량 (CLAUDE.md 6.4)", () => {
    expect(kwoni.check1_probableRainfall200.duration_min).toEqual([...DURATIONS_MIN]);
    expect(kwoni.check1_probableRainfall200.rainfall_mm).toHaveLength(10);
  });

  it("검증값 2: 임계 120분, 최고수위 167.10, 여유고 2.00 (CLAUDE.md 6.5)", () => {
    const critical = kwoni.check2_routing.rows.filter((r) => r.critical);
    expect(critical).toHaveLength(1);
    expect(critical[0].duration_min).toBe(120);
    expect(critical[0].maxLevel_el).toBe(167.1);
    expect(kwoni.inputs.damCrest_el - critical[0].maxLevel_el).toBeCloseTo(kwoni.check2_routing.freeboard_m, 9);
  });
});
