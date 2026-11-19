"use client";

// 전국 저수지 지도 (Leaflet + OpenStreetMap). 3,402점은 canvas 렌더러의 CircleMarker로 그린다
// (DOM 마커가 아니라 캔버스 한 장이라 클러스터링 없이도 빠르다).
// 모양 = 위치 출처(채운 원: 공유플랫폼 좌표, 빈 원: 소재지 근사), 색 = 판정(입력한 곳만).
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useEffect, useRef } from "react";
import type { ListRow } from "@/lib/list-rows";
import type { RowStatus } from "./reservoir-table";

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
const COLOR = { pass: "#1f6fb2", fail: "#b42318", none: "#8c959f", entered: "#57606a" } as const;

export function ReservoirMap({ rows, status, selected, onSelect }: { rows: ListRow[]; status: Record<string, RowStatus>; selected: string | null; onSelect: (code: string) => void }) {
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const layer = useRef<L.LayerGroup | null>(null);
  const markers = useRef(new Map<string, L.CircleMarker>());
  const onSelectRef = useRef(onSelect);
  useEffect(() => {
    onSelectRef.current = onSelect;
  });

  useEffect(() => {
    if (!box.current || map.current) return;
    const m = L.map(box.current, { preferCanvas: true, zoomControl: true, attributionControl: true }).setView([36.2, 127.8], 7);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 16,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(m);
    map.current = m;
    layer.current = L.layerGroup().addTo(m);
    // 접혀 있다가 펼쳐지면(모바일) 크기를 다시 잰다
    const ro = new ResizeObserver(() => m.invalidateSize());
    ro.observe(box.current);
    return () => {
      ro.disconnect();
      m.remove();
      map.current = null;
    };
  }, []);

  // 점 다시 그리기 (필터·판정이 바뀔 때)
  useEffect(() => {
    const m = map.current, g = layer.current;
    if (!m || !g) return;
    g.clearLayers();
    markers.current.clear();
    const renderer = L.canvas({ padding: 0.5 });
    const pts: L.LatLngExpression[] = [];
    for (const r of rows) {
      if (r.lat === null || r.lon === null) continue;
      const st = status[r.code] ?? "none";
      const color = COLOR[st];
      const approx = r.loc === "approx";
      const judged = st === "pass" || st === "fail";
      const mk = L.circleMarker([r.lat, r.lon], {
        renderer,
        radius: st === "fail" ? 9 : st === "pass" ? 6 : 4, // 색만으로 구분하지 않게 크기도 다르게
        color: judged ? "#ffffff" : color,
        weight: judged ? 2 : approx ? 1.5 : 0,
        fillColor: color,
        fillOpacity: approx && !judged ? 0 : 0.9,
      });
      const verdict = st === "pass" ? "적합" : st === "fail" ? "부적합" : st === "entered" ? "입력됨" : "미입력";
      mk.bindTooltip(`${r.name} · ${r.address}${approx ? " (위치 근사)" : ""} · ${verdict}`);
      mk.bindPopup(`<b>${esc(r.name)}</b><br>${esc(r.address)}${approx ? "<br>위치 근사(소재지 중심)" : ""}<br>${verdict}<br><a href="/r/${r.code}">상세 보기 →</a>`);
      mk.on("click", () => onSelectRef.current(r.code));
      mk.addTo(g);
      markers.current.set(r.code, mk);
      pts.push([r.lat, r.lon]);
    }
    if (pts.length > 0 && pts.length < 3402) m.fitBounds(L.latLngBounds(pts), { padding: [24, 24], maxZoom: 12 });
  }, [rows, status]);

  // 표에서 고른 저수지 강조
  useEffect(() => {
    const mk = selected ? markers.current.get(selected) : null;
    if (!mk || !map.current) return;
    mk.bringToFront();
    mk.openTooltip();
    if (!map.current.getBounds().contains(mk.getLatLng())) map.current.panTo(mk.getLatLng());
  }, [selected]);

  return (
    <div className="relative h-full overflow-hidden rounded-lg border border-line">
      <div ref={box} className="map-gray h-full w-full" role="region" aria-label="저수지 위치 지도. 표에서도 같은 저수지를 고를 수 있습니다" />
      <div className="pointer-events-none absolute bottom-3 left-3 z-[400] rounded-md border border-line bg-white/95 px-3 py-2 text-[13px] leading-6 text-ink">
        <p><span aria-hidden="true" className="mr-2 inline-block size-2.5 rounded-full bg-[#8c959f]" />좌표 있음 (공유플랫폼)</p>
        <p><span aria-hidden="true" className="mr-2 inline-block size-2.5 rounded-full border-[1.5px] border-[#8c959f]" />위치 근사 (소재지 중심)</p>
        <p><span aria-hidden="true" className="mr-2 inline-block size-2.5 rounded-full bg-pass" />적합(작은 점) <span aria-hidden="true" className="mr-2 ml-3 inline-block size-3.5 rounded-full bg-fail align-middle" />부적합(큰 점) <span className="text-sub">(입력한 곳만)</span></p>
        <p className="text-sub">키보드는 오른쪽 표에서 ↑↓ · Enter</p>
      </div>
    </div>
  );
}
