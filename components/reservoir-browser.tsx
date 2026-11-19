"use client";

// 화면 1의 검색·필터 상태를 지도와 표가 함께 쓴다 (design/wireframe.md 1절)
import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import { useHydrated } from "@/hooks/use-hydrated";
import type { ListRow } from "@/lib/list-rows";
import { loadAll } from "@/lib/saved";
import { ReservoirTable, type RowStatus } from "./reservoir-table";

const ReservoirMap = dynamic(() => import("./reservoir-map").then((m) => m.ReservoirMap), {
  ssr: false,
  loading: () => <div className="flex h-full min-h-80 items-center justify-center rounded-lg border border-line bg-[#f6f8fa] text-sm text-sub">지도를 불러오는 중…</div>,
});

export interface Filters {
  q: string;
  hq: string;
  branch: string;
  area: "all" | "le5" | "mid" | "ge25";
  freq: "all" | "100" | "200" | "other";
  status: "all" | "none" | "entered" | "pass" | "fail";
}

const initial: Filters = { q: "", hq: "", branch: "", area: "all", freq: "all", status: "all" };

function matches(r: ListRow, f: Filters, st: RowStatus): boolean {
  if (f.q) {
    const q = f.q.trim().toLowerCase();
    if (q && !(r.name.toLowerCase().includes(q) || r.address.includes(q) || r.sido.includes(q) || r.code.startsWith(q))) return false;
  }
  if (f.hq && r.hq !== f.hq) return false;
  if (f.branch && r.branch !== f.branch) return false;
  const km2 = r.catchmentHa === null ? null : r.catchmentHa / 100;
  if (f.area === "le5" && !(km2 !== null && km2 <= 5)) return false;
  if (f.area === "mid" && !(km2 !== null && km2 > 5 && km2 < 25.9)) return false;
  if (f.area === "ge25" && !(km2 !== null && km2 >= 25.9)) return false;
  if (f.freq === "100" && r.floodFreqYr !== 100) return false;
  if (f.freq === "200" && r.floodFreqYr !== 200) return false;
  if (f.freq === "other" && (r.floodFreqYr === 100 || r.floodFreqYr === 200)) return false;
  if (f.status !== "all") {
    if (f.status === "none" && st !== "none") return false;
    if (f.status === "entered" && st === "none") return false;
    if ((f.status === "pass" || f.status === "fail") && st !== f.status) return false;
  }
  return true;
}

export function ReservoirBrowser({ rows }: { rows: ListRow[] }) {
  const [f, setF] = useState<Filters>(initial);
  const [selected, setSelected] = useState<string | null>(null);
  // 브라우저에 저장된 입력값 → 입력 상태 (하이드레이션 뒤에 읽는다)
  const hydrated = useHydrated();
  const status = useMemo(() => {
    const s: Record<string, RowStatus> = {};
    if (!hydrated) return s;
    for (const [code, e] of Object.entries(loadAll())) s[code] = e.verdict ?? "entered";
    return s;
  }, [hydrated]);

  const hqs = useMemo(() => [...new Set(rows.map((r) => r.hq).filter(Boolean))].sort((a, b) => a.localeCompare(b, "ko")), [rows]);
  const branches = useMemo(
    () => [...new Set(rows.filter((r) => !f.hq || r.hq === f.hq).map((r) => r.branch).filter(Boolean))].sort((a, b) => a.localeCompare(b, "ko")),
    [rows, f.hq],
  );
  const filtered = useMemo(() => rows.filter((r) => matches(r, f, status[r.code] ?? "none")), [rows, f, status]);
  const set = <K extends keyof Filters>(k: K, v: Filters[K]) => setF((p) => ({ ...p, [k]: v, ...(k === "hq" ? { branch: "" } : {}) }));

  const sel = "h-10 rounded-md border border-line bg-white px-3 text-sm text-ink";
  return (
    <>
      <div className="flex flex-wrap items-center gap-3 border-b border-line py-4" role="search">
        <label className="relative flex min-w-64 flex-1 items-center sm:max-w-96">
          <span className="sr-only">이름·시군·표준코드 검색</span>
          <svg aria-hidden="true" viewBox="0 0 24 24" className="pointer-events-none absolute left-3 size-4 text-sub" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
          <input
            type="search"
            value={f.q}
            onChange={(e) => set("q", e.target.value)}
            placeholder="이름·시군·표준코드 검색"
            className="h-10 w-full rounded-md border border-line bg-white pr-3 pl-9 text-sm text-ink placeholder:text-sub"
          />
        </label>
        <label className="flex items-center gap-1.5 text-sm text-sub">
          본부
          <select className={sel} value={f.hq} onChange={(e) => set("hq", e.target.value)}>
            <option value="">전체</option>
            {hqs.map((h) => <option key={h}>{h}</option>)}
          </select>
        </label>
        <label className="flex items-center gap-1.5 text-sm text-sub">
          지사
          <select className={sel} value={f.branch} onChange={(e) => set("branch", e.target.value)}>
            <option value="">전체</option>
            {branches.map((b) => <option key={b}>{b}</option>)}
          </select>
        </label>
        <label className="flex items-center gap-1.5 text-sm text-sub">
          유역면적
          <select className={sel} value={f.area} onChange={(e) => set("area", e.target.value as Filters["area"])}>
            <option value="all">전체</option>
            <option value="le5">5 km² 이하 (홍수조절 미고려 대상)</option>
            <option value="mid">5 ~ 25.9 km²</option>
            <option value="ge25">25.9 km² 이상 (면적감소 경고)</option>
          </select>
        </label>
        <Segmented label="홍수빈도" value={f.freq} onChange={(v) => set("freq", v)} items={[["all", "전체"], ["100", "100년"], ["200", "200년"], ["other", "그 밖"]]} />
        <Segmented label="입력 상태" value={f.status} onChange={(v) => set("status", v)} items={[["all", "전체"], ["none", "미입력"], ["entered", "입력됨"], ["pass", "적합"], ["fail", "부적합"]]} />
      </div>
      <div className="grid gap-6 py-5 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <div className="h-80 lg:sticky lg:top-4 lg:h-[640px]">
          <ReservoirMap rows={filtered} status={status} selected={selected} onSelect={setSelected} />
        </div>
        <ReservoirTable rows={filtered} total={rows.length} status={status} selected={selected} onSelect={setSelected} filters={f} />
      </div>
    </>
  );
}

function Segmented<T extends string>({ label, value, onChange, items }: { label: string; value: T; onChange: (v: T) => void; items: [T, string][] }) {
  return (
    <fieldset className="flex h-10 items-stretch overflow-hidden rounded-md border border-line text-[13px]">
      <legend className="sr-only">{label}</legend>
      <span aria-hidden="true" className="flex items-center px-2.5 text-sub">{label}</span>
      {items.map(([v, t]) => (
        <label key={v} className={`flex cursor-pointer items-center border-l border-line px-2.5 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-ink ${value === v ? "bg-ink text-white" : "bg-white text-ink"}`}>
          <input type="radio" className="sr-only" name={label} checked={value === v} onChange={() => onChange(v)} />
          {t}
        </label>
      ))}
    </fieldset>
  );
}
