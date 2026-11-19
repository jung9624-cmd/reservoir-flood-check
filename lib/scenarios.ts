// 시나리오 비교: 기준안에서 한 가지만 바꾼 계산 목록과 기준안 대비 변화량. 순수 함수, React와 무관.
// 화면에는 "좋다/나쁘다"를 붙이지 않고 판정은 여유고 2.0 m 기준만 쓴다 (CLAUDE.md 7).
import { storageFromSpec, storageFromTable, levelForStorage } from "./storage";
import type { PublicSpec, RunOptions, RunResult, UserInputs } from "./types";
import { applySpecOverrides } from "./spec";
import { thousandM3ToM3 } from "./units";

export interface ScenarioJob {
  spec: PublicSpec;
  inputs: UserInputs;
  options: RunOptions;
}

export interface Scenario {
  id: string;
  group: string; // 초기수위, 자료기간, …
  change: string; // 바꾼 것
  job: ScenarioJob | null; // null이면 계산할 수 없음
  note?: string; // 계산할 수 없는 이유
}

export interface ScenarioContext {
  stationRange: { firstYear: number; lastYear: number } | null;
  currentLevelElM: number | null; // 수위 API
  currentLevelNote: string; // 없을 때 이유
  floodSeasonMaxPct: number | null; // 2025 홍수기 최대 저수율
  effectiveStorageThousandM3: number | null;
  deadStorageThousandM3: number | null;
  /** 서경대 공식 입력(L, 최원점 표고)이 있는가 */
  hasSeokyeongInputs: boolean;
}

/** 저수율(%) → 표고. 저수량 = 사수량 + 저수율 × 유효저수량 (곡선은 만수위에서 총저수량이 되도록 맞춰져 있다) */
export function levelForRate(job: ScenarioJob, ratePct: number, effTh: number, deadTh: number): number | null {
  const s = applySpecOverrides(job.spec, job.inputs.specOverrides);
  const table = job.inputs.storageTable;
  const curve = table && table.length >= 2
    ? storageFromTable(table)
    : s.fullLevelElM !== null && s.deadLevelElM !== null && s.totalStorageThousandM3 && s.fullAreaHa
      ? storageFromSpec({ fullLevelElM: s.fullLevelElM, deadLevelElM: s.deadLevelElM, totalStorageThousandM3: s.totalStorageThousandM3, fullAreaHa: s.fullAreaHa, asOf: s.asOf })
      : null;
  if (!curve || s.fullLevelElM === null) return null;
  return levelForStorage(curve, thousandM3ToM3(deadTh + (ratePct / 100) * effTh), s.fullLevelElM);
}

export function buildScenarios(base: ScenarioJob, ctx: ScenarioContext): Scenario[] {
  const o = base.options;
  const withOpt = (p: Partial<RunOptions>): ScenarioJob => ({ ...base, options: { ...o, ...p } });
  const out: Scenario[] = [];

  // 초기수위
  out.push(
    ctx.currentLevelElM !== null
      ? { id: "init-now", group: "초기수위", change: `현재 수위 EL.${ctx.currentLevelElM.toFixed(2)} (수위 API)`, job: withOpt({ initialLevelElM: ctx.currentLevelElM }) }
      : { id: "init-now", group: "초기수위", change: "현재 수위", job: null, note: `현재 수위 없음 — ${ctx.currentLevelNote}` },
  );
  if (ctx.floodSeasonMaxPct !== null && ctx.effectiveStorageThousandM3) {
    const h = levelForRate(base, ctx.floodSeasonMaxPct, ctx.effectiveStorageThousandM3, ctx.deadStorageThousandM3 ?? 0);
    out.push(
      h !== null
        ? { id: "init-2025", group: "초기수위", change: `2025 홍수기 최대 저수율 ${ctx.floodSeasonMaxPct.toFixed(1)} % → EL.${h.toFixed(2)}`, job: withOpt({ initialLevelElM: h }) }
        : { id: "init-2025", group: "초기수위", change: "2025 홍수기 최대", job: null, note: "내용적 곡선이 없어 표고로 바꿀 수 없습니다" },
    );
  } else {
    out.push({ id: "init-2025", group: "초기수위", change: "2025 홍수기 최대", job: null, note: "2025 저수율 자료와 연결되지 않은 저수지입니다" });
  }

  // 자료기간: 최근 30년 / 보고서 기간(1961~2022)
  if (!o.rainfallOverrideMm && ctx.stationRange) {
    const { firstYear, lastYear } = ctx.stationRange;
    const cand: [number, number, string][] = [[Math.max(firstYear, lastYear - 29), lastYear, "최근 30년"], [Math.max(firstYear, 1961), Math.min(lastYear, 2022), "~2022"]];
    for (const [a, b, why] of cand) {
      if (a === o.firstYear && b === o.lastYear) continue;
      if (b - a + 1 < 10) continue;
      out.push({ id: `period-${a}-${b}`, group: "자료기간", change: `${a}~${b} (${why})`, job: withOpt({ firstYear: a, lastYear: b }) });
    }
  }

  // 시각 방식
  if (!o.rainfallOverrideMm) {
    const other = o.timeConvention === "actual" ? "khas" : "actual";
    out.push({ id: "time", group: "시각 방식", change: other === "khas" ? "K-HAS 방식 (H24를 하루 끝으로)" : "실제 시각", job: withOpt({ timeConvention: other }) });
  }

  // Tc·K 방식
  if (o.tcKMethod === "direct") {
    out.push(
      ctx.hasSeokyeongInputs
        ? { id: "tck", group: "Tc·K 방식", change: "서경대 공식 (α 1.45)", job: withOpt({ tcKMethod: "seokyeong" }) }
        : { id: "tck", group: "Tc·K 방식", change: "서경대 공식", job: null, note: "유로연장·최원점 표고를 입력하면 계산합니다" },
    );
  } else if (base.inputs.timing.tcHr && base.inputs.timing.kHr) {
    out.push({ id: "tck", group: "Tc·K 방식", change: "Tc·K 직접 입력값", job: withOpt({ tcKMethod: "direct" }) });
  }

  // 재현기간
  if (!o.rainfallOverrideMm) {
    const T = o.returnPeriodYr === 200 ? 100 : 200;
    out.push({ id: "T", group: "재현기간", change: `${T}년`, job: withOpt({ returnPeriodYr: T }) });
  }
  return out;
}

export interface Delta {
  maxLevelM: number; // 반올림한 최고수위 차이
  freeboardM: number;
  peakOutflowPct: number;
  criticalFrom: number;
  criticalTo: number;
}

/** 기준안 대비 변화량 (판정과 같은 반올림 값으로 비교) */
export function delta(base: Extract<RunResult, { ok: true }>, s: Extract<RunResult, { ok: true }>): Delta {
  const crit = (r: typeof base) => r.durations.find((d) => d.durationMin === r.verdict.criticalDurationMin)!;
  return {
    maxLevelM: s.verdict.maxLevelRoundedElM - base.verdict.maxLevelRoundedElM,
    freeboardM: s.verdict.freeboardM - base.verdict.freeboardM,
    peakOutflowPct: (crit(s).peakOutflowCms / crit(base).peakOutflowCms - 1) * 100,
    criticalFrom: base.verdict.criticalDurationMin,
    criticalTo: s.verdict.criticalDurationMin,
  };
}
