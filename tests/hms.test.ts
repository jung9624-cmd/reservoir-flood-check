// HEC-HMS 교차검증 (docs/hms/README.md)
// 1) scripts/export_hms.py가 만든 docs/hms/*.csv가 웹앱 계산식(lib/)과 같은지
// 2) ../Reference/05_HEC-HMS/kwoni_120min_hms_*.csv가 있으면 웹앱 120분 결과와 비교 (없으면 건너뜀)
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { huffHyetograph } from "@/lib/hyetograph";
import { outflowCms } from "@/lib/routing";
import { runAll, DEFAULT_SPILLWAY_COEFFICIENT } from "@/lib/run";
import { storageFromTable } from "@/lib/storage";
import type { Outlet } from "@/lib/types";
import { huff, inputs, kwoni, optionsReport, pct, spec, storageTable } from "./helpers/kwoni";

const ROOT = resolve(__dirname, "..");
const HMS_DIR = process.env.HMS_DIR ?? resolve(ROOT, "..", "Reference", "05_HEC-HMS"); // HMS_DIR로 바꿀 수 있다(테스트용)

function readCsv(path: string): Record<string, number>[] {
  const [head, ...lines] = readFileSync(path, "utf-8").replace(/^﻿/, "").trim().split(/\r?\n/);
  const cols = head.split(",").map((c) => c.trim());
  return lines.filter((l) => l.trim()).map((l) => Object.fromEntries(l.split(",").map((v, i) => [cols[i], Number(v)])));
}

const res = runAll(spec, inputs, optionsReport, { huff });
if (!res.ok) throw new Error(JSON.stringify(res.issues));
const web120 = res.durations.find((d) => d.durationMin === 120)!;
const tol = kwoni.check2_routing.tolerance;

describe("docs/hms 내보내기 = 웹앱 계산식", () => {
  const p120 = kwoni.check1_probableRainfall200.rainfall_mm[1];

  it("10분 강우 = huffHyetograph(127.82 mm, 120분)", () => {
    const csv = readCsv(resolve(ROOT, "docs/hms/kwoni_120min_rain.csv"));
    const ts = huffHyetograph(p120, 120, huff).values;
    expect(csv.map((r) => r.end_min)).toEqual(ts.map((_, k) => (k + 1) * 10));
    csv.forEach((r, k) => expect(r.rain_mm).toBeCloseTo(ts[k], 5));
  });

  it("유입 수문곡선(× 1.2) = 웹앱 120분 유입", () => {
    const csv = readCsv(resolve(ROOT, "docs/hms/kwoni_120min_inflow.csv"));
    expect(csv).toHaveLength(web120.inflowCms.values.length);
    csv.forEach((r, i) => {
      expect(r.time_min).toBe(i * 10);
      expect(r.inflow_x1_2_cms).toBeCloseTo(web120.inflowCms.values[i], 5);
    });
  });

  it("표고-저류량-방류량 = storageFromTable + outflowCms", () => {
    const csv = readCsv(resolve(ROOT, "docs/hms/kwoni_esd.csv"));
    const curve = storageFromTable(storageTable);
    const outlets: Outlet[] = [
      { name: "물넘이", widthM: inputs.spillway.widthM, crestElM: inputs.spillway.crestElM!, coefficient: inputs.spillway.coefficient ?? DEFAULT_SPILLWAY_COEFFICIENT, open: true },
      ...inputs.extraOutlets,
    ];
    expect(csv[0].elevation_m).toBe(154);
    expect(csv.at(-1)!.elevation_m).toBeGreaterThan(inputs.damCrestElM);
    for (const r of csv) {
      expect(r.storage_m3).toBeCloseTo(curve.storageAt(r.elevation_m), 2);
      expect(r.discharge_cms).toBeCloseTo(outflowCms(r.elevation_m, outlets), 5);
    }
  });
});

const hmsFiles = existsSync(HMS_DIR) ? readdirSync(HMS_DIR).filter((f) => /^kwoni_120min_hms.*\.csv$/i.test(f)) : [];

describe.skipIf(hmsFiles.length === 0)(`HEC-HMS 결과 vs 웹앱 120분 (${HMS_DIR})`, () => {
  it.each(hmsFiles)("%s", (f) => {
    const rows = readCsv(resolve(HMS_DIR, f));
    for (const c of ["time_min", "inflow_cms", "outflow_cms", "elevation_m"]) {
      expect(rows.every((r) => Number.isFinite(r[c])), `${f}: ${c} 열이 없거나 숫자가 아님`).toBe(true);
    }
    const hms = {
      peakInflow: Math.max(...rows.map((r) => r.inflow_cms)),
      peakOutflow: Math.max(...rows.map((r) => r.outflow_cms)),
      maxLevel: Math.max(...rows.map((r) => r.elevation_m)),
    };
    const web = { peakInflow: web120.peakInflowCms, peakOutflow: web120.peakOutflowCms, maxLevel: web120.maxLevelElM };
    console.log(
      `\n[HMS ${f}]\n| 항목 | HEC-HMS | 웹앱 | 차이 |\n|---|---|---|---|\n` +
        `| 첨두 유입 (m³/s) | ${hms.peakInflow.toFixed(2)} | ${web.peakInflow.toFixed(2)} | ${pct(hms.peakInflow, web.peakInflow).toFixed(2)} % |\n` +
        `| 최대방류 (m³/s) | ${hms.peakOutflow.toFixed(2)} | ${web.peakOutflow.toFixed(2)} | ${pct(hms.peakOutflow, web.peakOutflow).toFixed(2)} % |\n` +
        `| 최고수위 (EL.m) | ${hms.maxLevel.toFixed(3)} | ${web.maxLevel.toFixed(3)} | ${(hms.maxLevel - web.maxLevel).toFixed(3)} m |\n`,
    );
    expect(Math.abs(pct(hms.peakInflow, web.peakInflow))).toBeLessThan(tol.flow_pct);
    expect(Math.abs(pct(hms.peakOutflow, web.peakOutflow))).toBeLessThan(tol.flow_pct);
    expect(Math.abs(hms.maxLevel - web.maxLevel)).toBeLessThanOrEqual(tol.level_m);
  });
});
