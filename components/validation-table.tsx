// ⑨ 검증 (접힘, 권이에서만): 보고서 값 vs 웹앱 값과 차이. 허용 기준 안/밖을 ✓/✕ 글자로 표시(색 없음)
import type { ProbableRainfall, RunResult } from "@/lib/types";

export interface ReportCheck {
  check1_probableRainfall200: { tolerance_pct: number; duration_min: number[]; rainfall_mm: number[] };
  check2_routing: {
    tolerance: { flow_pct: number; level_m: number };
    rows: { duration_min: number; inflowX1_2_cms: number; peakOutflow_cms: number; maxLevel_el: number }[];
  };
}

const pct = (a: number, b: number) => (a / b - 1) * 100;
const Mark = ({ ok }: { ok: boolean }) => <span className="ml-1">{ok ? "✓" : "✕"}<span className="sr-only">{ok ? " 기준 안" : " 기준 밖"}</span></span>;

export function ValidationTable({ report, rainfall, routing }: { report: ReportCheck; rainfall: ProbableRainfall | null; routing: RunResult | null }) {
  const c1 = report.check1_probableRainfall200;
  const c2 = report.check2_routing;
  const tol = c2.tolerance;
  return (
    <section className="border-t border-line py-5">
      <details>
        <summary className="cursor-pointer text-[15px] text-ink">
          권이 보고서와 비교 (재해복구 세부설계 2023) <span className="text-sm text-sub">— 확률강우량 {c1.tolerance_pct} %, 유량 {tol.flow_pct} %, 수위 ±{tol.level_m} m 기준</span>
        </summary>
        <div className="mt-4 grid gap-8 lg:grid-cols-2">
          <div className="relative overflow-x-auto">
            <h3 className="mb-2 text-[13px] font-medium text-sub">검증값 1 · 200년 확률강우량 (포항 1961~2022, K-HAS 시각)</h3>
            {rainfall ? (
              <table className="num w-full border-collapse text-sm">
                <thead><tr className="border-b border-line text-[13px] text-sub"><th className="h-9 px-2 text-left font-medium">지속기간 분</th><th className="px-2 text-right font-medium">보고서 mm</th><th className="px-2 text-right font-medium">웹앱 mm</th><th className="px-2 text-right font-medium">차이 %</th></tr></thead>
                <tbody>
                  {c1.duration_min.map((d, j) => {
                    const e = pct(rainfall.rainfallMm[j], c1.rainfall_mm[j]);
                    return <tr key={d} className="h-9 border-b border-line"><td className="px-2">{d}</td><td className="px-2 text-right">{c1.rainfall_mm[j].toFixed(2)}</td><td className="px-2 text-right">{rainfall.rainfallMm[j].toFixed(2)}</td><td className="px-2 text-right">{e >= 0 ? "+" : ""}{e.toFixed(2)}<Mark ok={Math.abs(e) < c1.tolerance_pct} /></td></tr>;
                  })}
                </tbody>
              </table>
            ) : <p className="text-sm text-sub">포항(138) 연최대 자료를 불러오는 중…</p>}
          </div>
          <div className="relative overflow-x-auto">
            <h3 className="mb-2 text-[13px] font-medium text-sub">검증값 2 · 보고서 확률강우량 + 설계 내용적표</h3>
            {routing?.ok ? (
              <table className="num w-full border-collapse text-sm">
                <thead><tr className="border-b border-line text-[13px] text-sub"><th className="h-9 px-2 text-left font-medium">분</th><th className="px-2 text-right font-medium">유입 × 1.2 (%)</th><th className="px-2 text-right font-medium">최대방류 (%)</th><th className="px-2 text-right font-medium">최고수위 (m)</th></tr></thead>
                <tbody>
                  {c2.rows.map((r) => {
                    const d = routing.durations.find((x) => x.durationMin === r.duration_min)!;
                    const ei = pct(d.peakInflowCms, r.inflowX1_2_cms), eo = pct(d.peakOutflowCms, r.peakOutflow_cms), eh = d.maxLevelElM - r.maxLevel_el;
                    return (
                      <tr key={r.duration_min} className="h-9 border-b border-line">
                        <td className="px-2">{r.duration_min}</td>
                        <td className="px-2 text-right">{r.inflowX1_2_cms.toFixed(2)} → {d.peakInflowCms.toFixed(2)} ({ei >= 0 ? "+" : ""}{ei.toFixed(2)})<Mark ok={Math.abs(ei) < tol.flow_pct} /></td>
                        <td className="px-2 text-right">{r.peakOutflow_cms.toFixed(2)} → {d.peakOutflowCms.toFixed(2)} ({eo >= 0 ? "+" : ""}{eo.toFixed(2)})<Mark ok={Math.abs(eo) < tol.flow_pct} /></td>
                        <td className="px-2 text-right">{r.maxLevel_el.toFixed(2)} → {d.maxLevelElM.toFixed(3)} ({eh >= 0 ? "+" : ""}{eh.toFixed(3)})<Mark ok={Math.abs(eh) <= tol.level_m} /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : <p className="text-sm text-sub">계산 중…</p>}
            <p className="mt-2 text-xs text-sub">비상수문 유량계수는 보고서에 없어 2.0을 썼다. 입력값은 보고서 값(권이 세부설계 2023)이며 위 입력 칸과 별개로 계산한다.</p>
          </div>
        </div>
      </details>
    </section>
  );
}
