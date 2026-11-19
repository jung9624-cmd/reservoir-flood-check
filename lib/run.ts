// 지속기간 10개 일괄 실행: 확률강우량 → Huff → 유효우량 → Clark → 할증 → 홍수추적 → 판정.
// 순수 함수. 자료(연최대·Huff)는 인자로 받는다(파일·네트워크를 읽지 않음).
import type {
  AnnualMaxFile, DurationResult, HuffFile, Outlet, ProbableRainfall, PublicSpec, ReservoirSpec,
  RunOptions, RunResult, RunWarning, Sourced, SpecOverrideField, UserInputs, ValueSource,
} from "./types";
import { DURATIONS_MIN } from "./types";
import { probableRainfall } from "./rainfall";
import { huffHyetograph } from "./hyetograph";
import { clarkHydrograph, cn2ToCn3, effectiveRainfall, FILL_DAM_FACTOR, isFillDam, scaleSeries, seokyeongTcK } from "./runoff";
import { storageFromSpec, storageFromTable, type StorageCurve } from "./storage";
import { modifiedPuls } from "./routing";
import { judge } from "./judge";
import { validateInputs } from "./validate";
import { AREA_REDUCTION_CATCHMENT_KM2, haToKm2 } from "./units";
import { applySpecOverrides, overriddenFields, SPEC_FIELD_LABEL, specAnomalies } from "./spec";

export const DEFAULT_SPILLWAY_COEFFICIENT = 2.0; // CLAUDE.md 5-9
export const HYDROGRAPH_DT_MIN = 10; // CLAUDE.md 5-12
export const ROUTING_DT_MIN = 1;

export interface RunData {
  annualMax?: AnnualMaxFile; // rainfallOverrideMm가 없으면 필요
  huff: Pick<HuffFile, "timePct" | "cumulativePct">;
}

/** 제원 1행 → 계산에 쓰는 값 */
export function toPublicSpec(r: ReservoirSpec, asOf: string): PublicSpec {
  return {
    code: r.code,
    name: r.name,
    catchmentHa: r.catchmentHa,
    fullLevelElM: r.fullLevelElM,
    floodLevelElM: r.floodLevelElM,
    deadLevelElM: r.deadLevelElM,
    totalStorageThousandM3: r.totalStorageThousandM3,
    fullAreaHa: r.fullAreaHa,
    damType: r.damType,
    floodFreqYr: r.floodFreqYr,
    asOf,
  };
}

const INPUT: ValueSource = { kind: "input" };
const auto = (source: string): ValueSource => ({ kind: "auto", source });

