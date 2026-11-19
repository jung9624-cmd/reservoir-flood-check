// 11. 전국 점검: 제원 3,402곳 각각에 점검용 기본 입력을 넣어 돌린다.
// NaN·무한대 없이 끝나거나, 입력 검사가 이유를 돌려줘야 한다. 이 입력은 점검용이며 화면에는 쓰지 않는다.
// 결과(이유별 건수)는 docs/data-audit.md 9절에 옮겨 적었다. 실행: npm run test:audit (약 40초, 기본 npm test에서는 빠짐)
import { describe, expect, it } from "vitest";
import reservoirsFile from "@/data/reservoirs.json";
import { probableRainfall } from "@/lib/rainfall";
import { runAll, toPublicSpec } from "@/lib/run";
import type { ReservoirsFile, RunOptions, RunResult, UserInputs } from "@/lib/types";
import { annualMax, huff } from "./helpers/kwoni";

const file = reservoirsFile as unknown as ReservoirsFile;

// data/stations.json이 아직 비어 있어(ASOS 지점정보 없음) 가장 가까운 관측소를 고를 수 없다.
// 점검 목적(엔진이 제원 값으로 끝까지 도는지)에는 강우가 같아도 되므로 포항(138) 1961~2024 actual을 모든 저수지에 쓴다.
const rain = probableRainfall(annualMax, { timeConvention: "actual", firstYear: 1961, lastYear: 2024, returnPeriodYr: 200 });
const options: RunOptions = {
  returnPeriodYr: 200, stationCode: "138", firstYear: 1961, lastYear: 2024, timeConvention: "actual",
  huff: "khas-q3", tcKMethod: "direct", rainfallOverrideMm: rain.rainfallMm,
};

/** 점검용 기본 입력: 마루 = 만수위, 폭 10 m, 제정 = 홍수위 + 2 m, CN-Ⅲ 85, Tc·K 0.5 hr */
const auditInputs = (floodLevel: number | null): UserInputs => ({
  spillway: { widthM: 10 },
  extraOutlets: [],
  damCrestElM: (floodLevel ?? NaN) + 2,
  cn: { amc: "III", value: 85 },
  timing: { tcHr: 0.5, kHr: 0.5 },
});

function nonFinite(r: Extract<RunResult, { ok: true }>): string[] {
  const bad: string[] = [];
  for (const d of r.durations) {
    for (const [k, v] of Object.entries(d)) {
      if (typeof v === "number" && !Number.isFinite(v)) bad.push(`${d.durationMin}분 ${k}`);
      if (v && typeof v === "object" && "values" in v && !(v.values as number[]).every(Number.isFinite)) bad.push(`${d.durationMin}분 ${k}[]`);
    }
  }
  for (const [k, v] of Object.entries(r.verdict)) if (typeof v === "number" && !Number.isFinite(v)) bad.push(`verdict.${k}`);
  return bad;
}

describe("11. 전국 점검 (제원 3,402곳, 점검용 기본 입력)", () => {
  it("모두 유한값으로 끝나거나 입력 검사 이유를 돌려준다", { timeout: 600_000 }, () => {
    let okCount = 0;
    const blocked: string[] = [];
    const byReason = new Map<string, number>();
    const warnCount = new Map<string, number>();
    const broken: { code: string; bad: string[] }[] = [];
    const t0 = Date.now();

    for (const r of file.reservoirs) {
      const res = runAll(toPublicSpec(r, file.asOf), auditInputs(r.floodLevelElM), options, { huff });
      if (!res.ok) {
        expect(res.issues.length).toBeGreaterThan(0);
        blocked.push(r.code);
        // 같은 저수지에서 같은 이유가 여러 번 나와도 1곳으로 센다
        for (const key of new Set(res.issues.map((i) => `${i.field} | ${i.reason.replace(/EL\.[\d.]+/g, "EL.x")}`))) byReason.set(key, (byReason.get(key) ?? 0) + 1);
        continue;
      }
      okCount++;
      for (const code of new Set(res.warnings.map((w) => w.code))) warnCount.set(code, (warnCount.get(code) ?? 0) + 1);
      const bad = nonFinite(res);
      if (bad.length) broken.push({ code: r.code, bad });
    }

    const sorted = [...byReason].sort((a, b) => b[1] - a[1]);
    console.log(
      `\n[전국 점검] ${file.reservoirs.length}곳, 계산 완료 ${okCount}, 입력 검사로 멈춤 ${blocked.length}, 비유한값 ${broken.length}, ${((Date.now() - t0) / 1000).toFixed(1)} s\n` +
        `이유별 (저수지 수):\n${sorted.map(([k, n]) => `  ${n}\t${k}`).join("\n")}\n` +
        `경고별 (계산 완료 중):\n${[...warnCount].map(([k, n]) => `  ${n}\t${k}`).join("\n")}\n` +
        (broken.length ? `비유한값: ${JSON.stringify(broken.slice(0, 20))}\n` : ""),
    );
    expect(broken).toEqual([]);
    expect(okCount + blocked.length).toBe(file.reservoirs.length);
  });
});
