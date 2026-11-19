// 관측소 연최대 자료(data/rainfall/annual-max/<관측소>.json)를 브라우저에 준다. 92개 파일을 한꺼번에 싣지 않으려고 둔다.
import type { NextRequest } from "next/server";
import { loadAnnualMax } from "@/lib/server/annual-max";

export async function GET(_req: NextRequest, ctx: RouteContext<"/api/annual-max/[station]">) {
  const { station } = await ctx.params;
  if (!/^\d{3}$/.test(station)) return Response.json({ error: "관측소 번호(3자리)가 필요합니다" }, { status: 400 });
  const data = await loadAnnualMax(station);
  if (!data) return Response.json({ error: `관측소 ${station}의 연최대 자료가 없습니다` }, { status: 404 });
  return Response.json(data, { headers: { "Cache-Control": "public, max-age=86400, immutable" } });
}
