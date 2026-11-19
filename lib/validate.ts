// 입력 검사: 예외 대신 "항목 + 이유" 목록을 돌려준다. 목록이 비어 있지 않으면 계산하지 않는다.
import type { PublicSpec, RunOptions, SpecOverrideField, UserInputs, ValidationIssue } from "./types";
import { powerExponent } from "./storage";
import { applySpecOverrides } from "./spec";

const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

/** 제원은 inputs.specOverrides를 반영한 값으로 검사한다. 제원 문제에는 specField를 붙인다(그 값을 입력하면 풀림) */
export function validateInputs(rawSpec: PublicSpec, inputs: UserInputs, options: RunOptions): ValidationIssue[] {
  const spec = applySpecOverrides(rawSpec, inputs.specOverrides);
  const out: ValidationIssue[] = [];
  const add = (field: string, reason: string, specField?: SpecOverrideField) => out.push(specField ? { field, reason, specField } : { field, reason });

  // --- 제원 ---
  if (!isNum(spec.catchmentHa) || spec.catchmentHa <= 0) add("제원.유역면적", "유역면적이 없거나 0 이하입니다", "catchmentHa");
  if (!isNum(spec.fullLevelElM) || spec.fullLevelElM === 0) add("제원.만수위", "만수위가 없거나 0입니다", "fullLevelElM");
  const table = inputs.storageTable;
  if (table && table.length > 0) {
    if (table.length < 2) add("설계 내용적표", "2행 이상이어야 합니다");
    const sorted = [...table].sort((a, b) => a.levelElM - b.levelElM);
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i].levelElM === sorted[i - 1].levelElM) add("설계 내용적표", `표고 ${sorted[i].levelElM}가 중복됩니다`);
      else if (sorted[i].storageM3 <= sorted[i - 1].storageM3) add("설계 내용적표", `표고 ${sorted[i].levelElM}에서 저수량이 늘지 않습니다`);
    }
    if (sorted.some((p) => !isNum(p.levelElM) || !isNum(p.storageM3))) add("설계 내용적표", "숫자가 아닌 값이 있습니다");
  } else {
    // 제원 근사 곡선에 필요한 값
    if (!isNum(spec.fullAreaHa) || spec.fullAreaHa <= 0) add("제원.만수면적", "만수면적이 없거나 0입니다 (내용적 곡선을 만들 수 없음)", "fullAreaHa");
    if (!isNum(spec.totalStorageThousandM3) || spec.totalStorageThousandM3 <= 0) add("제원.총저수량", "총저수량이 없거나 0입니다", "totalStorageThousandM3");
    if (!isNum(spec.deadLevelElM)) add("제원.사수위", "사수위가 없습니다", "deadLevelElM");
    // 사수위 음수는 막지 않는다(바닷가 담수호 등, 곡선 식은 h − h사수만 쓴다. data-audit 9.1)
    if (isNum(spec.deadLevelElM) && isNum(spec.fullLevelElM) && spec.deadLevelElM >= spec.fullLevelElM) {
      add("제원.사수위", "사수위가 만수위 이상입니다", "deadLevelElM");
    }
    if (out.length === 0) {
      const m = powerExponent({
        fullLevelElM: spec.fullLevelElM!,
        deadLevelElM: spec.deadLevelElM!,
        totalStorageThousandM3: spec.totalStorageThousandM3!,
        fullAreaHa: spec.fullAreaHa!,
      });
      if (!(m > 0) || !Number.isFinite(m)) add("제원.내용적 곡선", `지수 m = ${m}로 곡선을 만들 수 없습니다 (만수면적·총저수량을 확인)`, "fullAreaHa");
    }
  }

  // --- 입력값 ---
  const full = spec.fullLevelElM;
  const crest = inputs.spillway.crestElM ?? full;
  if (!isNum(inputs.spillway.widthM) || inputs.spillway.widthM <= 0) add("물넘이 폭", "0보다 커야 합니다");
  if (inputs.spillway.coefficient !== undefined && !(inputs.spillway.coefficient > 0)) add("물넘이 유량계수", "0보다 커야 합니다");
  if (!isNum(inputs.damCrestElM)) add("제정표고", "값이 없습니다");
  else {
    if (isNum(full) && inputs.damCrestElM <= full) add("제정표고", `만수위(EL.${full})보다 높아야 합니다`);
    if (isNum(crest) && crest > inputs.damCrestElM) add("물넘이 마루표고", "제정표고 이하여야 합니다");
  }
  if (!isNum(crest)) add("물넘이 마루표고", "값이 없습니다 (만수위도 없음)");
  inputs.extraOutlets.forEach((o, i) => {
    const name = `추가 방류시설 ${i + 1}${o.name ? ` (${o.name})` : ""}`;
    if (!(o.widthM > 0)) add(name, "폭은 0보다 커야 합니다");
    if (!(o.coefficient > 0)) add(name, "유량계수는 0보다 커야 합니다");
    if (!isNum(o.crestElM)) add(name, "마루(바닥)표고가 없습니다");
    else if (isNum(inputs.damCrestElM) && o.crestElM > inputs.damCrestElM) add(name, "마루(바닥)표고가 제정표고보다 높습니다");
  });
  if (!isNum(inputs.cn.value) || inputs.cn.value < 30 || inputs.cn.value > 100) add("CN", "30~100이어야 합니다");

  if (options.tcKMethod === "direct") {
    if (!(inputs.timing.tcHr! > 0)) add("Tc", "0보다 커야 합니다");
    if (!(inputs.timing.kHr! > 0)) add("K", "0보다 커야 합니다");
  } else {
    if (!(inputs.timing.channelLengthKm! > 0)) add("유로연장", "0보다 커야 합니다");
    if (!(inputs.timing.farthestPointElM! > 0)) add("최원점 표고", "0보다 커야 합니다");
  }

  // --- 옵션 ---
  if (!(options.returnPeriodYr > 1)) add("재현기간", "1년보다 커야 합니다");
  if (options.rainfallOverrideMm) {
    if (options.rainfallOverrideMm.length !== 10 || options.rainfallOverrideMm.some((v) => !(v > 0))) {
      add("확률강우량(직접 입력)", "지속기간 10개 모두 0보다 큰 값이어야 합니다");
    }
  } else if (!(options.lastYear >= options.firstYear)) add("자료기간", "끝 해가 첫 해보다 앞섭니다");
  if (options.initialLevelElM !== undefined && isNum(inputs.damCrestElM) && options.initialLevelElM > inputs.damCrestElM) {
    add("초기수위", "제정표고보다 높습니다");
  }
  return out;
}
