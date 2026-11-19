"use client";

// ⑥ 수문곡선 (Recharts): 강우(위에서 아래로) / 유입(× 할증)·방류 / 저수위. 세 그래프가 시간축(분)을 같이 쓴다
import { cloneElement, type ReactElement } from "react";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { DurationResult } from "@/lib/types";

const INK = "#1f2328", SUB = "#57606a", WATER = "#1f6fb2", GRID = "#eaeef2";
const tick = { fontSize: 13, fill: SUB };
/** 화면에서는 폭에 맞추고(ResponsiveContainer), 인쇄용 보기에서는 고정 폭으로 그린다 */
function Box({ h, width, children }: { h: number; width?: number; children: ReactElement<{ width?: number; height?: number }> }) {
  return (
    <div style={{ height: h }}>
      {width ? cloneElement(children, { width, height: h }) : <ResponsiveContainer width="100%" height="100%">{children}</ResponsiveContainer>}
    </div>
  );
}

const fmt = (v: unknown, d = 2) => (typeof v === "number" ? v.toFixed(d) : String(v));

export function FloodChart(props: {
  duration: DurationResult;
  rainMm: number[]; // 10분 강우
  factor: number;
  damCrestElM: number;
  allowedElM: number;
  spillwayCrestElM: number;
  /** 인쇄용: 고정 폭(px)과 낮은 높이 */
  width?: number;
}) {
  const { duration: d, rainMm, factor, damCrestElM, allowedElM, spillwayCrestElM, width } = props;
  const H = width ? [80, 140, 120] : [144, 224, 176];
  const end = (d.levelElM.values.length - 1) * d.levelElM.dtMin;
  // 1분 자료는 2분 간격으로 줄여 그린다(모양은 같고 점 수는 절반)
  const step = end > 600 ? 5 : 2;
  const rain = rainMm.map((v, k) => ({ t: k * 10 + 5, rain: v }));
  const inflow = d.inflowCms.values.map((v, i) => ({ t: i * d.inflowCms.dtMin, q: v })).filter((p) => p.t <= end);
  const outflow = d.outflowCms.values.map((v, i) => ({ t: i, q: v })).filter((p) => p.t % step === 0);
  const level = d.levelElM.values.map((v, i) => ({ t: i, h: v })).filter((p) => p.t % step === 0);
  const xDomain: [number, number] = [0, end];
  const ticks = Array.from({ length: Math.floor(end / (end > 600 ? 120 : 60)) + 1 }, (_, i) => i * (end > 600 ? 120 : 60));
  const x = (show: boolean) => (
    <XAxis dataKey="t" type="number" domain={xDomain} ticks={ticks} tick={show ? tick : false} height={show ? 36 : 4} allowDuplicatedCategory={false}
      label={show ? { value: "시간 (분)", position: "insideBottomRight", offset: -2, fontSize: 13, fill: SUB } : undefined} />
  );
  const yLabel = (value: string) => ({ value, angle: -90, position: "insideLeft" as const, fontSize: 13, fill: SUB, style: { textAnchor: "middle" as const } });
  const hMin = Math.min(...d.levelElM.values, spillwayCrestElM) - 0.2;
  const hMax = Math.max(damCrestElM, ...d.levelElM.values) + 0.2;

  return (
    <figure className="min-w-0" aria-label={`${d.durationMin}분 수문곡선: 최대 유입 ${d.peakInflowCms.toFixed(2)}, 최대 방류 ${d.peakOutflowCms.toFixed(2)} m³/s, 최고수위 EL.${d.maxLevelElM.toFixed(2)} (${d.timeOfMaxLevelMin}분)`}>
      <Box h={H[0]} width={width}>
          <BarChart data={rain} syncId="flood" margin={{ top: 4, right: 16, left: 8, bottom: 0 }}>
            {x(false)}
            <YAxis reversed tick={tick} width={64} label={yLabel("강우 mm/10분")} />
            <Tooltip formatter={(v) => [`${fmt(v)} mm`, "강우"]} labelFormatter={(t) => `${Number(t) - 5}~${Number(t) + 5}분`} />
            <Bar dataKey="rain" fill={WATER} fillOpacity={0.55} isAnimationActive={false} />
          </BarChart>
      </Box>
      <Box h={H[1]} width={width}>
          <LineChart syncId="flood" margin={{ top: 8, right: 16, left: 8, bottom: 0 }}>
            <CartesianGrid stroke={GRID} vertical={false} />
            {x(false)}
            <YAxis tick={tick} width={64} label={yLabel("유량 m³/s")} />
            <Tooltip formatter={(v, name) => [`${fmt(v)} m³/s`, name]} labelFormatter={(t) => `${t}분`} />
            <ReferenceLine x={d.timeOfMaxLevelMin} stroke="var(--fail)" strokeDasharray="3 3" />
            <Line data={inflow} dataKey="q" name={factor !== 1 ? `유입 × ${factor}` : "유입"} stroke={WATER} strokeWidth={2.5} dot={false} isAnimationActive={false} />
            <Line data={outflow} dataKey="q" name="방류" stroke={INK} strokeWidth={2} dot={false} isAnimationActive={false} />
          </LineChart>
      </Box>
      <Box h={H[2]} width={width}>
          <LineChart data={level} syncId="flood" margin={{ top: 8, right: 16, left: 8, bottom: 0 }}>
            <CartesianGrid stroke={GRID} vertical={false} />
            {x(true)}
            <YAxis domain={[Math.floor(hMin * 10) / 10, Math.ceil(hMax * 10) / 10]} tick={tick} width={64} tickFormatter={(v) => Number(v).toFixed(1)} label={yLabel("저수위 EL.m")} />
            <Tooltip formatter={(v) => [`EL.${fmt(v, 3)}`, "저수위"]} labelFormatter={(t) => `${t}분`} />
            <ReferenceLine y={damCrestElM} stroke={INK} label={{ value: `제정 ${damCrestElM.toFixed(2)}`, position: "insideTopRight", fontSize: 12, fill: SUB }} />
            <ReferenceLine y={allowedElM} stroke={INK} strokeDasharray="5 4" label={{ value: `허용 ${allowedElM.toFixed(2)}`, position: "insideBottomRight", fontSize: 12, fill: SUB }} />
            <ReferenceLine y={spillwayCrestElM} stroke="#8c959f" label={{ value: `마루 ${spillwayCrestElM.toFixed(2)}`, position: "insideBottomLeft", fontSize: 12, fill: SUB }} />
            <ReferenceLine x={d.timeOfMaxLevelMin} stroke="var(--fail)" strokeDasharray="3 3" label={{ value: `${d.timeOfMaxLevelMin}분 최고 ${d.maxLevelElM.toFixed(2)}`, position: "insideTopLeft", fontSize: 12, fill: INK }} />
            <Line dataKey="h" name="저수위" stroke={WATER} strokeWidth={2.5} dot={false} isAnimationActive={false} />
          </LineChart>
      </Box>
      <figcaption className="mt-1 flex flex-wrap gap-x-4 text-[13px] text-sub">
        <span><span aria-hidden="true" className="mr-1 inline-block h-0.5 w-5 bg-water align-middle" />{factor !== 1 ? `유입 × ${factor}` : "유입"} (실선 청색)</span>
        <span><span aria-hidden="true" className="mr-1 inline-block h-0.5 w-5 bg-ink align-middle" />방류 (실선 먹색)</span>
        <span>점선 세로 = 최고수위 시각 {d.timeOfMaxLevelMin}분</span>
      </figcaption>
    </figure>
  );
}
