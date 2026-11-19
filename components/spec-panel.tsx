"use client";

// ② 제원 (자동). 값마다 출처 배지. 제원 값이 이상하면 경고와 "직접 입력" 칸 (design/wireframe.md ②, lib/spec.ts)
import type { ReservoirRecord } from "@/lib/data";
import type { SpecOverrideField, ValidationIssue } from "@/lib/types";
import { SPEC_FIELD_LABEL } from "@/lib/spec";
import { isRoundFloodMargin } from "@/lib/reliability";
import type { WaterLevelState } from "@/hooks/use-remote";
import { auto, INPUT, SourceBadge } from "./source-badge";

const FLAG_TEXT: Record<string, string> = {
  floodLevelNotAboveFull: "홍수위가 만수위보다 높지 않습니다",
  fullLevelNotAboveDead: "만수위가 사수위보다 높지 않습니다",
  zeroLevel: "수위 값이 0입니다",
  negativeDeadLevel: "사수위가 음수입니다(바닷가 담수호일 수 있음)",
  zeroCatchment: "유역면적이 0입니다",
  zeroFullArea: "만수면적이 0입니다",
  zeroFloodArea: "홍수면적이 0입니다",
  effectiveExceedsTotal: "유효저수량이 총저수량보다 큽니다",
  storageSumMismatch: "총저수량 ≠ 유효 + 사수량 (1 % 넘게 차이)",
  zeroDamHeight: "제체높이가 0입니다",
  zeroDamLength: "제체길이가 0입니다",
  zeroFloodFreq: "홍수빈도가 0입니다",
  missingGrade: "종별이 비어 있습니다",
};

const OVERRIDABLE: { field: SpecOverrideField; unit: string }[] = [
  { field: "catchmentHa", unit: "ha" },
  { field: "fullLevelElM", unit: "EL.m" },
  { field: "floodLevelElM", unit: "EL.m" },
  { field: "deadLevelElM", unit: "EL.m" },
  { field: "totalStorageThousandM3", unit: "천m³" },
  { field: "fullAreaHa", unit: "ha" },
];

const f = (v: number | null | undefined, d = 2) => (v === null || v === undefined ? "—" : v.toLocaleString("ko-KR", { minimumFractionDigits: d, maximumFractionDigits: d }));

function Row({ label, children, badge }: { label: string; children: React.ReactNode; badge: React.ReactNode }) {
  return (
    <div className="grid min-h-10 grid-cols-[minmax(0,10rem)_minmax(0,1fr)_auto] items-center gap-3 border-b border-[#eaeef2] py-1.5 text-sm">
      <dt className="text-ink">{label}</dt>
      <dd className="num text-right text-ink">{children}</dd>
      <dd>{badge}</dd>
    </div>
  );
}

