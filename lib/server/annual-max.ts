// data/rainfall/annual-max/*.json을 관측소 번호로 읽는다(서버). 파일은 scripts/preprocess.py D가 만든다.
import type { AnnualMaxFile } from "@/lib/types";
import { cacheLife } from "next/cache";
import index from "@/data/rainfall/index.json";

const codes = new Set(index.stations.map((s) => s.code));

export async function loadAnnualMax(station: string): Promise<AnnualMaxFile | null> {
  "use cache";
  cacheLife("max"); // 파일은 배포할 때만 바뀐다
  if (!codes.has(station)) return null;
  const mod = await import(`@/data/rainfall/annual-max/${station}.json`);
  return (mod.default ?? mod) as AnnualMaxFile;
}
