// ⑤ 제당 단면 (SVG). 계산값과 입력값만으로 그린다: 표고는 비례, 가로(제체 모양)는 비례가 아니다.
// 표고선: 제정, 최고수위, 허용 최고수위(제정 − 2.0 m), 설계 홍수위(제원), 물넘이 마루, 추가 방류시설, 사수위. 오른쪽에 여유고·기준 치수선
import { REQUIRED_FREEBOARD_M } from "@/lib/judge";

interface Line {
  key: string;
  elM: number;
  label: string;
  stroke: string;
  width: number;
  dash?: string;
  bold?: boolean;
}

export function DamSection(props: {
  damCrestElM: number;
  maxLevelElM: number; // 판정에 쓴 (반올림한) 값
  durationMin: number;
  pass: boolean;
  spillwayCrestElM: number;
  floodLevelElM: number | null;
  deadLevelElM: number | null;
  outlets: { name: string; crestElM: number }[];
}) {
  const { damCrestElM, maxLevelElM, durationMin, pass, spillwayCrestElM, floodLevelElM, deadLevelElM, outlets } = props;
  const allowed = damCrestElM - REQUIRED_FREEBOARD_M;
  const verdictColor = pass ? "var(--pass)" : "var(--fail)";
  const W = 640, H = 460, top = 40, bottom = 410;
  const FS = 17; // 그림이 줄어도 읽히도록 크게 (프로젝터)
  const low = Math.min(deadLevelElM ?? Infinity, ...outlets.map((o) => o.crestElM), spillwayCrestElM - 3);
  const lo = Math.floor(low - 0.5), hi = Math.ceil(damCrestElM + 0.6);
  const y = (h: number) => bottom - ((h - lo) / (hi - lo)) * (bottom - top);
  const freeboard = damCrestElM - maxLevelElM;

  const lines: Line[] = [
    { key: "crest", elM: damCrestElM, label: `제정 EL.${damCrestElM.toFixed(2)}`, stroke: "var(--ink)", width: 2.5, bold: true },
    { key: "max", elM: maxLevelElM, label: `최고수위 EL.${maxLevelElM.toFixed(2)} (${durationMin}분)`, stroke: verdictColor, width: 2.5, bold: true },
    {
      key: "allowed",
      elM: allowed,
      label: floodLevelElM !== null && Math.abs(floodLevelElM - allowed) < 0.005 ? `허용(제정 − 2.0) = 설계 홍수위 EL.${allowed.toFixed(2)}` : `허용 최고수위(제정 − 2.0) EL.${allowed.toFixed(2)}`,
      stroke: "var(--ink)", width: 1, dash: "5 4",
    },
    ...(floodLevelElM !== null && Math.abs(floodLevelElM - allowed) >= 0.005 && floodLevelElM > lo
      ? [{ key: "flood", elM: floodLevelElM, label: `설계 홍수위(제원) EL.${floodLevelElM.toFixed(2)}`, stroke: "#8c959f", width: 1 }]
      : []),
    { key: "spill", elM: spillwayCrestElM, label: `물넘이 마루 EL.${spillwayCrestElM.toFixed(2)}`, stroke: "var(--water)", width: 1 },
    ...outlets.map((o, i) => ({ key: `o${i}`, elM: o.crestElM, label: `${o.name} 바닥 EL.${o.crestElM.toFixed(2)}`, stroke: "#8c959f", width: 1 })),
    ...(deadLevelElM !== null && deadLevelElM >= lo ? [{ key: "dead", elM: deadLevelElM, label: `사수위 EL.${deadLevelElM.toFixed(2)}`, stroke: "#8c959f", width: 1 }] : []),
  ];

  // 라벨이 겹치지 않게 위에서부터 16 px 이상 띄운다
  const sorted = [...lines].sort((a, b) => b.elM - a.elM);
  const labelY: Record<string, number> = {};
  let prev = -Infinity;
  for (const l of sorted) {
    let ly = y(l.elM) - 5;
    if (ly < prev + FS + 3) ly = prev + FS + 3;
    labelY[l.key] = ly;
    prev = ly;
  }

  const damX = [300, 360, 390, 470];
  return (
    <figure className="min-w-0">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-labelledby="dam-title dam-desc">
        <title id="dam-title">제당 단면</title>
        <desc id="dam-desc">
          제정표고 EL.{damCrestElM.toFixed(2)}, 최고수위 EL.{maxLevelElM.toFixed(2)}, 여유고 {freeboard.toFixed(2)} m, 기준 {REQUIRED_FREEBOARD_M.toFixed(2)} m, 판정 {pass ? "적합" : "부적합"}
        </desc>
        <rect x={20} y={y(maxLevelElM)} width={damX[0] - 20 + ((damX[1] - damX[0]) * (maxLevelElM - lo)) / (damCrestElM - lo)} height={bottom - y(maxLevelElM)} fill="var(--water-tint)" />
        <polygon points={`${damX[0]},${bottom} ${damX[1]},${y(damCrestElM)} ${damX[2]},${y(damCrestElM)} ${damX[3]},${bottom}`} fill="#f6f8fa" stroke="var(--ink)" strokeWidth={1.5} />
        {lines.map((l) => (
          <g key={l.key}>
            <line x1={20} x2={damX[1]} y1={y(l.elM)} y2={y(l.elM)} stroke={l.stroke} strokeWidth={l.width} strokeDasharray={l.dash} />
            <text x={24} y={labelY[l.key]} fontSize={FS} fontWeight={l.bold ? 600 : 400} fill={l.stroke === "#8c959f" ? "var(--sub)" : l.stroke}>{l.label}</text>
          </g>
        ))}
        {/* 치수선: 여유고(최고수위 ↔ 제정)와 기준(허용 최고수위 ↔ 제정) */}
        {[
          { x: 505, from: maxLevelElM, color: verdictColor, label: `여유고 ${freeboard.toFixed(2)}`, tx: 410, anchor: "end" as const },
          { x: 525, from: allowed, color: "var(--ink)", label: `기준 ${REQUIRED_FREEBOARD_M.toFixed(2)}`, tx: 533, anchor: "start" as const },
        ].map((d) => (
          <g key={d.label} stroke={d.color} strokeWidth={1.5}>
            <line x1={d.x} x2={d.x} y1={y(damCrestElM)} y2={y(d.from)} />
            <line x1={d.x - 6} x2={d.x + 6} y1={y(damCrestElM)} y2={y(damCrestElM)} />
            <line x1={d.x - 6} x2={d.x + 6} y1={y(d.from)} y2={y(d.from)} />
            <text x={d.anchor === "end" ? d.x - 10 : d.tx} y={(y(damCrestElM) + y(d.from)) / 2 + 5} fontSize={19} fontWeight={600} fill={d.color} stroke="none" textAnchor={d.anchor}>{d.label}</text>
          </g>
        ))}
        <text x={20} y={H - 12} fontSize={14} fill="var(--sub)">세로는 표고 비례(EL.{lo}~{hi}), 가로는 비례 아님</text>
      </svg>
    </figure>
  );
}
