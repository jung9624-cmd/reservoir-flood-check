// 사용자 입력값을 표준코드별로 브라우저에 저장 (CLAUDE.md 7: 1차판은 브라우저 저장 + JSON 내보내기·불러오기).
// React와 무관. 저장소 접근은 모두 try/catch (사생활 보호 모드 등에서 실패할 수 있음).
import type { InputDraft } from "./draft";
import type { TimeConvention } from "./types";

export interface SavedOptions {
  stationCode: string;
  firstYear: number | null;
  lastYear: number | null;
  timeConvention: TimeConvention;
  returnPeriodYr: number;
}

export interface SavedEntry {
  draft: InputDraft;
  options: SavedOptions;
  /** 마지막 판정 (목록의 입력 상태 칸) */
  verdict: "pass" | "fail" | null;
  savedAt: string;
}

const PREFIX = "rfc:v1:";
export const EXPORT_VERSION = 1;

function storage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function loadEntry(code: string): SavedEntry | null {
  try {
    const raw = storage()?.getItem(PREFIX + code);
    return raw ? (JSON.parse(raw) as SavedEntry) : null;
  } catch {
    return null;
  }
}

export function saveEntry(code: string, entry: SavedEntry): boolean {
  try {
    storage()?.setItem(PREFIX + code, JSON.stringify(entry));
    return true;
  } catch {
    return false;
  }
}

export function removeEntry(code: string): void {
  try {
    storage()?.removeItem(PREFIX + code);
  } catch {
    /* 무시 */
  }
}

/** 저장된 모든 저수지 */
export function loadAll(): Record<string, SavedEntry> {
  const out: Record<string, SavedEntry> = {};
  const s = storage();
  if (!s) return out;
  try {
    for (let i = 0; i < s.length; i++) {
      const k = s.key(i);
      if (!k || !k.startsWith(PREFIX)) continue;
      const e = loadEntry(k.slice(PREFIX.length));
      if (e) out[k.slice(PREFIX.length)] = e;
    }
  } catch {
    /* 무시 */
  }
  return out;
}

export interface ExportFile {
  app: "reservoir-flood-check";
  version: number;
  exportedAt: string;
  entries: Record<string, SavedEntry>;
}

export function exportAll(now = new Date()): ExportFile {
  return { app: "reservoir-flood-check", version: EXPORT_VERSION, exportedAt: now.toISOString(), entries: loadAll() };
}

/** 불러오기: 같은 표준코드는 덮어쓴다. 읽은 개수를 돌려준다 */
export function importAll(text: string): { count: number; error: string | null } {
  try {
    const data = JSON.parse(text) as Partial<ExportFile>;
    if (data.app !== "reservoir-flood-check" || typeof data.entries !== "object" || !data.entries) {
      return { count: 0, error: "이 웹앱에서 내보낸 JSON이 아닙니다" };
    }
    let count = 0;
    for (const [code, e] of Object.entries(data.entries)) {
      if (/^\d{10}$/.test(code) && e && typeof e === "object" && "draft" in e && saveEntry(code, e as SavedEntry)) count++;
    }
    return { count, error: null };
  } catch {
    return { count: 0, error: "JSON을 읽을 수 없습니다" };
  }
}