export function runAll(rawSpec: PublicSpec, inputs: UserInputs, options: RunOptions, data: RunData): RunResult {
  const issues = validateInputs(rawSpec, inputs, options);
  if (!options.rainfallOverrideMm && !data.annualMax) issues.push({ field: "강우 자료", reason: `관측소 ${options.stationCode}의 연최대 자료가 없습니다` });
  if (issues.length > 0) return { ok: false, issues };

  // --- 제원 (사용자가 넣은 항목은 그 값, 출처 "입력") ---
  const spec = applySpecOverrides(rawSpec, inputs.specOverrides);
  const overridden = new Set(overriddenFields(inputs.specOverrides));
  const specSrc = `제원 15044339 (${spec.asOf})`;
  const srcOf = (k: SpecOverrideField): ValueSource => (overridden.has(k) ? INPUT : auto(specSrc));
  const used: Record<string, Sourced<number | string>> = {};
  const warnings: RunWarning[] = [];

  const catchmentKm2 = haToKm2(spec.catchmentHa!);
  const fullLevel = spec.fullLevelElM!;
  used.catchmentHa = { value: spec.catchmentHa!, source: srcOf("catchmentHa") };
  used.fullLevelElM = { value: fullLevel, source: srcOf("fullLevelElM") };
  if (spec.floodLevelElM !== null) used.floodLevelElM = { value: spec.floodLevelElM, source: srcOf("floodLevelElM") };
  if (spec.damType) used.damType = { value: spec.damType, source: srcOf("damType") };
  for (const a of specAnomalies(spec)) if (!overridden.has(a.specField)) warnings.push({ code: "specAnomaly", message: a.message });

  // --- CN ---
  const cn3 = inputs.cn.amc === "III" ? inputs.cn.value : cn2ToCn3(inputs.cn.value);
  used.cn3 = { value: cn3, source: inputs.cn.amc === "III" ? INPUT : auto(`CN-Ⅱ ${inputs.cn.value} → 23·CN/(10+0.13·CN)`) };

  // --- Tc·K ---
  let tcHr: number;
  let kHr: number;
  if (options.tcKMethod === "direct") {
    tcHr = inputs.timing.tcHr!;
    kHr = inputs.timing.kHr!;
    used.tcHr = { value: tcHr, source: INPUT };
    used.kHr = { value: kHr, source: INPUT };
  } else {
    const alpha = options.seokyeongAlpha ?? 1.45;
    ({ tcHr, kHr } = seokyeongTcK(inputs.timing.channelLengthKm!, inputs.timing.farthestPointElM!, catchmentKm2, alpha));
    const src = auto(`서경대 공식 (L ${inputs.timing.channelLengthKm} km, H ${inputs.timing.farthestPointElM} m, α ${alpha})`);
    used.tcHr = { value: tcHr, source: src };
    used.kHr = { value: kHr, source: src };
    warnings.push({ code: "seokyeongDefinition", message: "서경대 공식의 H 정의와 α 선택 기준은 확인이 필요합니다" });
  }

  // --- 방류시설 ---
  const spillway: Outlet = {
    name: "물넘이",
    widthM: inputs.spillway.widthM,
    crestElM: inputs.spillway.crestElM ?? fullLevel,
    coefficient: inputs.spillway.coefficient ?? DEFAULT_SPILLWAY_COEFFICIENT,
    open: true,
  };
  used.spillwayWidthM = { value: spillway.widthM, source: INPUT };
  used.spillwayCrestElM = { value: spillway.crestElM, source: inputs.spillway.crestElM === undefined ? auto(`만수위 (${specSrc})`) : INPUT };
  used.spillwayCoefficient = { value: spillway.coefficient, source: inputs.spillway.coefficient === undefined ? auto("기본값 2.0 (CLAUDE.md 5-9)") : INPUT };
  const outlets: Outlet[] = [spillway, ...inputs.extraOutlets];
  used.damCrestElM = { value: inputs.damCrestElM, source: INPUT };

  // --- 내용적 곡선 ---
  const curve: StorageCurve =
    inputs.storageTable && inputs.storageTable.length > 0
      ? storageFromTable(inputs.storageTable)
      : storageFromSpec({
          fullLevelElM: fullLevel,
          deadLevelElM: spec.deadLevelElM!,
          totalStorageThousandM3: spec.totalStorageThousandM3!,
          fullAreaHa: spec.fullAreaHa!,
          asOf: spec.asOf,
        });
  const curveFields = (["deadLevelElM", "totalStorageThousandM3", "fullAreaHa", "fullLevelElM"] as const).filter((k) => overridden.has(k));
  used.storageCurve = {
    value: curve.kind,
    source: curve.kind === "spec-power" && curveFields.length > 0 && curve.source.kind === "auto"
      ? auto(`${curve.source.source} — 입력값 사용: ${curveFields.map((k) => SPEC_FIELD_LABEL[k]).join(", ")}`)
      : curve.source,
  };
  if (curve.kind === "spec-power") {
    used.deadLevelElM = { value: spec.deadLevelElM!, source: srcOf("deadLevelElM") };
    used.totalStorageThousandM3 = { value: spec.totalStorageThousandM3!, source: srcOf("totalStorageThousandM3") };
    used.fullAreaHa = { value: spec.fullAreaHa!, source: srcOf("fullAreaHa") };
  }

  const initialLevel = options.initialLevelElM ?? fullLevel;
  used.initialLevelElM = { value: initialLevel, source: options.initialLevelElM === undefined ? auto("만수위 (보고서 3.4.3)") : INPUT };

  // --- 할증 ---
  const factor = isFillDam(spec.damType) ? FILL_DAM_FACTOR : 1;
  used.designFactor = { value: factor, source: auto(`${factor === 1 ? `제체형식 ${spec.damType ?? "없음"} → 할증 없음` : "필댐 × 1.2 (CLAUDE.md 5-7)"}${overridden.has("damType") ? " (제체형식 입력)" : ""}`) };

  // --- 확률강우량 ---
  let rainfall: ProbableRainfall;
  if (options.rainfallOverrideMm) {
    rainfall = {
      durationMin: [...DURATIONS_MIN],
      conversionFactor: DURATIONS_MIN.map(() => NaN),
      rainfallMm: [...options.rainfallOverrideMm],
      nYears: 0,
      source: INPUT,
    };
  } else {
    rainfall = probableRainfall(data.annualMax!, {
      timeConvention: options.timeConvention,
      firstYear: options.firstYear,
      lastYear: options.lastYear,
      returnPeriodYr: options.returnPeriodYr,
    });
    if (rainfall.nYears < 30) warnings.push({ code: "shortRecord", message: `자료기간의 표본이 ${rainfall.nYears}년으로 30년보다 짧습니다` });
  }

  // --- 지속기간 10개 ---
  const durations: DurationResult[] = DURATIONS_MIN.map((d, j) => {
    const p = rainfall.rainfallMm[j];
    const rain = huffHyetograph(p, d, data.huff, HYDROGRAPH_DT_MIN);
    const eff = effectiveRainfall(rain, cn3);
    const raw = clarkHydrograph(eff, catchmentKm2, tcHr, kHr);
    const inflow = scaleSeries(raw, factor);
    const r = modifiedPuls(inflow, curve, outlets, initialLevel, { dtMin: ROUTING_DT_MIN });
    return {
      durationMin: d,
      rainfallMm: p,
      effectiveRainfallMm: eff.values.reduce((s, v) => s + v, 0),
      peakInflowRawCms: Math.max(...raw.values),
      peakInflowCms: Math.max(...inflow.values),
      peakOutflowCms: r.peakOutflowCms,
      initialOutflowCms: r.initialOutflowCms,
      maxLevelElM: r.maxLevelElM,
      maxStorageM3: r.maxStorageM3,
      timeOfMaxLevelMin: r.timeOfMaxLevelMin,
      inflowCms: inflow,
      outflowCms: r.outflowCms,
      levelElM: r.levelElM,
    };
  });

  const verdict = judge(durations, inputs.damCrestElM, catchmentKm2, tcHr, options.levelRoundingM ?? 0.01);

  if (catchmentKm2 >= AREA_REDUCTION_CATCHMENT_KM2) {
    warnings.push({ code: "areaReduction", message: `유역 ${catchmentKm2.toFixed(2)} km² ≥ 25.9 km²: 면적감소계수 대상이지만 1차판은 적용하지 않습니다` });
  }
  if (verdict.floodControlNotConsidered) {
    warnings.push({ code: "floodControlNotConsidered", message: "설계기준 제5편 8.2.1 홍수조절 미고려 대상 — 물넘이 설계유량은 유입량 기준 검토 필요 (유역 5 km² 이하 또는 Tc 1시간 미만)" });
  }
  if (verdict.boundaryCase) {
    warnings.push({
      code: "boundaryFreeboard",
      message: `최고수위를 반올림하기 전(EL.${verdict.maxLevelElM.toFixed(3)})으로 비교하면 판정이 바뀝니다`,
    });
  }

  return { ok: true, durations, verdict, rainfall, used, warnings };
}
