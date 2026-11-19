// 현재 수위 API(공공데이터포털 15099919) 프록시 — 인증키는 서버에서만 쓴다 (CLAUDE.md 7).
// 성공한 응답은 하루 단위로 캐시한다. 실패하면 { available: false }를 돌려주고 화면은 "현재 수위 없음"으로 표시한다.
import type { NextRequest } from "next/server";
import { fetchWaterLevel, todayKst } from "@/lib/server/data-go-kr";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  if (!code || !/^\d{10}$/.test(code)) {
    return Response.json({ available: false, reason: "code(표준코드 10자리)가 필요합니다" }, { status: 400 });
  }
  if (!process.env.DATA_GO_KR_KEY) {
    return Response.json({ available: false, reason: "인증키가 설정되지 않았습니다" });
  }
  try {
    const level = await fetchWaterLevel(code, todayKst());
    if (!level) return Response.json({ available: false, reason: "최근 7일 수위 자료가 없습니다" });
    return Response.json(
      { available: true, ...level, source: "공공데이터포털 15099919" },
      { headers: { "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=3600" } },
    );
  } catch (e) {
    return Response.json({ available: false, reason: e instanceof Error ? e.message : "수위 API 호출 실패" });
  }
}
