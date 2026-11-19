// 자료 신뢰도 표시에 쓰는 판단. 순수 함수, React와 무관.

/** 홍수위 − 만수위가 정확히 0.5 m 또는 1.0 m이면 실측값이 아니라 대표값으로 넣었을 수 있다(전국 0.5 m 491곳, 1.0 m 765곳) */
export function isRoundFloodMargin(floodLevelElM: number | null, fullLevelElM: number | null): 0.5 | 1 | null {
  if (floodLevelElM === null || fullLevelElM === null) return null;
  const d = Math.round((floodLevelElM - fullLevelElM) * 1000) / 1000;
  return d === 0.5 ? 0.5 : d === 1 ? 1 : null;
}

/** 제원 근사 내용적 곡선을 쓸 때 붙이는 말 (tests/kwoni-report.test.ts 6: EL.167.1 +0.08 %) */
export const SPEC_CURVE_NOTE = "근사 곡선(권이 검증: 홍수위 부근 오차 0.1 %)";

/** 좌표 정밀도(m)를 사람이 읽는 말로 */
export function precisionText(m: number): string {
  return m < 1 ? `약 ${m.toFixed(1)} m` : `약 ${Math.round(m).toLocaleString("ko-KR")} m`;
}
