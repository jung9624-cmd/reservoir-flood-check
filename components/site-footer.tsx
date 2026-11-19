// 바닥글: 계산 기준, 자료 출처, 교육·연구용 안내 (CLAUDE.md 7, design/wireframe.md ⑩)
export function SiteFooter({ asOf }: { asOf: string }) {
  return (
    <footer className="no-print mt-8 border-t border-line py-5 text-[13px] leading-6 text-sub">
      <p>계산 기준: 공사 가이드라인 2019 &gt; 환경부 홍수량 산정 표준지침 2019 &gt; 농업생산기반시설 설계기준 2018</p>
      <p>
        자료: 공공데이터포털(저수지 제원 15044339 · 제원 기준일 {asOf}, 수위 15099919, 일별 저수율 15113475, 기상청 ASOS 시간자료 15057210) ·
        재난안전데이터 공유플랫폼 DSSP-IF-20290(공공누리 제3유형) · 기상청 · © OpenStreetMap contributors(위치 근사)
      </p>
      <p className="font-semibold text-ink">교육·연구용 · 공식 판정 아님</p>
    </footer>
  );
}
