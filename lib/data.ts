// data/ JSON 읽기, 표준코드로 합치기. JSON은 scripts/가 만든다(CLAUDE.md 7).
import reservoirs from "@/data/reservoirs.json";
import coords from "@/data/coords.json";
import stations from "@/data/stations.json";
import storage2025 from "@/data/storage-2025.json";
import type { ReservoirCoord, ReservoirSpec, Station } from "./types";

export interface StorageRate2025 {
  code: string;
  floodSeasonMean_pct: number | null;
  floodSeasonMax_pct: number | null;
}

export interface ReservoirRecord {
  spec: ReservoirSpec;
  coord: ReservoirCoord | null;
  storage2025: StorageRate2025 | null;
}

export const specs = reservoirs as unknown as ReservoirSpec[];
export const coordList = coords as unknown as ReservoirCoord[];
export const stationList = stations as unknown as Station[];
export const storageList = storage2025 as unknown as StorageRate2025[];

/** 표준코드로 제원·좌표·저수율을 합친다 */
export function getReservoir(code: string): ReservoirRecord | null {
  const spec = specs.find((s) => s.code === code);
  if (!spec) return null;
  return {
    spec,
    coord: coordList.find((c) => c.code === code) ?? null,
    storage2025: storageList.find((s) => s.code === code) ?? null,
  };
}

export function listReservoirs(): ReservoirRecord[] {
  return specs.map((s) => getReservoir(s.code)!);
}
