// 가까운 ASOS 고르기 (자료 30년 이상). 근거: CLAUDE.md 5.1
// 거리: 구면 대원거리(haversine, 지구 반지름 6,371 km). 관측소 좌표 출처는 data/stations.json (확인 필요, calc-rules 1-4)
import type { Station } from "./types";

const EARTH_RADIUS_KM = 6371;
const rad = (deg: number) => (deg * Math.PI) / 180;

/** 두 위경도 사이 거리 (km) */
export function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dLat = rad(lat2 - lat1);
  const dLon = rad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(a)));
}

export interface NearestStation {
  station: Station;
  distanceKm: number;
}

/**
 * 자료가 있는 해가 minYears 이상인 관측소 중 가장 가까운 곳. 없으면 null.
 * "30년 이상"을 자료가 있는 해의 수(nYears)로 센다 (calc-rules 2-6, 확인 필요).
 */
export function nearestStation(lat: number, lon: number, stations: readonly Station[], minYears = 30): NearestStation | null {
  let best: NearestStation | null = null;
  for (const s of stations) {
    if (s.nYears < minYears) continue;
    const d = distanceKm(lat, lon, s.lat, s.lon);
    if (!best || d < best.distanceKm) best = { station: s, distanceKm: d };
  }
  return best;
}
