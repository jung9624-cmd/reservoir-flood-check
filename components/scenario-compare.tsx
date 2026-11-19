// ⑧ 시나리오 비교: 기준안에서 한 가지만 바꾼 결과와 변화량. "좋다/나쁘다"는 쓰지 않고 판정은 여유고 2.0 m 기준만
import { delta, type Scenario } from "@/lib/scenarios";
import type { RunResult } from "@/lib/types";
import { VerdictBadge } from "./verdict-badge";

type Ok = Extract<RunResult, { ok: true }>;

function Signed({ v, d, unit }: { v: number; d: number; unit: string }) {
  const r = Number(v.toFixed(d));
  if (r === 0) return <span className="text-sub">0{unit}</span>;
  return (
    <span>
      <span aria-hidden="true">{r > 0 ? "▲" : "▼"}</span>
      <span className="sr-only">{r > 0 ? "늘어남" : "줄어듦"}</span> {Math.abs(r).toFixed(d)}
      {unit}
    </span>
  );
}

function Label({ s }: { s: Scenario }) {
  return (
    <td className="px-3">
      <span className="text-sub">{s.group} · </span>
      {s.change}
    </td>
  );
}

export function ScenarioCompare({ base, baseLabel, scenarios, results, pending }: {
  base: Ok;
  baseLabel: string;
  scenarios: Scenario[];
  results: (RunResult | null)[];
  pending: boolean;
}) {
  const baseCrit = base.durations.find((d) => d.durationMin === base.verdict.criticalDurationMin)!;
  return (
    <section aria-labelledby="sc-title" className="border-t border-line py-6">
      <h2 id="sc-title" className="mb-1 text-[13px] font-medium text-sub">⑧ 시나리오 비교 — 기준안에서 한 가지만 바꿨을 때</h2>
      <p className="mb-3 text-xs text-sub">▲ 늘어남 ▼ 줄어듦. 최고수위·여유고는 판정과 같게 0.01 m로 반올림한 값의 차이, 최대방류량은 임계지속기간의 값</p>
      <div className="relative overflow-x-auto">
        <table className="w-full min-w-[900px] border-collapse text-sm">
          <caption className="sr-only">시나리오별 판정, 여유고, 최고수위, 최대방류량, 임계지속기간과 기준안 대비 변화량</caption>
          <thead>
            <tr className="border-b border-line text-[13px] text-sub">
              <th scope="col" className="h-10 px-3 text-left font-medium">바꾼 것</th>
              <th scope="col" className="px-3 text-left font-medium">판정</th>
              <th scope="col" className="px-3 text-right font-medium">여유고 m (변화)</th>
              <th scope="col" className="px-3 text-right font-medium">최고수위 EL.m (변화)</th>
              <th scope="col" className="px-3 text-right font-medium">최대방류량 m³/s (변화)</th>
              <th scope="col" className="px-3 text-right font-medium">임계 분</th>
            </tr>
          </thead>
          <tbody className="num">
            <tr className="h-11 border-b border-line font-semibold shadow-[inset_4px_0_0_var(--water)]">
              <td className="px-3">기준안 · {baseLabel}</td>
              <td className="px-3"><VerdictBadge pass={base.verdict.pass} /></td>
              <td className="px-3 text-right">{base.verdict.freeboardM.toFixed(2)}</td>
              <td className="px-3 text-right">{base.verdict.maxLevelRoundedElM.toFixed(2)}</td>
              <td className="px-3 text-right">{baseCrit.peakOutflowCms.toFixed(2)}</td>
              <td className="px-3 text-right">{base.verdict.criticalDurationMin}</td>
            </tr>
            {scenarios.map((s, i) => {
              const r = results[i];
              if (!s.job || !r || !r.ok) {
                const msg = !s.job
                  ? `— ${s.note}`
                  : !r
                    ? pending ? "계산 중…" : "—"
                    : `계산할 수 없음 — ${(r as Extract<RunResult, { ok: false }>).issues.map((x) => `${x.field}: ${x.reason}`).join(", ")}`;
                return (
                  <tr key={s.id} className="h-11 border-b border-line">
                    <Label s={s} />
                    <td colSpan={5} className="px-3 text-sub">{msg}</td>
                  </tr>
                );
              }
              const dl = delta(base, r);
              const crit = r.durations.find((d) => d.durationMin === r.verdict.criticalDurationMin)!;
              return (
                <tr key={s.id} className="h-11 border-b border-line">
                  <Label s={s} />
                  <td className="px-3"><VerdictBadge pass={r.verdict.pass} /></td>
                  <td className="px-3 text-right">{r.verdict.freeboardM.toFixed(2)} <span className="ml-1 inline-block w-16 text-[13px]"><Signed v={dl.freeboardM} d={2} unit="" /></span></td>
                  <td className="px-3 text-right">{r.verdict.maxLevelRoundedElM.toFixed(2)} <span className="ml-1 inline-block w-16 text-[13px]"><Signed v={dl.maxLevelM} d={2} unit="" /></span></td>
                  <td className="px-3 text-right">{crit.peakOutflowCms.toFixed(2)} <span className="ml-1 inline-block w-20 text-[13px]"><Signed v={dl.peakOutflowPct} d={1} unit=" %" /></span></td>
                  <td className="px-3 text-right">{dl.criticalTo === dl.criticalFrom ? dl.criticalTo : <>{dl.criticalFrom} → {dl.criticalTo}</>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
