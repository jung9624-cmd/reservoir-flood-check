"use client";

// 화면 2 — 저수지 상세 (design/wireframe.md 2절). ① 머리 ② 제원 ③ 입력 + 계산 조건 ④ 판정 ⑤ 단면 ⑥ 수문곡선 ⑦ 지속기간 ⑧ 시나리오 ⑨ 검증
// 계산은 lib/run.ts(React와 무관)를 hooks/use-run.ts로 부른다.
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import huffFile from "@/data/huff/khas-q3.json";
import type kwoniJson from "@/data/validation/kwoni.json";
import type { ReservoirRecord } from "@/lib/data";
import { draftToInputs, emptyDraft, issueToDraftField, type DraftField, type InputDraft } from "@/lib/draft";
import { huffHyetograph } from "@/lib/hyetograph";
import { probableRainfall } from "@/lib/rainfall";
import { DEFAULT_SPILLWAY_COEFFICIENT, toPublicSpec, type RunData } from "@/lib/run";
import { isFillDam, FILL_DAM_FACTOR } from "@/lib/runoff";
import { exportAll, importAll, loadEntry, removeEntry, saveEntry, type SavedOptions } from "@/lib/saved";
import { buildScenarios, type ScenarioJob } from "@/lib/scenarios";
import { applySpecOverrides, specAnomalies } from "@/lib/spec";
import type { RunOptions, Station, UserInputs } from "@/lib/types";
import { distanceKm, nearestStation } from "@/lib/station";
import { validateInputs } from "@/lib/validate";
import { precisionText, SPEC_CURVE_NOTE } from "@/lib/reliability";
import { Help } from "./help";
import { useRun, type RunJob } from "@/hooks/use-run";
import { useAnnualMax, useWaterLevel } from "@/hooks/use-remote";
import { useHydrated } from "@/hooks/use-hydrated";
import { DamSection } from "./dam-section";
import { DurationTable } from "./duration-table";
import { FloodChart } from "./flood-chart";
import { InputForm } from "./input-form";
import { ScenarioCompare } from "./scenario-compare";
import { auto, SourceBadge } from "./source-badge";
import { SpecPanel } from "./spec-panel";
import { ValidationTable } from "./validation-table";
import { VerdictPanel } from "./verdict-panel";
import { PrintSheet, type PrintRow } from "./print-sheet";
import { isRoundFloodMargin } from "@/lib/reliability";

type Report = typeof kwoniJson;

const huff = huffFile as { timePct: number[]; cumulativePct: number[] };
const LEVEL_ROUNDING_M = 0.01;

/** 보고서 입력값 → 입력 폼 글자 */
function draftFromReport(r: Report): InputDraft {
  const i = r.inputs;
  return {
    ...emptyDraft(),
    spillwayWidthM: String(i.spillway.width_m),
    spillwayCrestElM: i.spillway.crest_el.toFixed(2),
    spillwayCoefficient: String(i.spillway.coefficient),
    extraOutlets: [{ name: "비상수문", widthM: String(i.emergencyGate.width_m), crestElM: i.emergencyGate.crest_el.toFixed(2), coefficient: i.emergencyGate.coefficient === null ? "" : String(i.emergencyGate.coefficient), open: i.emergencyGate.open }],
    damCrestElM: i.damCrest_el.toFixed(2),
    cnAmc: i.cn.amc as "II" | "III",
    cnValue: i.cn.value.toFixed(2),
    tcKMethod: "direct",
    tcHr: String(i.tc_hr),
    kHr: String(i.k_hr),
    storageTableText: ["표고(EL.m)\t저수량(m³)", ...r.storageTable.map((p) => `${p.level_el}\t${p.storage_m3}`)].join("\n"),
  };
}

