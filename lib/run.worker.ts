// 계산을 Web Worker에서 돌린다 (입력 후 결과까지 200 ms를 넘을 때, hooks/use-run.ts)
import { runAll, type RunData } from "./run";
import type { PublicSpec, RunOptions, UserInputs } from "./types";

export interface RunRequest {
  id: number;
  jobs: { key: string; spec: PublicSpec; inputs: UserInputs; options: RunOptions; data: RunData }[];
}

self.onmessage = (e: MessageEvent<RunRequest>) => {
  const { id, jobs } = e.data;
  const results = jobs.map((j) => {
    try {
      return { key: j.key, result: runAll(j.spec, j.inputs, j.options, j.data) };
    } catch (err) {
      return { key: j.key, result: { ok: false as const, issues: [{ field: "계산", reason: err instanceof Error ? err.message : "알 수 없는 오류" }] } };
    }
  });
  (self as unknown as Worker).postMessage({ id, results });
};
