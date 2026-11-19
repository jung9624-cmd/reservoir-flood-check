import { ReservoirBrowser } from "@/components/reservoir-browser";
import { SiteFooter } from "@/components/site-footer";
import { listReservoirs, specAsOf } from "@/lib/data";
import { toListRow } from "@/lib/list-rows";

// 화면 1 — 전국 목록·지도 (design/wireframe.md 1절). 제원·좌표는 data/*.json을 정적으로 읽는다
export default function Home() {
  const rows = listReservoirs().map(toListRow);
  return (
    <div className="mx-auto flex w-full max-w-[1440px] flex-1 flex-col px-4 sm:px-8">
      <header className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line py-5">
        <h1 className="text-xl font-semibold text-ink sm:text-[22px]">전국 농업용 저수지 치수안정성 평가</h1>
        <p className="text-[15px] text-sub">
          제원 기준일 <b className="num font-semibold text-ink">{specAsOf}</b> · <span className="num">{rows.length.toLocaleString("ko-KR")}</span>곳
        </p>
      </header>
      <ReservoirBrowser rows={rows} />
      <SiteFooter asOf={specAsOf} />
    </div>
  );
}
