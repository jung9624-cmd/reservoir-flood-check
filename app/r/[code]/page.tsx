import { Suspense } from "react";
import { notFound } from "next/navigation";
import { ReservoirDetail } from "@/components/reservoir-detail";
import { SiteFooter } from "@/components/site-footer";
import { getReservoir, specAsOf } from "@/lib/data";
import stationIndex from "@/data/rainfall/index.json";
import kwoni from "@/data/validation/kwoni.json";

// 화면 2 — 저수지 상세 (design/wireframe.md 2절). 계산은 브라우저에서 한다
export default function ReservoirPage({ params }: PageProps<"/r/[code]">) {
  return (
    <div className="mx-auto flex w-full max-w-[1280px] flex-1 flex-col px-4 sm:px-8">
      <Suspense fallback={<p className="py-10 text-sub">저수지를 불러오는 중…</p>}>
        <Detail params={params} />
      </Suspense>
      <SiteFooter asOf={specAsOf} />
    </div>
  );
}

async function Detail({ params }: { params: PageProps<"/r/[code]">["params"] }) {
  const { code } = await params;
  if (!/^\d{10}$/.test(code)) notFound();
  const rec = getReservoir(code);
  if (!rec) notFound();
  return (
    <ReservoirDetail
      record={rec}
      asOf={specAsOf}
      stations={stationIndex.stations}
      report={code === kwoni.code ? kwoni : null}
    />
  );
}
