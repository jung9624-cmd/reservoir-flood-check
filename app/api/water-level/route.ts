// 현재 수위 API(공공데이터포털 15099919) 프록시 — 인증키는 서버에서만 쓴다 (CLAUDE.md 7).
// apis.data.go.kr/B552149/reserviorWaterLevel/reservoirlevel/?fac_code=표준코드&date_s=&date_e= (XML)
import type { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  if (!code || !/^\d{10}$/.test(code)) {
    return Response.json({ error: "code(표준코드 10자리)가 필요합니다." }, { status: 400 });
  }
  if (!process.env.DATA_GO_KR_KEY) {
    return Response.json({ error: "DATA_GO_KR_KEY가 설정되지 않았습니다." }, { status: 503 });
  }
  return Response.json({ error: "아직 구현하지 않았습니다." }, { status: 501 });
}
