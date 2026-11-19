"use client";

// 전국 저수지 표 (design/wireframe.md 1절). 키보드: 행에서 ↑↓로 이동, Enter로 상세
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ListRow } from "@/lib/list-rows";
import type { Filters } from "./reservoir-browser";
import { VerdictBadge } from "./verdict-badge";

export type RowStatus = "none" | "entered" | "pass" | "fail";
type SortKey = "name" | "catchmentHa" | "totalStorageThousandM3" | "floodFreqYr";
const PAGE = 50;
const fmt = (v: number | null, d = 0) => (v === null ? "—" : v.toLocaleString("ko-KR", { maximumFractionDigits: d }));

export function ReservoirTable(props: {
  rows: ListRow[];
  total: number;
  status: Record<string, RowStatus>;
  selected: string | null;
  onSelect: (code: string) => void;
  filters: Filters;
}) {
  const { rows, total, status, selected, onSelect, filters } = props;
  const router = useRouter();
  const [sort, setSort] = useState<{ key: SortKey; desc: boolean }>({ key: "totalStorageThousandM3", desc: true });
  const [page, setPage] = useState(0);
  const body = useRef<HTMLTableSectionElement>(null);

  const sorted = useMemo(() => {
    const s = [...rows];
    s.sort((a, b) => {
      const k = sort.key;
      const r = k === "name" ? a.name.localeCompare(b.name, "ko") : (a[k] ?? -Infinity) - (b[k] ?? -Infinity);
      return sort.desc ? -r : r;
    });
    return s;
  }, [rows, sort]);

  // 필터·정렬이 바뀌면 첫 쪽으로. 지도에서 고른 저수지는 그 쪽으로
  useEffect(() => setPage(0), [filters, sort]);
  useEffect(() => {
    if (!selected) return;
    const i = sorted.findIndex((r) => r.code === selected);
    if (i >= 0) setPage(Math.floor(i / PAGE));
  }, [selected, sorted]);

  const pages = Math.max(1, Math.ceil(sorted.length / PAGE));
  const view = sorted.slice(page * PAGE, page * PAGE + PAGE);

  const onKey = (e: React.KeyboardEvent<HTMLTableRowElement>, code: string) => {
    const tr = e.currentTarget;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      (tr.nextElementSibling as HTMLElement | null)?.focus();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      (tr.previousElementSibling as HTMLElement | null)?.focus();
    } else if (e.key === "Enter" && e.target === tr) {
      router.push(`/r/${code}`);
    }
  };

  const th = (key: SortKey | null, label: string, right = false) => (
    <th scope="col" aria-sort={key && sort.key === key ? (sort.desc ? "descending" : "ascending") : undefined} className={`h-10 px-3 text-[13px] font-medium text-sub ${right ? "text-right" : "text-left"}`}>
      {key ? (
        <button type="button" className="inline-flex items-center gap-1 hover:text-ink" onClick={() => setSort((s) => ({ key, desc: s.key === key ? !s.desc : key !== "name" }))}>
          {label}
          <span aria-hidden="true">{sort.key === key ? (sort.desc ? "▼" : "▲") : ""}</span>
        </button>
      ) : (
        label
      )}
    </th>
  );

  return (
    <section aria-labelledby="list-title" className="min-w-0">
      <div className="mb-2 flex items-baseline justify-between text-sm">
        <h2 id="list-title" className="text-sub">
          <b className="num font-semibold text-ink">{rows.length.toLocaleString("ko-KR")}곳</b>
          {rows.length !== total && <> / 전체 {total.toLocaleString("ko-KR")}</>}
        </h2>
        <p className="text-[13px] text-sub">행에서 ↑↓ 이동 · Enter 상세</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <caption className="sr-only">저수지 목록: 이름, 소재지, 유역면적, 총저수량, 홍수빈도, 입력 상태</caption>
          <thead className="border-b border-line">
            <tr>
              {th("name", "이름")}
              {th(null, "소재지")}
              {th("catchmentHa", "유역면적 ha", true)}
              {th("totalStorageThousandM3", "총저수량 천m³", true)}
              {th("floodFreqYr", "홍수빈도 년", true)}
              {th(null, "입력 상태")}
            </tr>
          </thead>
          <tbody ref={body}>
            {view.map((r) => {
              const st = status[r.code] ?? "none";
              const isSel = r.code === selected;
              return (
                <tr
                  key={r.code}
                  tabIndex={0}
                  aria-selected={isSel}
                  onKeyDown={(e) => onKey(e, r.code)}
                  onFocus={() => onSelect(r.code)}
                  className={`h-11 border-b border-line ${isSel ? "shadow-[inset_4px_0_0_var(--water)]" : ""}`}
                >
                  <td className="px-3">
                    <Link href={`/r/${r.code}`} tabIndex={-1} className="font-medium text-ink hover:underline">{r.name}</Link>
                    {r.flagCount > 0 && <span className="ml-1.5 text-[13px]" title="제원 자료 이상 플래그가 있습니다">⚠<span className="sr-only">제원 자료 이상</span></span>}
                    {r.loc === "approx" && <span className="ml-1.5 text-xs text-sub">위치 근사</span>}
                    {r.precisionM !== null && r.precisionM >= 100 && <span className="ml-1.5 text-xs text-sub">좌표 정밀도 약 {Math.round(r.precisionM).toLocaleString("ko-KR")} m</span>}
                  </td>
                  <td className="px-3 text-ink">{r.address}</td>
                  <td className="num px-3 text-right">{fmt(r.catchmentHa)}</td>
                  <td className="num px-3 text-right">{fmt(r.totalStorageThousandM3)}</td>
                  <td className="num px-3 text-right">{fmt(r.floodFreqYr)}</td>
                  <td className="px-3">
                    {st === "pass" || st === "fail" ? <VerdictBadge pass={st === "pass"} /> : <span className="text-sub">{st === "entered" ? "입력됨" : "미입력"}</span>}
                  </td>
                </tr>
              );
            })}
            {view.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-sub">조건에 맞는 저수지가 없습니다</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {pages > 1 && (
        <nav aria-label="쪽" className="mt-3 flex items-center justify-end gap-2 text-sm">
          <button type="button" className="h-8 rounded-md border border-line px-3 disabled:opacity-40" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>이전</button>
          <span className="num text-sub">{page + 1} / {pages}</span>
          <button type="button" className="h-8 rounded-md border border-line px-3 disabled:opacity-40" disabled={page >= pages - 1} onClick={() => setPage((p) => p + 1)}>다음</button>
        </nav>
      )}
    </section>
  );
}
