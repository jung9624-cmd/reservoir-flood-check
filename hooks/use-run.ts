"use client";

// 계산 실행 훅. 계산 자체는 lib/run.ts(React와 무관)를 부른다.
// - 같은 입력은 다시 계산하지 않는다(모듈 수준 캐시, 키 = 입력 JSON)
// - 한 번이라도 입력 후 결과까지 200 ms를 넘으면 그 뒤로는 Web Worker에서 계산한다
import { useEffect, useMemo, useRef, useState } from "react";
import { runAll, type RunData } from "@/lib/run";
import type { RunRequest } from "@/lib/run.worker";
import type { PublicSpec, RunOptions, RunResult, UserInputs } from "@/lib/types";

export interface RunJob {
  spec: PublicSpec;
  inputs: UserInputs;
  options: RunOptions;
}

const WORKER_THRESHOLD_MS = 200;
const SEP = "\n"; // JSON.stringify 결과에는 줄바꿈 글자가 들어가지 않는다
const CACHE_MAX = 200;
const cache = new Map<string, RunResult>();
let preferWorker = false;
let worker: Worker | null = null;
let nextId = 1;

function remember(key: string, r: RunResult) {
  if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value!);
  cache.set(key, r);
}

let workerBroken = false;

/** 계산이 예외를 던져도 화면이 멈추지 않게 "계산할 수 없음" 결과로 바꾼다 */
export function safeRun(j: RunJob, data: RunData): RunResult {
  try {
    return runAll(j.spec, j.inputs, j.options, data);
  } catch (e) {
    return { ok: false, issues: [{ field: "계산", reason: e instanceof Error ? e.message : "알 수 없는 오류" }] };
  }
}

function getWorker(): Worker | null {
  if (workerBroken) return null;
  if (worker) return worker;
  try {
    worker = new Worker(new URL("../lib/run.worker.ts", import.meta.url), { type: "module" });
  } catch {
    worker = null;
  }
  return worker;
}

/** 계산 키: 입력·옵션·자료(관측소) */
export const jobKey = (j: RunJob, stationCode: string | undefined) => JSON.stringify([j.spec, j.inputs, j.options, stationCode ?? null]);

export function useRun(jobs: (RunJob | null)[], data: RunData) {
  const keys = useMemo(
    () => jobs.map((j) => (j ? jobKey(j, j.options.rainfallOverrideMm ? undefined : data.annualMax?.station) : null)),
    [jobs, data],
  );
  const [, setVersion] = useState(0);
  const [pending, setPending] = useState(false);
  const [lastMs, setLastMs] = useState<number | null>(null);
  const latest = useRef(0);
  const jobsRef = useRef(jobs);
  useEffect(() => {
    jobsRef.current = jobs;
  });
  // 배열이 새로 만들어져도 내용(키)이 같으면 다시 돌지 않게 문자열로 비교한다
  const keysStr = keys.map((k) => k ?? "").join(SEP);

  useEffect(() => {
    const todo = jobsRef.current
      .map((j, i) => ({ j, key: keysStr.split(SEP)[i] || null }))
      .filter((x): x is { j: RunJob; key: string } => !!x.j && !!x.key && !cache.has(x.key));
    if (todo.length === 0) return;
    const id = nextId++;
    latest.current = id;
    const t0 = performance.now();
    const done = () => {
      const ms = performance.now() - t0;
      if (ms > WORKER_THRESHOLD_MS) preferWorker = true;
      if (latest.current === id) {
        setLastMs(ms);
        setPending(false);
        setVersion((v) => v + 1);
      }
    };
    setPending(true);
    const runHere = () => {
      for (const { j, key } of todo) remember(key, safeRun(j, data));
      done();
    };
    const w = preferWorker ? getWorker() : null;
    if (w) {
      let settled = false;
      const cleanup = () => {
        w.removeEventListener("message", onMsg);
        w.removeEventListener("error", onErr);
        clearTimeout(timeout);
      };
      const onMsg = (e: MessageEvent<{ id: number; results: { key: string; result: RunResult }[] }>) => {
        if (e.data.id !== id || settled) return;
        settled = true;
        cleanup();
        e.data.results.forEach((r) => remember(r.key, r.result));
        done();
      };
      // 워커를 못 띄우거나 응답이 없으면 이 화면에서 계산한다
      const onErr = () => {
        if (settled) return;
        settled = true;
        cleanup();
        workerBroken = true;
        worker?.terminate();
        worker = null;
        runHere();
      };
      const timeout = setTimeout(onErr, 15_000);
      w.addEventListener("message", onMsg);
      w.addEventListener("error", onErr);
      const req: RunRequest = { id, jobs: todo.map(({ j, key }) => ({ key, ...j, data })) };
      w.postMessage(req);
      return () => {
        settled = true;
        cleanup();
      };
    }
    // 화면을 먼저 그리고 계산한다
    const timer = setTimeout(runHere, 0);
    return () => clearTimeout(timer);
  }, [keysStr, data]);

  const results = keys.map((k) => (k ? cache.get(k) ?? null : null));
  return { results, pending, lastMs, worker: preferWorker };
}
