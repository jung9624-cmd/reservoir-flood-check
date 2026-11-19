import type { ValueSource } from "@/lib/types";

// 값 옆의 "자동(출처)" / "입력" 표시 (CLAUDE.md 4절). 색이 아니라 모양으로 구분한다:
// 입력 = 먹색 채움, 자동 = 테두리만 + 출처
export function SourceBadge({ source, className = "" }: { source: ValueSource; className?: string }) {
  if (source.kind === "input") {
    return <span className={`inline-flex shrink-0 items-center rounded bg-ink px-1.5 py-px text-[11px] leading-4 font-medium text-white ${className}`}>입력</span>;
  }
  return (
    <span title={source.source} className={`inline-flex max-w-72 shrink-0 items-center truncate rounded border border-[#8c959f] px-1.5 py-px text-[11px] leading-4 font-medium text-sub ${className}`}>
      자동 · {source.source}
    </span>
  );
}

/** 짧은 출처 이름 (제원 CSV 등) */
export const auto = (source: string): ValueSource => ({ kind: "auto", source });
export const INPUT: ValueSource = { kind: "input" };
