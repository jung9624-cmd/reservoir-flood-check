import { describe, expect, it } from "vitest";
import { haToKm2, haToM2, hrToMin, km2ToHa, minToHr, minToSec, thousandM3ToM3 } from "@/lib/units";

describe("단위 변환 (docs/calc-rules.md 6절)", () => {
  it("권이 유역 640 ha = 6.40 km²", () => {
    expect(haToKm2(640)).toBeCloseTo(6.4, 12);
    expect(km2ToHa(6.4)).toBeCloseTo(640, 12);
  });
  it("권이 만수면적 9.9 ha = 99,000 m², 총저수량 550 천m³ = 550,000 m³", () => {
    expect(haToM2(9.9)).toBeCloseTo(99_000, 9);
    expect(thousandM3ToM3(550)).toBe(550_000);
  });
  it("권이 Tc 0.26 hr = 15.6분, K 0.20 hr = 12분", () => {
    expect(hrToMin(0.26)).toBeCloseTo(15.6, 12);
    expect(hrToMin(0.2)).toBeCloseTo(12, 12);
    expect(minToHr(90)).toBe(1.5);
    expect(minToSec(10)).toBe(600);
  });
});
