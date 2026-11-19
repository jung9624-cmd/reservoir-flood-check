"use client";

// 인쇄용 보기: 검토서 1장(A4 세로). 머리, 제원·입력값 표(출처 포함), 판정 띠, 단면, 수문곡선, 지속기간 표.
// 화면에도 같은 모양으로 보여 주고 "인쇄"로 브라우저 인쇄를 연다.
import type { DurationResult, RunResult, Sourced } from "@/lib/types";
import { roundTo } from "@/lib/judge";
import { DamSection } from "./dam-section";
import { FloodChart } from "./flood-chart";

type Ok = Extract<RunResult, { ok: true }>;
const n2 = (v: number) => v.toLocaleString("ko-KR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export interface PrintRow {
  label: string;
  value: string;
  source: Sourced<unknown>["source"] | { kind: "text"; text: string };
}

const srcText = (s: PrintRow["source"]) => (s.kind === "input" ? "입력" : s.kind === "auto" ? `자동 · ${s.source}` : s.text);

export function PrintSheet(props: {
  title: string;
  code: string;
  subtitle: string;
  asOf: string;
  rows: PrintRow[];
  result: Ok;
  shown: DurationResult;
  rainMm: number[];
  factor: number;
  damCrestElM: number;
  spillwayCrestElM: number;
  floodLevelElM: number | null;
  deadLevelElM: number | null;
  outlets: { name: string; crestElM: number }[];
  conditions: string;
  onClose: () => void;
}) {
  const { result: r, shown } = props;
  const v = r.verdict;
  const crit = r.durations.find((d) => d.durationMin === v.criticalDurationMin)!;
  const today = new Date().toISOString().slice(0, 10);
  const half = Math.ceil(props.rows.length / 2);
  return (
    <div>
      <div className="no-print sticky top-0 z-10 flex items-center justify-between gap-2 border-b border-line bg-white py-3">
        <p className="text-sm text-sub">인쇄용 보기 — A4 세로 1장. 인쇄 창에서 &quot;배경 그래픽&quot;을 켜면 판정 색이 함께 인쇄됩니다(색이 없어도 글자로 읽힘).</p>
        <div className="flex gap-2">
          <button type="button" className="h-9 rounded-md bg-ink px-4 text-sm text-white" onClick={() => window.print()}>인쇄</button>
          <button type="button" className="h-9 rounded-md border border-line px-3 text-sm text-ink" onClick={props.onClose}>닫기</button>
        </div>
      </div>

      <article className="print-sheet mx-auto my-4 w-[190mm] bg-white text-[10.5px] leading-[1.45] text-ink">
        <header className="flex items-end justify-between border-b-2 border-ink pb-1.5">
          <div>
            <p className="text-[9px] text-sub">농업용 저수지 치수안정성 검토서 · 200년 홍수 · 교육·연구용, 공식 판정 아님</p>
            <h1 className="text-[18px] font-bold">{props.title} <span className="num text-[12px] font-normal text-sub">{props.code}</span></h1>
            <p className="text-sub">{props.subtitle}</p>
          </div>
          <p className="num text-right text-[9px] text-sub">제원 기준일 {props.asOf}<br />작성 {today}</p>
        </header>

        <section className="mt-2 grid grid-cols-2 gap-x-4">
          {[props.rows.slice(0, half), props.rows.slice(half)].map((rows, i) => (
            <table key={i} className="w-full border-collapse">
              <tbody>
                {rows.map((row) => (
                  <tr key={row.label} className="border-b border-line">
                    <th scope="row" className="py-0.5 pr-2 text-left font-normal">{row.label}</th>
                    <td className="num py-0.5 pr-2 text-right font-medium">{row.value}</td>
                    <td className="py-0.5 text-right text-[8.5px] text-sub">{srcText(row.source)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ))}
        </section>

        <section className="mt-2.5 grid grid-cols-[30mm_1fr_1fr_1fr_1fr_1fr] border border-ink">
          <div className={`flex flex-col items-center justify-center py-1.5 text-white ${v.pass ? "bg-pass" : "bg-fail"}`}>
            <p className="text-[16px] font-bold">{v.pass ? "✓ 적합" : "✕ 부적합"}</p>
            <p className="text-[8.5px]">여유고 기준 {v.requiredM.toFixed(1)} m</p>
          </div>
          {[
            ["여유고 │ 기준", `${n2(v.freeboardM)} │ ${n2(v.requiredM)} m`],
            ["최고수위", `EL.${n2(v.maxLevelRoundedElM)}`],
            ["임계지속기간", `${v.criticalDurationMin} 분`],
            ["설계홍수량", `${n2(crit.peakInflowCms)} m³/s${props.factor !== 1 ? ` (× ${props.factor})` : ""}`],
            ["최대방류량", `${n2(crit.peakOutflowCms)} m³/s`],
          ].map(([k, val]) => (
            <div key={k} className="border-l border-line px-2 py-1">
              <p className="text-[8.5px] text-sub">{k}</p>
              <p className="num text-[13px] font-semibold">{val}</p>
            </div>
          ))}
        </section>
        <p className="mt-1 text-[9px]">{r.warnings.map((w) => `⚠ ${w.message}`).join("  ")}</p>
        <p className="text-[9px] text-sub">계산 조건: {props.conditions}</p>

        <section className="mt-2 grid grid-cols-[86mm_1fr] gap-3">
          <div>
            <p className="mb-0.5 text-[9px] font-semibold">제당 단면 · {shown.durationMin}분</p>
            <DamSection
              damCrestElM={props.damCrestElM}
              maxLevelElM={roundTo(shown.maxLevelElM, 0.01)}
              durationMin={shown.durationMin}
              pass={props.damCrestElM - roundTo(shown.maxLevelElM, 0.01) >= 2 - 1e-9}
              spillwayCrestElM={props.spillwayCrestElM}
              floodLevelElM={props.floodLevelElM}
              deadLevelElM={props.deadLevelElM}
              outlets={props.outlets}
            />
          </div>
          <div>
            <p className="mb-0.5 text-[9px] font-semibold">수문곡선 · {shown.durationMin}분</p>
            <FloodChart duration={shown} rainMm={props.rainMm} factor={props.factor} damCrestElM={props.damCrestElM} allowedElM={props.damCrestElM - 2} spillwayCrestElM={props.spillwayCrestElM} width={360} />
          </div>
        </section>

        <table className="num mt-2 w-full border-collapse">
          <thead>
            <tr className="border-b border-ink text-[9px] text-sub">
              {["지속기간 분", "확률강우량 mm", "설계홍수량 m³/s", "최대방류량 m³/s", "최고수위 EL.m", "여유고 m"].map((h, i) => <th key={h} className={`py-0.5 font-medium ${i ? "text-right" : "text-left"}`}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {r.durations.map((d) => {
              const h = roundTo(d.maxLevelElM, 0.01);
              const isCrit = d.durationMin === v.criticalDurationMin;
              return (
                <tr key={d.durationMin} className={`border-b border-line ${isCrit ? "font-bold" : ""}`}>
                  <td className="py-px">{d.durationMin}{isCrit ? " (임계)" : ""}</td>
                  <td className="text-right">{n2(d.rainfallMm)}</td>
                  <td className="text-right">{n2(d.peakInflowCms)}</td>
                  <td className="text-right">{n2(d.peakOutflowCms)}</td>
                  <td className="text-right">{n2(h)}</td>
                  <td className="text-right">{n2(props.damCrestElM - h)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <footer className="mt-2 border-t border-line pt-1 text-[8px] leading-snug text-sub">
          계산 기준: 공사 가이드라인 2019 &gt; 환경부 홍수량 산정 표준지침 2019 &gt; 농업생산기반시설 설계기준 2018 · 자료: 공공데이터포털(15044339, 15099919, 15113475, 15057210), 재난안전데이터 공유플랫폼 DSSP-IF-20290(공공누리 제3유형), 기상청 ASOS, © OpenStreetMap contributors · reservoir-flood-check · 교육·연구용, 공식 판정 아님
        </footer>
      </article>
    </div>
  );
}
