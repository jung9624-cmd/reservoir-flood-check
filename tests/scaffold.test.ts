import { describe, expect, it } from "vitest";
import { DURATIONS_MIN } from "@/lib/types";

describe("프로젝트 뼈대", () => {
  it("지속기간은 10개 (CLAUDE.md 5-10)", () => {
    expect(DURATIONS_MIN).toEqual([60, 120, 180, 240, 360, 540, 720, 900, 1080, 1440]);
  });
});
