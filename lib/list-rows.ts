// 전국 목록·지도에 넘기는 가벼운 행 (제원 3,402곳). 순수 함수.
import type { ReservoirRecord } from "./data";

export interface ListRow {
  code: string;
  name: string;
  address: string; // 시·군 뒤부터 (도 이름 생략)
  sido: string;
  hq: string;
  branch: string;
  catchmentHa: number | null;
  totalStorageThousandM3: number | null;
  floodFreqYr: number | null;
  lat: number | null;
  lon: number | null;
  loc: "safetydata" | "approx" | "none";
  /** 공유플랫폼 좌표의 자릿수로 본 정밀도(m). 근사·없음이면 null */
  precisionM: number | null;
  flagCount: number;
}

export function toListRow(r: ReservoirRecord): ListRow {
  const parts = (r.spec.address ?? "").split(/\s+/);
  const c = r.coord;
  return {
    code: r.spec.code,
    name: r.spec.name,
    address: parts.slice(1).join(" "),
    sido: parts[0] ?? "",
    hq: r.spec.hq ?? "",
    branch: r.spec.branch ?? "",
    catchmentHa: r.spec.catchmentHa,
    totalStorageThousandM3: r.spec.totalStorageThousandM3,
    floodFreqYr: r.spec.floodFreqYr,
    lat: c && c.source !== "none" ? Math.round(c.lat * 1e5) / 1e5 : null,
    lon: c && c.source !== "none" ? Math.round(c.lon * 1e5) / 1e5 : null,
    loc: c?.source ?? "none",
    precisionM: c && c.source === "safetydata" ? c.precisionM : null,
    flagCount: r.spec.flags.length,
  };
}
