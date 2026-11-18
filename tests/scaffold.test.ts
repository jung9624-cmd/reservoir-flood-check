import { describe, expect, it } from "vitest";
import { getReservoir, listReservoirs } from "@/lib/data";
import { conversionFactor } from "@/lib/rainfall";
import { NotImplementedError } from "@/lib/not-implemented";
import { DURATIONS_MIN } from "@/lib/types";

describe("프로젝트 뼈대", () => {
  it("data/ 자리표시 JSON을 읽는다 (아직 비어 있음)", () => {
    expect(listReservoirs()).toEqual([]);
    expect(getReservoir("4713010226")).toBeNull();
  });
  it("지속기간은 10개 (CLAUDE.md 5-10)", () => {
    expect(DURATIONS_MIN).toEqual([60, 120, 180, 240, 360, 540, 720, 900, 1080, 1440]);
  });
  it("계산식은 아직 미구현이라 호출하면 NotImplementedError", () => {
    expect(() => conversionFactor(1)).toThrow(NotImplementedError);
  });
});
