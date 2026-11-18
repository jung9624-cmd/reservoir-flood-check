import { describe, expect, it } from "vitest";
import { getReservoir, listReservoirs, specAsOf } from "@/lib/data";
import huff from "@/data/huff/khas-q3.json";
import pohang from "@/data/rainfall/annual-max/138.json";
import coords from "@/data/coords.json";
import storage from "@/data/storage-2025.json";

// scripts/preprocess.py가 만든 data/ JSON 확인 (값은 docs/data-audit.md와 대조)
describe("data/ JSON", () => {
  it("A 제원: 3,402곳, 기준일 2026-09-07", () => {
    expect(listReservoirs()).toHaveLength(3402);
    expect(specAsOf).toBe("2026-09-07");
  });

  it("A 권이 제원 (CLAUDE.md 6.2)", () => {
    const k = getReservoir("4713010226")!;
    expect(k.spec.name).toBe("권이");
    expect(k.spec.catchmentHa).toBe(640);
    expect(k.spec.fullLevelElM).toBe(165.9);
    expect(k.spec.floodLevelElM).toBe(167.1);
    expect(k.spec.deadLevelElM).toBe(154);
    expect(k.spec.totalStorageThousandM3).toBe(550);
    expect(k.spec.fullAreaHa).toBe(9.9);
    expect(k.spec.flags).toEqual([]);
  });

  it("A 플래그: 홍수위 ≤ 만수위 36곳 (15 + 21)", () => {
    expect(listReservoirs().filter((r) => r.spec.flags.includes("floodLevelNotAboveFull"))).toHaveLength(36);
  });

  it("B 좌표: 공유플랫폼 1,183곳 + 근사 2,219곳, 권이 6자리", () => {
    expect(coords.count).toBe(3402);
    expect(coords.coords.filter((c) => c.source === "safetydata")).toHaveLength(1183);
    const approx = coords.coords.filter((c) => c.source === "approx");
    expect(approx).toHaveLength(2219);
    for (const c of approx) {
      // 국내 범위
      expect(c.lat).toBeGreaterThan(33);
      expect(c.lat).toBeLessThan(39);
      expect(c.lon).toBeGreaterThan(124);
      expect(c.lon).toBeLessThan(132);
    }
    expect(getReservoir("4713010226")!.coord).toMatchObject({ lat: 35.856391, lon: 129.435537, decimals: 6 });
  });

  it("C 저수율: 3,317곳 연결, 0~100 %", () => {
    expect(storage.count).toBe(3317);
    for (const it of storage.items) {
      if (it.floodSeasonMaxPct !== null) expect(it.floodSeasonMaxPct).toBeLessThanOrEqual(100);
    }
  });

  it("D 포항(138): 두 시각 배치, 1961~2024", () => {
    for (const conv of [pohang.actual, pohang.khas]) {
      expect(conv.years[0]).toBe(1961);
      expect(conv.years.at(-1)).toBe(2024);
      expect(conv.valuesMm[0]).toHaveLength(10);
    }
    // 보고서 표 3.9: 1961년 1시간 43.0 mm
    expect(pohang.khas.valuesMm[0][0]).toBeCloseTo(43.0, 3);
  });

  it("E Huff: 101점, 합계 100 %, 10 % 누가값이 CLAUDE.md 5-3과 같음", () => {
    expect(huff.timePct).toHaveLength(101);
    expect(huff.sumPct).toBeCloseTo(100, 3);
    const tenths = [10, 20, 30, 40, 50, 60, 70, 80, 90].map((k) => Math.round(huff.cumulativePct[k] * 10) / 10);
    expect(tenths).toEqual([1.6, 6.5, 14.7, 26.6, 42.3, 61.7, 80.8, 93.8, 99.1]);
  });
});
