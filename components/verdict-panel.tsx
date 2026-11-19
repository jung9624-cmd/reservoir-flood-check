// ④ 판정 띠: 적합/부적합, 여유고 │ 기준 2.0 m, 최고수위, 임계지속기간, 설계홍수량, 최대방류량 (design/wireframe.md ④)
import type { DurationResult, RunWarning, Verdict } from "@/lib/types";
import { Help } from "./help";

const n2 = (v: number) => v.toLocaleString("ko-KR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function Cell({ label, children, sub, wide }: { label: React.ReactNode; children: React.ReactNode; sub?: React.ReactNode; wide?: boolean }) {
  return (
    <div className={`flex flex-col justify-center gap-0.5 border-t border-line px-5 py-3 lg:border-t-0 lg:border-l ${wide ? "col-span-2 lg:col-span-1" : ""}`}>
      <p className="flex items-center gap-1 text-[13px] font-medium text-sub">{label}</p>
      <div className="num text-[26px] leading-tight font-semibold text-ink">{children}</div>
      {sub && <p className="text-[13px] text-sub">{sub}</p>}
    </div>
  );
}

export function VerdictPanel({ verdict, critical, factor, warnings, conditions }: {
  verdict: Verdict;
  critical: DurationResult;
  factor: number;
  warnings: RunWarning[];
  conditions: string;
}) {
  const diff = verdict.freeboardM - verdict.requiredM;
  return (
    <section aria-labelledby="verdict-title" className="border-t border-line py-6">
      <h2 id="verdict-title" className="sr-only">④ 판정</h2>
      <div className="grid grid-cols-2 rounded-lg border border-ink lg:grid-cols-[12rem_minmax(15rem,1.5fr)_repeat(4,minmax(0,1fr))]">
        <div className={`col-span-2 flex flex-col items-center justify-center gap-1 rounded-t-[7px] px-4 py-4 text-white lg:col-span-1 lg:rounded-l-[7px] lg:rounded-tr-none ${verdict.pass ? "bg-pass" : "bg-fail"}`}>
          <p className="text-[30px] leading-none font-bold" aria-live="polite">
            <span aria-hidden="true">{verdict.pass ? "✓ " : "✕ "}</span>
            {verdict.pass ? "적합" : "부적합"}
          </p>
          <p className="text-[13px]">여유고 기준 {verdict.requiredM.toFixed(1)} m</p>
        </div>
        <Cell wide label={<>여유고 │ 기준 <Help k="freeboard" /></>} sub={<span className={`font-semibold ${verdict.pass ? "text-ink" : "text-fail"}`}>{diff >= 0 ? "+" : "−"}{n2(Math.abs(diff))} m {verdict.pass ? "여유" : "모자람"}</span>}>
          <span className="whitespace-nowrap"><span className="text-[34px]">{n2(verdict.freeboardM)}</span>
          <span aria-hidden="true" className="mx-2 font-light text-[#8c959f]">│</span>
          <span className="text-[34px]">{n2(verdict.requiredM)}</span> <span className="text-[15px] font-normal text-sub">m</span></span>
        </Cell>
        <Cell label="최고수위" sub={`반올림 전 ${verdict.maxLevelElM.toFixed(3)}`}>EL.{n2(verdict.maxLevelRoundedElM)}</Cell>
        <Cell label={<>임계지속기간 <Help k="critical" /></>}>{verdict.criticalDurationMin} <span className="text-sm font-normal text-sub">분</span></Cell>
        <Cell label={<>설계홍수량 <Help k="factor" /></>} sub={factor !== 1 ? `m³/s · 필댐 × ${factor}` : "m³/s · 할증 없음"}>{n2(critical.peakInflowCms)}</Cell>
        <Cell label="최대방류량" sub="m³/s">{n2(critical.peakOutflowCms)}</Cell>
      </div>
      <ul className="mt-3 space-y-1 text-sm text-ink">
        {warnings.map((w) => (
          <li key={w.code}><span aria-hidden="true">⚠ </span>{w.message}</li>
        ))}
        <li className="text-sub">계산 조건: {conditions}</li>
      </ul>
    </section>
  );
}