function download(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

type Props = { record: ReservoirRecord; asOf: string; stations: Station[]; report: Report | null };

/** 브라우저 저장소에서 입력값을 읽어야 하므로 하이드레이션 뒤에 본문을 그린다 */
export function ReservoirDetail(props: Props) {
  const hydrated = useHydrated();
  if (!hydrated) {
    return (
      <header className="space-y-1 py-6">
        <Link href="/" className="text-[13px] text-sub hover:underline">← 전국 목록</Link>
        <h1 className="flex items-baseline gap-3 text-[28px] font-semibold text-ink">{props.record.spec.name}<span className="num text-base font-normal text-sub">{props.record.spec.code}</span></h1>
        <p className="text-[15px] text-sub">{props.record.spec.address} · 입력값을 불러오는 중…</p>
      </header>
    );
  }
  return <DetailBody {...props} />;
}

function DetailBody({ record, asOf, stations, report }: Props) {
  const code = record.spec.code;
  const spec = useMemo(() => toPublicSpec(record.spec, asOf), [record.spec, asOf]);
  const coord = record.coord && record.coord.source !== "none" ? record.coord : null;
  // 기본 관측소: 저수지 좌표에서 가장 가까운 30년 이상 ASOS (CLAUDE.md 5.1). 좌표가 없으면 직접 고른다
  const nearest = useMemo(() => (coord ? nearestStation(coord.lat, coord.lon, stations, 30) : null), [coord, stations]);
  const defaultOptions = (): SavedOptions => {
    const st = nearest?.station ?? (report ? stations.find((s) => s.code === report.inputs.station.code) : undefined);
    return { stationCode: st?.code ?? "", firstYear: st?.firstYear ?? null, lastYear: st?.lastYear ?? null, timeConvention: "actual", returnPeriodYr: 200 };
  };

  const saved = useMemo(() => loadEntry(code), [code]);
  const [draft, setDraft] = useState<InputDraft>(() => (saved ? { ...emptyDraft(), ...saved.draft } : emptyDraft()));
  const [opts, setOpts] = useState<SavedOptions>(() => (saved ? { ...defaultOptions(), ...saved.options } : defaultOptions()));
  const [selDuration, setSelDuration] = useState<number | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [printView, setPrintView] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const water = useWaterLevel(code);
  const annual = useAnnualMax(opts.stationCode || null);
  const station = stations.find((s) => s.code === opts.stationCode) ?? null;

  // --- 입력 → 계산 입력 ---
  const dr = useMemo(() => draftToInputs(draft), [draft]);
  const options: RunOptions = useMemo(() => ({
    returnPeriodYr: opts.returnPeriodYr,
    stationCode: opts.stationCode,
    firstYear: opts.firstYear ?? station?.firstYear ?? 0,
    lastYear: opts.lastYear ?? station?.lastYear ?? 0,
    timeConvention: opts.timeConvention,
    huff: "khas-q3",
    tcKMethod: draft.tcKMethod,
    levelRoundingM: LEVEL_ROUNDING_M,
  }), [opts, station, draft.tcKMethod]);

  const issues = useMemo(() => {
    if (dr.inputs) return validateInputs(spec, dr.inputs, options);
    // 필수 칸이 비어 있어도 제원 문제는 먼저 알려 준다
    const probe: UserInputs = { spillway: { widthM: 1 }, extraOutlets: [], damCrestElM: 1e6, cn: { amc: "III", value: 80 }, timing: { tcHr: 1, kHr: 1 }, storageTable: dr.storageTable, specOverrides: dr.specOverrides };
    return validateInputs(spec, probe, { ...options, tcKMethod: "direct" }).filter((i) => i.specField);
  }, [dr, spec, options]);
  const specIssues = issues.filter((i) => i.specField);
  const effSpec = useMemo(() => applySpecOverrides(spec, dr.inputs?.specOverrides), [spec, dr.inputs]);
  const anomalies = useMemo(() => specAnomalies(effSpec).filter((a) => !draft.specOverrides[a.specField]?.trim()), [effSpec, draft.specOverrides]);

  const fieldErrors: Partial<Record<DraftField, string>> = { ...dr.errors };
  for (const i of issues) {
    const f = issueToDraftField(i.field);
    if (f && !fieldErrors[f]) fieldErrors[f] = i.reason;
  }

  // 연최대 자료가 없어도(관측소 미선택) 권이 검증 계산은 보고서 확률강우량으로 돈다
  const data: RunData = useMemo(() => ({ annualMax: annual.data ?? undefined, huff }), [annual.data]);
  const baseJob: RunJob | null = useMemo(() => (dr.inputs && annual.data && issues.length === 0 ? { spec, inputs: dr.inputs, options } : null), [dr.inputs, annual.data, issues.length, spec, options]);

  const scenarios = useMemo(() => {
    if (!baseJob) return [];
    return buildScenarios(baseJob as ScenarioJob, {
      stationRange: station && station.firstYear !== null && station.lastYear !== null ? { firstYear: station.firstYear, lastYear: station.lastYear } : null,
      currentLevelElM: water.status === "ok" ? water.levelElM : null,
      currentLevelNote: water.status === "none" ? water.reason : water.status === "loading" ? "불러오는 중" : "수위 값이 없습니다",
      floodSeasonMaxPct: record.storage2025?.floodSeasonMaxPct ?? null,
      effectiveStorageThousandM3: record.spec.effectiveStorageThousandM3,
      deadStorageThousandM3: record.spec.deadStorageThousandM3,
      hasSeokyeongInputs: !!(draft.channelLengthKm.trim() && draft.farthestPointElM.trim()),
    });
  }, [baseJob, station, water, record, draft.channelLengthKm, draft.farthestPointElM]);

  // 권이 검증용 계산 (보고서 입력값 + 보고서 확률강우량)
  const validationJob: RunJob | null = useMemo(() => {
    if (!report) return null;
    const v = draftToInputs(draftFromReport(report)).inputs!;
    v.extraOutlets = v.extraOutlets.map((o) => ({ ...o, coefficient: o.coefficient || DEFAULT_SPILLWAY_COEFFICIENT }));
    return { spec, inputs: v, options: { ...options, tcKMethod: "direct", timeConvention: "khas", firstYear: 1961, lastYear: 2022, stationCode: report.inputs.station.code, rainfallOverrideMm: report.check1_probableRainfall200.rainfall_mm } };
  }, [report, spec, options]);

  const jobs = useMemo(() => [baseJob, ...scenarios.map((s) => s.job), validationJob], [baseJob, scenarios, validationJob]);
  const { results, pending, lastMs, worker } = useRun(jobs, data);
  const base = results[0];
  const validation = results[results.length - 1];
  const pohang = useAnnualMax(report ? report.inputs.station.code : null);
  const reportRain = useMemo(() => (report && pohang.data ? probableRainfall(pohang.data, { timeConvention: "khas", firstYear: 1961, lastYear: 2022, returnPeriodYr: 200 }) : null), [report, pohang.data]);

  // 저장 (입력값 + 마지막 판정)
  useEffect(() => {
    const untouched = JSON.stringify(draft) === JSON.stringify(emptyDraft());
    if (untouched) return;
    saveEntry(code, { draft, options: opts, verdict: base?.ok ? (base.verdict.pass ? "pass" : "fail") : null, savedAt: new Date().toISOString() });
  }, [code, draft, opts, base]);

  const ok = base && base.ok ? base : null;
  const shown = ok ? ok.durations.find((d) => d.durationMin === (selDuration ?? ok.verdict.criticalDurationMin)) ?? ok.durations[0] : null;
  const factor = isFillDam(effSpec.damType) ? FILL_DAM_FACTOR : 1;
  const spillwayCrest = dr.inputs?.spillway.crestElM ?? effSpec.fullLevelElM ?? 0;

  const loc = record.coord;
  const locBadge = !loc || loc.source === "none"
    ? <span className="text-sub">위치 없음</span>
    : loc.source === "safetydata"
      ? <SourceBadge source={auto(`공유플랫폼 · 좌표 정밀도 ${precisionText(loc.precisionM)}`)} />
      : <><b className="text-[13px] font-semibold text-ink">위치 근사</b><SourceBadge source={auto(`소재지 ${loc.approxLevel} 중심 (OSM)`)} /></>;

  const setOpt = <K extends keyof SavedOptions>(k: K, v: SavedOptions[K]) => setOpts((p) => ({ ...p, [k]: v }));
  const years = station && station.firstYear !== null && station.lastYear !== null ? Array.from({ length: station.lastYear - station.firstYear + 1 }, (_, i) => station.firstYear! + i) : [];
  const stationName = station ? ` ${station.name}` : "";
  const distOf = (s: Station) => (coord ? distanceKm(coord.lat, coord.lon, s.lat, s.lon) : null);
  const dist = station ? distOf(station) : null;
  const distText = dist === null
    ? "거리 — (저수지 좌표 없음)"
    : `거리 ${dist.toFixed(1)} km${coord?.source === "approx" ? " (위치 근사 기준)" : ""}${nearest && station && nearest.station.code === station.code ? " · 가장 가까운 30년 이상 관측소" : ""}`;
  const storageNote = dr.storageRows > 0 ? `설계 내용적표 ${dr.storageRows}행 (입력)` : SPEC_CURVE_NOTE;
  const conditions = `ASOS ${opts.stationCode || "—"}${stationName} ${options.firstYear}~${options.lastYear}${ok ? ` (${ok.rainfall.nYears}년)` : ""}, ${opts.timeConvention === "actual" ? "실제 시각" : "K-HAS 시각"}, ${opts.returnPeriodYr}년, Huff 3분위, 내용적 ${storageNote}, 초기수위 만수위, 최고수위 0.01 m 반올림 비교`;
  const rainInfo = ok && (
    <p className="flex flex-wrap items-center gap-x-1.5">
      <b className="font-semibold">확률강우량</b>
      <span>— ASOS {opts.stationCode}{stationName} · {distText} · 자료기간 {options.firstYear}~{options.lastYear} · 자료연수 {ok.rainfall.nYears}년{ok.rainfall.nYears < 30 ? " (30년 미만)" : ""} · {opts.timeConvention === "actual" ? "실제 시각" : "K-HAS 시각"} · Gumbel(PWM) · {opts.returnPeriodYr}년</span>
      <span className="inline-flex items-center gap-1 text-sub">환산계수 <Help k="conversion" /></span>
      <span className="inline-flex items-center gap-1 text-sub">Huff 3분위 <Help k="huff" /></span>
    </p>
  );
  const sel = "h-9 rounded-md border border-line bg-white px-2 text-sm text-ink";

  // 인쇄용 보기의 제원·입력값 표 (계산에 쓴 값과 출처)
  const printRows: PrintRow[] = [];
  if (ok && dr.inputs) {
    const u = ok.used;
    const num = (k: string, d = 2, unit = "") => (u[k] ? `${typeof u[k].value === "number" ? (u[k].value as number).toFixed(d) : u[k].value}${unit}` : "—");
    const add = (label: string, k: string, d = 2, unit = "") => u[k] && printRows.push({ label, value: num(k, d, unit), source: u[k].source });
    add("유역면적", "catchmentHa", 0, " ha");
    add("만수위", "fullLevelElM", 2, "");
    if (u.floodLevelElM) printRows.push({ label: "홍수위", value: num("floodLevelElM") + (isRoundFloodMargin(effSpec.floodLevelElM, effSpec.fullLevelElM) ? " (대표값일 수 있음)" : ""), source: u.floodLevelElM.source });
    add("사수위", "deadLevelElM");
    add("총저수량", "totalStorageThousandM3", 0, " 천m³");
    add("만수면적", "fullAreaHa", 1, " ha");
    add("제체형식", "damType");
    printRows.push({ label: "위치", value: loc && loc.source !== "none" ? `${loc.lat}, ${loc.lon}` : "—", source: { kind: "text", text: !loc || loc.source === "none" ? "없음" : loc.source === "safetydata" ? `공유플랫폼 · 정밀도 ${precisionText(loc.precisionM)}` : `위치 근사 · 소재지 ${loc.approxLevel}` } });
    add("물넘이 폭", "spillwayWidthM", 1, " m");
    add("물넘이 마루표고", "spillwayCrestElM");
    add("물넘이 유량계수", "spillwayCoefficient");
    dr.inputs.extraOutlets.forEach((o) => printRows.push({ label: o.name, value: `${o.widthM} m · ${o.crestElM.toFixed(2)} · C ${o.coefficient}${o.open ? " · 열림" : " · 닫힘"}`, source: { kind: "input" } }));
    add("제정표고", "damCrestElM");
    add("CN-Ⅲ", "cn3");
    add("Tc", "tcHr", 2, " hr");
    add("K", "kHr", 2, " hr");
    printRows.push({ label: "내용적", value: dr.storageRows > 0 ? `설계 내용적표 ${dr.storageRows}행` : "제원 근사 곡선", source: dr.storageRows > 0 ? { kind: "input" } : { kind: "text", text: SPEC_CURVE_NOTE } });
    printRows.push({ label: "확률강우량", value: `ASOS ${opts.stationCode}${stationName} ${options.firstYear}~${options.lastYear} (${ok.rainfall.nYears}년)`, source: { kind: "text", text: `${opts.timeConvention === "actual" ? "실제 시각" : "K-HAS"} · ${distText}` } });
    add("할증", "designFactor", 1, "");
  }

  if (printView && ok && shown && dr.inputs) {
    return (
      <PrintSheet
        title={record.spec.name}
        code={code}
        subtitle={`${record.spec.address} · ${record.spec.hq}본부 ${record.spec.branch}지사`}
        asOf={asOf}
        rows={printRows}
        result={ok}
        shown={shown}
        rainMm={huffHyetograph(shown.rainfallMm, shown.durationMin, huff).values}
        factor={factor}
        damCrestElM={dr.inputs.damCrestElM}
        spillwayCrestElM={spillwayCrest}
        floodLevelElM={effSpec.floodLevelElM}
        deadLevelElM={effSpec.deadLevelElM}
        outlets={dr.inputs.extraOutlets.map((o) => ({ name: o.name, crestElM: o.crestElM }))}
        conditions={conditions}
        onClose={() => setPrintView(false)}
      />
    );
  }

  return (
    <article className="pb-4">
      {/* ① 머리 */}
      <header className="flex flex-wrap items-start justify-between gap-4 py-6">
        <div className="min-w-0 space-y-1">
          <Link href="/" className="text-[13px] text-sub hover:underline">← 전국 목록</Link>
          <h1 className="flex items-baseline gap-3 text-[28px] font-semibold text-ink">
            {record.spec.name}
            <span className="num text-base font-normal text-sub">{code}</span>
          </h1>
          <p className="flex flex-wrap items-center gap-2 text-[15px] text-sub">
            {record.spec.address} · {record.spec.hq}본부 {record.spec.branch}지사
            {loc && loc.source !== "none" && <span className="num">· {loc.lat}, {loc.lon}</span>}
            {locBadge}
          </p>
          <p className="text-[15px] text-sub">
            확률강우량 관측소 {station ? <>ASOS {station.name}({station.code}) · <span className="num">{distText}</span></> : "미선택"} · 제원 기준일 <span className="num">{asOf}</span>
          </p>
        </div>
        <div className="no-print flex flex-wrap gap-2">
          <button type="button" disabled={!ok} title={ok ? undefined : "판정이 나온 뒤에 쓸 수 있습니다"} className="h-9 rounded-md border border-ink px-3 text-sm font-medium text-ink hover:bg-[#f6f8fa] disabled:border-line disabled:text-sub" onClick={() => setPrintView(true)}>인쇄용 보기 (검토서 1장)</button>
          <button type="button" className="h-9 rounded-md border border-line px-3 text-sm text-ink hover:bg-[#f6f8fa]" onClick={() => download(`reservoir-inputs-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(exportAll(), null, 1))}>입력값 내보내기 (JSON)</button>
          <button type="button" className="h-9 rounded-md border border-line px-3 text-sm text-ink hover:bg-[#f6f8fa]" onClick={() => fileRef.current?.click()}>불러오기</button>
          <input ref={fileRef} type="file" accept="application/json,.json" className="sr-only" tabIndex={-1} aria-hidden="true" onChange={async (e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (!file) return;
            const r = importAll(await file.text());
            setNotice(r.error ?? `${r.count}곳의 입력값을 불러왔습니다`);
            const en = loadEntry(code);
            if (en) {
              setDraft({ ...emptyDraft(), ...en.draft });
              setOpts({ ...defaultOptions(), ...en.options });
            }
          }} />
          <button type="button" className="h-9 rounded-md border border-line px-3 text-sm text-ink hover:bg-[#f6f8fa]" onClick={() => {
            removeEntry(code);
            setDraft(emptyDraft());
            setOpts(defaultOptions());
            setNotice("이 저수지의 입력값을 지웠습니다");
          }}>입력값 지우기</button>
        </div>
      </header>
      {notice && <p role="status" className="mb-3 rounded-md border border-line px-3 py-2 text-sm text-ink">{notice}</p>}

      <SpecPanel record={record} asOf={asOf} water={water} overrides={draft.specOverrides} onOverride={(f, v) => setDraft((d) => ({ ...d, specOverrides: { ...d.specOverrides, [f]: v } }))} specIssues={specIssues} anomalies={anomalies} />

      <InputForm draft={draft} onChange={setDraft} errors={fieldErrors} fullLevelElM={effSpec.fullLevelElM} storageRows={dr.storageRows} onLoadReport={report ? () => {
        setDraft(draftFromReport(report));
        const st = stations.find((s) => s.code === report.inputs.station.code);
        setOpts((o) => ({ ...o, stationCode: report.inputs.station.code, firstYear: report.inputs.station.firstYear, lastYear: Math.min(report.inputs.station.lastYear, st?.lastYear ?? 9999) }));
        setNotice("권이 세부설계 2023 보고서 값을 채웠습니다 (비상수문 C는 보고서에 없어 기본값 2.0)");
      } : undefined} />

      {/* 계산 조건 */}
      <section aria-labelledby="opt-title" className="border-t border-line py-5">
        <h2 id="opt-title" className="mb-3 text-[13px] font-medium text-sub">계산 조건 · 확률강우량</h2>
        <div className="flex flex-wrap items-end gap-4 text-sm text-ink">
          <label className="flex flex-col gap-1 text-[13px]">
            <span className="flex items-center gap-1.5">ASOS 관측소 <SourceBadge source={auto("기상청 ASOS · K-HAS 시간강우")} /></span>
            <select className={sel} value={opts.stationCode} onChange={(e) => {
              const st = stations.find((s) => s.code === e.target.value);
              setOpts((o) => ({ ...o, stationCode: e.target.value, firstYear: st?.firstYear ?? null, lastYear: st?.lastYear ?? null }));
            }}>
              <option value="">관측소를 고르세요</option>
              {[...stations].sort((a, b) => (distOf(a) ?? 0) - (distOf(b) ?? 0) || a.code.localeCompare(b.code)).map((s) => {
                const d = distOf(s);
                return (
                  <option key={s.code} value={s.code}>
                    {s.name}({s.code}){d !== null ? ` · ${d.toFixed(1)} km` : ""} · {s.firstYear}~{s.lastYear} ({s.nYears}년){s.nYears < 30 ? " · 30년 미만" : ""}
                  </option>
                );
              })}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-[13px]">자료기간 시작
            <select className={sel} value={options.firstYear} disabled={!station} onChange={(e) => setOpt("firstYear", Number(e.target.value))}>
              {years.map((y) => <option key={y}>{y}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-[13px]">끝
            <select className={sel} value={options.lastYear} disabled={!station} onChange={(e) => setOpt("lastYear", Number(e.target.value))}>
              {years.map((y) => <option key={y}>{y}</option>)}
            </select>
          </label>
          <fieldset className="flex flex-col gap-1 text-[13px]">
            <legend className="mb-1">시각 방식</legend>
            <div className="flex gap-3">
              <label className="flex items-center gap-1"><input type="radio" name="tc" checked={opts.timeConvention === "actual"} onChange={() => setOpt("timeConvention", "actual")} />실제 시각 (기본)</label>
              <label className="flex items-center gap-1"><input type="radio" name="tc" checked={opts.timeConvention === "khas"} onChange={() => setOpt("timeConvention", "khas")} />K-HAS 방식 (검증용)</label>
            </div>
          </fieldset>
          <fieldset className="flex flex-col gap-1 text-[13px]">
            <legend className="mb-1">재현기간</legend>
            <div className="flex gap-3">
              {[200, 100].map((T) => <label key={T} className="flex items-center gap-1"><input type="radio" name="T" checked={opts.returnPeriodYr === T} onChange={() => setOpt("returnPeriodYr", T)} />{T}년</label>)}
            </div>
          </fieldset>
        </div>
        <p className="mt-2 text-xs text-sub">
          {nearest
            ? `기본값은 저수지 좌표${coord?.source === "approx" ? "(위치 근사)" : ""}에서 가장 가까운 자료 30년 이상 관측소 ${nearest.station.name}(${nearest.station.code}, ${nearest.distanceKm.toFixed(1)} km)입니다. 목록은 가까운 순이며 다른 관측소를 고를 수 있습니다.`
            : "저수지 좌표가 없어 가까운 관측소를 고르지 못했습니다. 관측소를 직접 고르세요."}
          {" "}관측소 좌표: 기상청 기상자료개방포털 ASOS 지점정보(현재 위치).
        </p>
      </section>

      {/* ④~⑧ 또는 안내 */}
      {!ok ? (
        <section aria-live="polite" className="my-4 rounded-lg border border-line bg-[#f6f8fa] px-5 py-6 text-[15px] text-ink">
          {dr.missing.length > 0 ? (
            <>입력하면 판정됩니다 — 남은 칸: <b>{dr.missing.map((m) => m.label).join(", ")}</b></>
          ) : Object.keys(dr.errors).length > 0 || issues.length > 0 ? (
            <>입력값을 확인하세요 — {[...Object.values(dr.errors), ...issues.map((i) => `${i.field}: ${i.reason}`)].slice(0, 4).join(" · ")}</>
          ) : !opts.stationCode ? (
            <>확률강우량 관측소를 고르면 판정됩니다</>
          ) : annual.loading || pending || !base ? (
            <>계산 중…</>
          ) : base && !base.ok ? (
            <>계산할 수 없습니다 — {base.issues.map((i) => `${i.field}: ${i.reason}`).join(" · ")}</>
          ) : (
            <>관측소 {opts.stationCode}의 강우 자료를 불러오지 못했습니다</>
          )}
        </section>
      ) : (
        <>
          <VerdictPanel verdict={ok.verdict} critical={ok.durations.find((d) => d.durationMin === ok.verdict.criticalDurationMin)!} factor={factor} warnings={ok.warnings} conditions={conditions} />
          {shown && (
            <section aria-labelledby="fig-title" className="grid gap-8 border-t border-line py-6 lg:grid-cols-2">
              <h2 id="fig-title" className="sr-only">⑤ 제당 단면과 ⑥ 수문곡선</h2>
              <div>
                <h3 className="mb-2 text-[13px] font-medium text-sub">⑤ 제당 단면 · {shown.durationMin}분{shown.durationMin === ok.verdict.criticalDurationMin ? " (임계)" : ""}</h3>
                <DamSection
                  damCrestElM={dr.inputs!.damCrestElM}
                  maxLevelElM={Math.round(shown.maxLevelElM / LEVEL_ROUNDING_M) * LEVEL_ROUNDING_M}
                  durationMin={shown.durationMin}
                  pass={dr.inputs!.damCrestElM - Math.round(shown.maxLevelElM / LEVEL_ROUNDING_M) * LEVEL_ROUNDING_M >= 2 - 1e-9}
                  spillwayCrestElM={spillwayCrest}
                  floodLevelElM={effSpec.floodLevelElM}
                  deadLevelElM={effSpec.deadLevelElM}
                  outlets={dr.inputs!.extraOutlets.map((o) => ({ name: o.name, crestElM: o.crestElM }))}
                />
              </div>
              <div>
                <h3 className="mb-2 text-[13px] font-medium text-sub">⑥ 수문곡선 · {shown.durationMin}분 — 시간축 공유</h3>
                <FloodChart
                  duration={shown}
                  rainMm={huffHyetograph(shown.rainfallMm, shown.durationMin, huff).values}
                  factor={factor}
                  damCrestElM={dr.inputs!.damCrestElM}
                  allowedElM={dr.inputs!.damCrestElM - 2}
                  spillwayCrestElM={spillwayCrest}
                />
              </div>
            </section>
          )}
          <DurationTable note={rainInfo} durations={ok.durations} critical={ok.verdict.criticalDurationMin} selected={shown?.durationMin ?? ok.verdict.criticalDurationMin} onSelect={setSelDuration} damCrestElM={dr.inputs!.damCrestElM} rounding={LEVEL_ROUNDING_M} />
          <ScenarioCompare base={ok} baseLabel={`만수위 시작 · ASOS ${opts.stationCode} ${options.firstYear}~${options.lastYear} · ${opts.timeConvention === "actual" ? "실제 시각" : "K-HAS"} · ${opts.returnPeriodYr}년`} scenarios={scenarios} results={results.slice(1, 1 + scenarios.length)} pending={pending} />
        </>
      )}

      {report && <ValidationTable report={report} rainfall={reportRain} routing={validation} />}
      {lastMs !== null && <p className="text-xs text-sub">마지막 계산 {lastMs.toFixed(0)} ms{worker ? " · Web Worker" : ""}</p>}
    </article>
  );
}
