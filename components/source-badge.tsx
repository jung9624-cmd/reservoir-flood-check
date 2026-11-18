import type { ValueSource } from "@/lib/types";

// 값 옆의 "자동(출처)" / "입력" 표시 (CLAUDE.md 4절). 디자인은 아직 정하지 않았다.
export function SourceBadge({ source }: { source: ValueSource }) {
  const label = source.kind === "input" ? "입력" : `자동(${source.source})`;
  return <span className="text-xs text-muted-foreground">{label}</span>;
}
