"use client";

// ⑦ 지속기간별 표 10행. 임계 행 강조, 행을 누르면(Enter·Space 포함) ⑤⑥이 그 지속기간으로 바뀐다
import type { DurationResult } from "@/lib/types";
import { roundTo } from "@/lib/judge";

const n2 = (v: number) => v.toLocaleString("ko-KR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function DurationTable({ durations, critical, selected, onSelect, damCrestElM, rounding, note }: {
  durations: DurationResult[];
  critical: number;
  selected: number;
  onSelect: (d: number) => void;
  damCrestElM: number;
  rounding: number;
  note?: React.ReactNode;
}) {
  return (
    <section aria-labelledby="dur-title" className="border-t border-line py-6">
      <h2 id="dur-title" className="mb-3 text-[13px] font-medium text-sub">⑦ 지속기간별 결과 — 행을 누르면 단면·수문곡선이 그 지속기간으로 바뀝니다</h2>
      {note && <div className="mb-3 text-sm text-ink">{note}</div>}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <caption className="sr-only">지속기간 10개의 확률강우량, 설계홍수량, 최대방류량, 최고수위, 여유고</caption>
          <thead>
            <tr className="border-b border-line text-[13px] text-sub">
              <th scope="col" className="h-10 px-3 text-left font-medium">지속기간 분</th>
              <th scope="col" className="px-3 text-right font-medium">확률강우량 mm</th>
              <th scope="col" className="px-3 text-right font-medium">설계홍수량 m³/s</th>
              <th scope="col" className="px-3 text-right font-medium">최대방류량 m³/s</th>
              <th scope="col" className="px-3 text-right font-medium">최고수위 EL.m</th>
              <th scope="col" className="px-3 text-right font-medium">여유고 m</th>
            </tr>
          </thead>
          <tbody>
            {durations.map((d) => {
              const isCrit = d.durationMin === critical;
              const isSel = d.durationMin === selected;
              const h = roundTo(d.maxLevelElM, rounding);
              return (
                <tr
                  key={d.durationMin}
                  tabIndex={0}
                  aria-selected={isSel}
                  onClick={() => onSelect(d.durationMin)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onSelect(d.durationMin);
                    } else if (e.key === "ArrowDown") {
                      e.preventDefault();
                      (e.currentTarget.nextElementSibling as HTMLElement | null)?.focus();
                    } else if (e.key === "ArrowUp") {
                      e.preventDefault();
                      (e.currentTarget.previousElementSibling as HTMLElement | null)?.focus();
                    }
                  }}
                  className={`num h-10 cursor-pointer border-b border-line hover:bg-[#f6f8fa] ${isCrit ? "font-semibold shadow-[inset_4px_0_0_var(--water)]" : ""} ${isSel ? "outline-2 -outline-offset-2 outline-water" : ""}`}
                >
                  <td className="px-3 text-left">
                    {d.durationMin}
                    {isCrit && <span className="ml-2 rounded border border-[#8c959f] px-1.5 py-px text-[11px] font-medium text-sub">임계</span>}
                    {isSel && <span className="sr-only"> (그림에 표시 중)</span>}
                  </td>
                  <td className="px-3 text-right">{n2(d.rainfallMm)}</td>
                  <td className="px-3 text-right">{n2(d.peakInflowCms)}</td>
                  <td className="px-3 text-right">{n2(d.peakOutflowCms)}</td>
                  <td className="px-3 text-right">{n2(h)}</td>
                  <td className="px-3 text-right">{n2(damCrestElM - h)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
