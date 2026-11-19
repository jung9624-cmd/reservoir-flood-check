// 적합/부적합 배지. 색과 함께 글자·기호를 늘 쓴다(색만으로 뜻을 전하지 않는다)
export function VerdictBadge({ pass, size = "sm" }: { pass: boolean | null; size?: "sm" | "lg" }) {
  if (pass === null) return <span className="text-sm text-sub">판정 없음</span>;
  const cls = size === "lg" ? "px-3 py-1 text-2xl font-bold" : "px-2 py-0.5 text-[13px] font-semibold";
  return (
    <span className={`inline-flex items-center gap-1 rounded text-white ${pass ? "bg-pass" : "bg-fail"} ${cls}`}>
      <span aria-hidden="true">{pass ? "✓" : "✕"}</span>
      {pass ? "적합" : "부적합"}
    </span>
  );
}
