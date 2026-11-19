// 기상청 ASOS 시간자료 API(공공데이터포털 15057210) 프록시 — 인증키는 서버에서만 쓴다 (CLAUDE.md 7).
// ?station=138&start=YYYYMMDD&end=YYYYMMDD (최대 366일). tm HH:00의 rn = 직전 1시간 강우 (CLAUDE.md 3.4).
// 성공한 응답은 하루 단위로 캐시한다. 2025년 이후 자료를 연최대에 덧붙이는 데 쓸 예정이다.
import type { NextRequest } from "next/server";
import { fetchHourlyRain, todayKst } from "@/lib/server/data-go-kr";

const ymd = /^\d{8}$/;

export async function GET(request: NextRequest) {
  const p = request.nextUrl.searchParams;
  const station = p.get("station");
  const start = p.get("start");
  const end = p.get("end");
  if (!station || !/^\d{2,3}$/.test(station) || !start || !end || !ymd.test(start) || !ymd.test(end) || start > end) {
    return Response.json({ available: false, reason: "station(관측소 번호), start·end(YYYYMMDD)가 필요합니다" }, { status: 400 });
  }
  const days = (Date.parse(`${end.slice(0, 4)}-${end.slice(4, 6)}-${end.slice(6)}`) - Date.parse(`${start.slice(0, 4)}-${start.slice(4, 6)}-${start.slice(6)}`)) / 86_400_000;
  if (days > 366) return Response.json({ available: false, reason: "한 번에 366일까지 받을 수 있습니다" }, { status: 400 });
  if (!process.env.DATA_GO_KR_KEY) return Response.json({ available: false, reason: "인증키가 설정되지 않았습니다" });
  try {
    const hours = await fetchHourlyRain(station.padStart(3, "0").replace(/^0/, ""), start, end, todayKst());
    return Response.json(
      { available: true, station, hours, source: "기상청 ASOS 시간자료 (공공데이터포털 15057210)" },
      { headers: { "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=3600" } },
    );
  } catch (e) {
    return Response.json({ available: false, reason: e instanceof Error ? e.message : "강우 API 호출 실패" });
  }
}
