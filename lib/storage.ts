// 내용적 곡선: 제원 근사(지수 곡선) / 설계 내용적표. 근거: CLAUDE.md 5.3
import type { ReservoirSpec, StoragePoint } from "./types";
import { notImplemented } from "./not-implemented";

export interface StorageCurve {
  kind: "spec-approx" | "design-table";
  storageAt(level_el: number): number; // m³
}

export function storageFromSpec(spec: ReservoirSpec): StorageCurve {
  void spec;
  return notImplemented("storageFromSpec");
}

export function storageFromTable(points: StoragePoint[]): StorageCurve {
  void points;
  return notImplemented("storageFromTable");
}