export function SpecPanel(props: {
  record: ReservoirRecord;
  asOf: string;
  water: WaterLevelState;
  overrides: Partial<Record<SpecOverrideField, string>>;
  onOverride: (field: SpecOverrideField, value: string) => void;
  specIssues: ValidationIssue[];
  anomalies: { specField: SpecOverrideField; message: string }[];
}) {
  const { record, asOf, water, overrides, onOverride, specIssues, anomalies } = props;
  const s = record.spec;
  const src = auto(`제원 CSV ${asOf}`);
  const roundMargin = isRoundFloodMargin(s.floodLevelElM, s.fullLevelElM);
  const ov = (k: SpecOverrideField) => overrides[k]?.trim() ? overrides[k]!.trim() : null;
  const val = (k: SpecOverrideField, v: number | null, d = 2) => (ov(k) ? `${ov(k)}` : f(v, d));
  const badge = (k: SpecOverrideField) => <SourceBadge source={ov(k) ? INPUT : src} />;
  // 직접 입력 칸을 보일 항목: 계산을 막는 제원 문제, 확인이 필요한 값, 이미 입력한 값
  const need = new Set<SpecOverrideField>([
    ...specIssues.map((i) => i.specField!).filter(Boolean),
    ...anomalies.map((a) => a.specField),
    ...(Object.keys(overrides) as SpecOverrideField[]).filter((k) => overrides[k]),
  ]);

  return (
    <section aria-labelledby="spec-title" className="border-t border-line py-6">
      <h2 id="spec-title" className="mb-3 text-[13px] font-medium text-sub">② 제원 (자동)</h2>

      {(s.flags.length > 0 || specIssues.length > 0 || anomalies.length > 0) && (
        <div role="note" className="mb-4 rounded-md border border-[#8c959f] px-4 py-3 text-sm text-ink">
          <p className="font-semibold"><span aria-hidden="true">⚠</span> 제원 자료 확인 필요</p>
          <ul className="mt-1 list-disc pl-5 leading-6">
            {s.flags.map((fl) => <li key={fl}>{FLAG_TEXT[fl] ?? fl}</li>)}
            {specIssues.map((i) => <li key={i.field + i.reason}>{i.field.replace("제원.", "")}: {i.reason} — 아래에 값을 직접 입력하면 계산합니다</li>)}
            {anomalies.map((a) => <li key={a.message}>{a.message}</li>)}
          </ul>
        </div>
      )}

      <dl className="grid gap-x-12 md:grid-cols-2">
        <div>
          <Row label="유역면적" badge={badge("catchmentHa")}>{val("catchmentHa", s.catchmentHa, 0)} <span className="text-[13px] text-sub">ha</span>{!ov("catchmentHa") && s.catchmentHa !== null && <span className="text-[13px] text-sub"> ({f(s.catchmentHa / 100)} km²)</span>}</Row>
          <Row label="만수위 · 홍수위 · 사수위" badge={<SourceBadge source={ov("fullLevelElM") || ov("floodLevelElM") || ov("deadLevelElM") ? INPUT : src} />}>
            EL.{val("fullLevelElM", s.fullLevelElM)} · {val("floodLevelElM", s.floodLevelElM)} · {val("deadLevelElM", s.deadLevelElM)}
            {roundMargin && !ov("floodLevelElM") && (
              <span className="block text-xs text-sub">홍수위 − 만수위 = {roundMargin.toFixed(1)} m 정확히 — 대표값일 수 있음</span>
            )}
          </Row>
          <Row label="총저수량 · 유효저수량" badge={badge("totalStorageThousandM3")}>{val("totalStorageThousandM3", s.totalStorageThousandM3, 0)} · {f(s.effectiveStorageThousandM3, 0)} <span className="text-[13px] text-sub">천m³</span></Row>
          <Row label="만수면적 · 홍수면적" badge={badge("fullAreaHa")}>{val("fullAreaHa", s.fullAreaHa, 1)} · {f(s.floodAreaHa, 1)} <span className="text-[13px] text-sub">ha</span></Row>
        </div>
        <div>
          <Row label="제체형식 · 높이" badge={badge("damType")}>{ov("damType") ?? s.damType ?? "—"} · {f(s.damHeightM, 1)} <span className="text-[13px] text-sub">m</span></Row>
          <Row label="홍수빈도" badge={<SourceBadge source={src} />}>{f(s.floodFreqYr, 0)} <span className="text-[13px] text-sub">년</span></Row>
          <Row label="현재 수위" badge={<SourceBadge source={auto("수위 API 15099919")} />}>
            {water.status === "loading" && <span className="text-sub">불러오는 중…</span>}
            {water.status === "none" && <span className="text-sub" title={water.reason}>현재 수위 없음</span>}
            {water.status === "ok" && <>EL.{f(water.levelElM)} · {f(water.ratePct, 1)} % <span className="text-[13px] text-sub">({water.date})</span></>}
          </Row>
          <Row label="2025 홍수기 저수율" badge={<SourceBadge source={auto("일별 저수율 2025")} />}>
            {record.storage2025 ? <>평균 {f(record.storage2025.floodSeasonMeanPct, 1)} · 최대 {f(record.storage2025.floodSeasonMaxPct, 1)} <span className="text-[13px] text-sub">%</span></> : <span className="text-sub">연결된 자료 없음</span>}
          </Row>
        </div>
      </dl>

      {need.size > 0 && (
        <fieldset className="mt-4 rounded-md border border-line p-4">
          <legend className="px-1 text-[13px] font-medium text-ink">제원 값 직접 입력 (비우면 제원 값 사용)</legend>
          <div className="grid gap-3 sm:grid-cols-3">
            {OVERRIDABLE.filter((o) => need.has(o.field)).map((o) => (
              <label key={o.field} className="text-[13px] text-ink">
                <span className="mb-1 flex items-center gap-1.5">{SPEC_FIELD_LABEL[o.field]} <SourceBadge source={INPUT} /></span>
                <span className="flex h-10 items-center gap-1.5 rounded-md border border-line px-2.5 focus-within:outline-2 focus-within:outline-ink">
                  <input inputMode="decimal" className="num w-full bg-transparent text-right text-[15px] outline-none" value={overrides[o.field] ?? ""} onChange={(e) => onOverride(o.field, e.target.value)} placeholder={String((s as unknown as Record<string, number | null>)[o.field] ?? "")} />
                  <span className="text-[13px] text-sub">{o.unit}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      )}
    </section>
  );
}
