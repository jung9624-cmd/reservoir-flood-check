// 지속기간 10개 일괄 실행
import type { DurationResult, ReservoirSpec, UserInputs, Verdict } from "./types";
import { notImplemented } from "./not-implemented";

export interface RunOutput {
  durations: DurationResult[];
  verdict: Verdict;
}

export function runAll(spec: ReservoirSpec, inputs: UserInputs, probableRainfall_mm: number[]): RunOutput {
  void spec; void inputs; void probableRainfall_mm;
  return notImplemented("runAll");
}
