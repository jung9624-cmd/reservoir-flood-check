// 화면 쪽 순수 함수: 입력 폼 해석(lib/draft), 시나리오(lib/scenarios), 저장 형식(lib/saved)
import { describe, expect, it } from "vitest";
import { draftToInputs, emptyDraft, parseStorageTable } from "@/lib/draft";
import { buildScenarios, delta, levelForRate } from "@/lib/scenarios";
import { importAll } from "@/lib/saved";
import { runAll } from "@/lib/run";
import { huff, inputs, optionsReport, spec, storageTable } from "./helpers/kwoni";

describe("설계 내용적표 붙여넣기", () => {
  it("엑셀 탭 구분, 천 단위 쉼표, 머리글 한 줄", () => {
    const r = parseStorageTable("표고\t저수량\n154.0\t0\n165.9\t550,007\n");
    expect(r.error).toBeNull();
    expect(r.points).toEqual([{ levelElM: 154, storageM3: 0 }, { levelElM: 165.9, storageM3: 550007 }]);
  });
  it("공백·쉼표 구분도 읽고, 읽을 수 없는 줄은 이유를 돌려준다", () => {
    expect(parseStorageTable("154 0\n155 9203").points).toHaveLength(2);
    expect(parseStorageTable("154,0\n155,9203").points).toHaveLength(2);
    expect(parseStorageTable("154\t0\nabc\t1").error).toMatch(/2째 줄/);
  });
});

describe("입력 폼 → 계산 입력", () => {
  it("빈 필수 칸은 missing, 숫자가 아니면 errors, 그때는 inputs = null", () => {
    const r = draftToInputs({ ...emptyDraft(), spillwayWidthM: "abc", cnValue: "85" });
    expect(r.inputs).toBeNull();
    expect(r.errors.spillwayWidthM).toBe("숫자가 아닙니다");
    expect(r.missing.map((m) => m.label)).toEqual(expect.arrayContaining(["제정표고", "Tc", "K"]));
  });
  it("마루표고·유량계수를 비우면 undefined(계산에서 만수위·2.0), 추가 방류시설 C 기본 2.0", () => {
    const r = draftToInputs({
      ...emptyDraft(), spillwayWidthM: "61", damCrestElM: "169.1", cnValue: "89", tcHr: "0.26", kHr: "0.2",
      extraOutlets: [{ name: "비상수문", widthM: "4", crestElM: "164.4", coefficient: "", open: true }],
    });
    expect(r.inputs!.spillway).toEqual({ widthM: 61, crestElM: undefined, coefficient: undefined });
    expect(r.inputs!.extraOutlets[0].coefficient).toBe(2.0);
  });
  it("제원 대신 입력값은 specOverrides로", () => {
    const r = draftToInputs({ ...emptyDraft(), specOverrides: { fullAreaHa: "9.9", damType: "필댐(존형)" } });
    expect(r.specOverrides).toEqual({ fullAreaHa: 9.9, damType: "필댐(존형)" });
  });
});

describe("시나리오", () => {
  const base = { spec, inputs, options: optionsReport };
  const res = runAll(spec, inputs, optionsReport, { huff });
  it("2025 홍수기 최대 40 % → 설계표에서 EL.161.61", () => {
    expect(levelForRate(base, 40, 550, 0)).toBeCloseTo(161.615, 2);
    expect(storageTable.length).toBe(17);
  });
  it("현재 수위가 없으면 계산하지 않고 이유를 단다. 보고서 강우(override)면 자료기간·시각·재현기간 시나리오는 없다", () => {
    const s = buildScenarios(base, { stationRange: { firstYear: 1961, lastYear: 2024 }, currentLevelElM: null, currentLevelNote: "인증키 없음", floodSeasonMaxPct: 40, effectiveStorageThousandM3: 550, deadStorageThousandM3: 0, hasSeokyeongInputs: false });
    expect(s.find((x) => x.id === "init-now")).toMatchObject({ job: null, note: "현재 수위 없음 — 인증키 없음" });
    expect(s.map((x) => x.group)).not.toContain("자료기간");
    expect(s.find((x) => x.id === "tck")!.job).toBeNull();
  });
  it("변화량: 같은 결과면 0", () => {
    if (!res.ok) throw new Error();
    expect(delta(res, res)).toEqual({ maxLevelM: 0, freeboardM: 0, peakOutflowPct: 0, criticalFrom: 120, criticalTo: 120 });
  });
});

describe("입력값 불러오기", () => {
  it("이 웹앱의 JSON이 아니면 이유", () => {
    expect(importAll("{}").error).toMatch(/이 웹앱/);
    expect(importAll("not json").error).toMatch(/읽을 수 없/);
  });
});

describe("자료 신뢰도 · 용어 도움말", () => {
  it("홍수위 − 만수위가 정확히 0.5·1.0 m면 대표값 표시, 권이(1.2 m)는 아님", async () => {
    const { isRoundFloodMargin } = await import("@/lib/reliability");
    expect(isRoundFloodMargin(101.5, 101)).toBe(0.5);
    expect(isRoundFloodMargin(43.1, 42.1)).toBe(1);
    expect(isRoundFloodMargin(167.1, 165.9)).toBeNull();
    expect(isRoundFloodMargin(null, 165.9)).toBeNull();
  });
  it("용어 10개 모두 한 줄 정의와 근거 문서", async () => {
    const { GLOSSARY } = await import("@/lib/glossary");
    const terms = Object.values(GLOSSARY);
    expect(terms).toHaveLength(10);
    for (const t of terms) {
      expect(t.definition.length).toBeGreaterThan(10);
      expect(t.basis.length).toBeGreaterThan(5);
    }
  });
  it("홍수조절 미고려 안내 문구", () => {
    const r = runAll(spec, inputs, optionsReport, { huff });
    expect(r.ok && r.warnings.find((w) => w.code === "floodControlNotConsidered")?.message).toMatch(/^설계기준 제5편 8\.2\.1 홍수조절 미고려 대상 — 물넘이 설계유량은 유입량 기준 검토 필요/);
  });
});

describe("가까운 관측소 (data/stations.json)", () => {
  it("권이 좌표에서 가장 가까운 30년 이상 관측소는 포항(138)", async () => {
    const { nearestStation } = await import("@/lib/station");
    const file = (await import("@/data/stations.json")).default as { stations: import("@/lib/types").Station[] };
    expect(file.stations).toHaveLength(92);
    const n = nearestStation(35.856391, 129.435537, file.stations, 30)!;
    expect(n.station.code).toBe("138");
    expect(n.station.name).toBe("포항");
    expect(n.distanceKm).toBeGreaterThan(15);
    expect(n.distanceKm).toBeLessThan(25);
  });
});
