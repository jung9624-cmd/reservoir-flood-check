// 내용적 곡선: 제원 멱함수 근사 / 설계 내용적표 선형보간. 근거: CLAUDE.md 5.3, docs/calc-rules.md 5.1
import type { StoragePoint, ValueSource } from "./types";
import { interpLinear } from "./hyetograph";
import { haToM2, thousandM3ToM3 } from "./units";

export interface StorageCurve {
  kind: "spec-power" | "design-table";
  source: ValueSource;
  /** 곡선이 0이 되는 가장 낮은 표고 (이분법 하한) */
  minLevelElM: number;
  /** 표고(EL.m) → 저수량(m³) */
  storageAt(levelElM: number): number;
  /** 제원 곡선의 지수 m (설계표면 null) */
  exponent: number | null;
}

export interface SpecStorageInput {
  fullLevelElM: number;
  deadLevelElM: number;
  totalStorageThousandM3: number;
  fullAreaHa: number;
  asOf: string;
}

/** m = A만수·(h만수 − h사수)/S만수 (A: m², S: m³) */
export function powerExponent(s: Omit<SpecStorageInput, "asOf">): number {
  return (haToM2(s.fullAreaHa) * (s.fullLevelElM - s.deadLevelElM)) / thousandM3ToM3(s.totalStorageThousandM3);
}

/**
 * S(h) = S만수·((h − h사수)/(h만수 − h사수))^m. 사수위 아래는 0.
 * 만수위(제정) 위로는 같은 식을 연장한다(외삽).
 */
export function storageFromSpec(s: SpecStorageInput): StorageCurve {
  const sFull = thousandM3ToM3(s.totalStorageThousandM3);
  const range = s.fullLevelElM - s.deadLevelElM;
  const m = powerExponent(s);
  return {
    kind: "spec-power",
    source: { kind: "auto", source: `제원 근사 S = S만수·((h−h사수)/(h만수−h사수))^${m.toFixed(3)} (15044339, ${s.asOf})` },
    minLevelElM: s.deadLevelElM,
    exponent: m,
    storageAt(h) {
      if (h <= s.deadLevelElM) return 0;
      return sFull * ((h - s.deadLevelElM) / range) ** m;
    },
  };
}

/**
 * 설계 내용적표 선형보간 (보간 방법 확인 필요, calc-rules 5.1).
 * 표 아래는 첫 행 값, 표 위(제정 위)는 마지막 두 행의 기울기로 선형 외삽.
 */
export function storageFromTable(points: readonly StoragePoint[]): StorageCurve {
  const sorted = [...points].sort((a, b) => a.levelElM - b.levelElM);
  const xs = sorted.map((p) => p.levelElM);
  const ys = sorted.map((p) => p.storageM3);
  const n = xs.length;
  const slope = (ys[n - 1] - ys[n - 2]) / (xs[n - 1] - xs[n - 2]);
  return {
    kind: "design-table",
    source: { kind: "input", },
    minLevelElM: xs[0],
    exponent: null,
    storageAt(h) {
      if (h > xs[n - 1]) return ys[n - 1] + (h - xs[n - 1]) * slope;
      return interpLinear(h, xs, ys);
    },
  };
}

/** 저수량(m³) → 표고(EL.m). 곡선을 이분법으로 거꾸로 푼다 (초기수위 시나리오용) */
export function levelForStorage(curve: StorageCurve, storageM3: number, topElM: number): number {
  let lo = curve.minLevelElM;
  let hi = topElM;
  if (storageM3 <= 0) return lo;
  for (let i = 0; i < 100 && hi - lo > 1e-6; i++) {
    const mid = (lo + hi) / 2;
    if (curve.storageAt(mid) > storageM3) hi = mid;
    else lo = mid;
  }
  return (lo + hi) / 2;
}
