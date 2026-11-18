// 기상청 ASOS 시간자료 API(공공데이터포털 15057210) 프록시 — 인증키는 서버에서만 쓴다 (CLAUDE.md 7).
// apis.data.go.kr/1360000/AsosHourlyInfoService/getWthrDataList
import type { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const station = request.nextUrl.searchParams.get("station");
  if (!station || !/^\d{2,3}$/.test(station)) {
    return Response.json({ error: "station(관측소 번호)이 필요합니다." }, { status: 400 });
  }
  if (!process.env.DATA_GO_KR_KEY) {
    return Response.json({ error: "DATA_GO_KR_KEY가 설정되지 않았습니다." }, { status: 503 });
  }
  return Response.json({ error: "아직 구현하지 않았습니다." }, { status: 501 });
}
