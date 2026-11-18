// data/ JSON 읽기, 표준코드로 합치기. JSON은 scripts/preprocess.py가 만든다(CLAUDE.md 7).
import reservoirsFile from "@/data/reservoirs.json";
import coordsFile from "@/data/coords.json";
import storageFile from "@/data/storage-2025.json";
import type { ReservoirCoord, ReservoirSpec, ReservoirsFile, StorageRate2025 } from "./types";

export interface ReservoirRecord {
  spec: ReservoirSpec;
  coord: ReservoirCoord | null;
  storage2025: StorageRate2025 | null;
}

const reservoirs = reservoirsFile as unknown as ReservoirsFile;

/** 제원 기준일 (화면에 표시, CLAUDE.md 3.1) */
export const specAsOf: string = reservoirs.asOf;
export const specs: ReservoirSpec[] = reservoirs.reservoirs;

const coordByCode = new Map(
  (coordsFile.coords as unknown as ReservoirCoord[]).map((c) => [c.code, c]),
);
const storageByCode = new Map(
  (storageFile.items as unknown as StorageRate2025[]).map((s) => [s.code, s]),
);
const specByCode = new Map(specs.map((s) => [s.code, s]));

/** 표준코드로 제원·좌표·저수율을 합친다 */
export function getReservoir(code: string): ReservoirRecord | null {
  const spec = specByCode.get(code);
  if (!spec) return null;
  return {
    spec,
    coord: coordByCode.get(code) ?? null,
    storage2025: storageByCode.get(code) ?? null,
  };
}

export function listReservoirs(): ReservoirRecord[] {
  return specs.map((s) => getReservoir(s.code)!);
}
