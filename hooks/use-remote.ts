"use client";

// 브라우저에서 부르는 자료: 관측소 연최대(/api/annual-max), 현재 수위(/api/water-level)
import { useEffect, useState } from "react";
import type { AnnualMaxFile } from "@/lib/types";

const annualCache = new Map<string, Promise<AnnualMaxFile | null>>();

function fetchAnnualMax(station: string): Promise<AnnualMaxFile | null> {
  let p = annualCache.get(station);
  if (!p) {
    p = fetch(`/api/annual-max/${station}`)
      .then((r) => (r.ok ? (r.json() as Promise<AnnualMaxFile>) : null))
      .catch(() => null);
    annualCache.set(station, p);
  }
  return p;
}

export function useAnnualMax(station: string | null) {
  const [state, setState] = useState<{ station: string | null; data: AnnualMaxFile | null; loading: boolean }>({ station: null, data: null, loading: false });
  useEffect(() => {
    if (!station) return;
    let alive = true;
    fetchAnnualMax(station).then((data) => alive && setState({ station, data, loading: false }));
    return () => {
      alive = false;
    };
  }, [station]);
  return station && state.station === station ? state : { station, data: null, loading: !!station };
}

export type WaterLevelState =
  | { status: "loading" }
  | { status: "ok"; date: string; levelElM: number | null; ratePct: number | null; source: string }
  | { status: "none"; reason: string };

export function useWaterLevel(code: string): WaterLevelState {
  const [s, setS] = useState<WaterLevelState>({ status: "loading" });
  useEffect(() => {
    let alive = true;
    fetch(`/api/water-level?code=${code}`)
      .then((r) => r.json())
      .then((j) => {
        if (!alive) return;
        if (j.available) setS({ status: "ok", date: j.date, levelElM: j.levelElM, ratePct: j.ratePct, source: j.source });
        else setS({ status: "none", reason: j.reason ?? "자료 없음" });
      })
      .catch(() => alive && setS({ status: "none", reason: "수위 API에 연결할 수 없습니다" }));
    return () => {
      alive = false;
    };
  }, [code]);
  return s;
}
