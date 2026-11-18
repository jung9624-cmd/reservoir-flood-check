// 가까운 ASOS 고르기 (30년 이상 자료). 거리 계산 방식·관측소 좌표는 확인 필요(docs/calc-rules.md 1-4).
import type { Station } from "./types";
import { notImplemented } from "./not-implemented";

export function nearestStation(lat: number, lon: number, stations: Station[], minYears = 30): Station {
  void lat; void lon; void stations; void minYears;
  return notImplemented("nearestStation");
}
