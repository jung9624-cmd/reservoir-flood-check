// 공공데이터포털 API 호출 (서버 전용). 인증키는 환경변수 DATA_GO_KR_KEY에서만 읽는다 (CLAUDE.md 7).
// 성공한 응답만 하루 동안 캐시한다(use cache + cacheLife("days")). 실패는 예외로 던져 캐시하지 않는다.
import { cacheLife } from "next/cache";

function serviceKey(): string {
  const key = process.env.DATA_GO_KR_KEY;
  if (!key) throw new Error("DATA_GO_KR_KEY가 설정되지 않았습니다");
  // 포털은 인코딩된 키와 디코딩된 키를 둘 다 준다. 이미 인코딩된 키(%)는 그대로 쓴다
  return key.includes("%") ? key : encodeURIComponent(key);
}

async function get(url: string): Promise<string> {
  const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
  if (!res.ok) throw new Error(`공공 API 응답 ${res.status}`);
  return res.text();
}

/** XML의 <item>을 {태그: 값} 목록으로 */
function xmlItems(xml: string): Record<string, string>[] {
  const code = /<resultCode>([^<]*)<\/resultCode>/.exec(xml)?.[1];
  if (code && code !== "00") {
    const msg = /<resultMsg>([^<]*)<\/resultMsg>/.exec(xml)?.[1] ?? "";
    throw new Error(`공공 API 오류 ${code} ${msg}`);
  }
  return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map((m) =>
    Object.fromEntries([...m[1].matchAll(/<(\w+)>([^<]*)<\/\1>/g)].map((t) => [t[1], t[2].trim()])),
  );
}

export interface WaterLevel {
  date: string; // YYYY-MM-DD
  levelElM: number | null; // 저수위 (m)
  ratePct: number | null; // 저수율 (%)
}

const firstNum = (o: Record<string, string>, keys: string[]) => {
  for (const k of keys) {
    const v = Number(o[k]);
    if (o[k] !== undefined && o[k] !== "" && Number.isFinite(v)) return v;
  }
  return null;
};

/** 15099919 저수지 수위: 최근 7일 중 가장 늦은 날. dayKey(YYYYMMDD)로 하루 단위 캐시 */
export async function fetchWaterLevel(code: string, dayKey: string): Promise<WaterLevel | null> {
  "use cache";
  cacheLife("days");
  const end = dayKey;
  const d = new Date(`${dayKey.slice(0, 4)}-${dayKey.slice(4, 6)}-${dayKey.slice(6)}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 7);
  const start = d.toISOString().slice(0, 10).replace(/-/g, "");
  const url = `https://apis.data.go.kr/B552149/reserviorWaterLevel/reservoirlevel/?serviceKey=${serviceKey()}&pageNo=1&numOfRows=30&fac_code=${code}&date_s=${start}&date_e=${end}`;
  const items = xmlItems(await get(url));
  const rows = items
    .map((it) => ({
      date: (it.check_date ?? it.checkDate ?? "").replace(/(\d{4})(\d{2})(\d{2})/, "$1-$2-$3"),
      levelElM: firstNum(it, ["water_level", "waterLevel", "wl"]),
      ratePct: firstNum(it, ["rate", "storage_rate", "rsvr_rate"]),
    }))
    .filter((r) => r.date && (r.levelElM !== null || r.ratePct !== null))
    .sort((a, b) => a.date.localeCompare(b.date));
  return rows.at(-1) ?? null;
}

export interface HourlyRain {
  tm: string; // "YYYY-MM-DD HH:00" — 그 시각까지 1시간 강우 (CLAUDE.md 3.4)
  rnMm: number; // 빈 값은 0
}

/** 15057210 ASOS 시간자료. 같은 인자는 하루 동안 캐시 */
export async function fetchHourlyRain(station: string, startYmd: string, endYmd: string, dayKey: string): Promise<HourlyRain[]> {
  "use cache";
  cacheLife("days");
  void dayKey; // 캐시 키에만 쓴다
  const out: HourlyRain[] = [];
  for (let page = 1; page <= 20; page++) {
    const url =
      `https://apis.data.go.kr/1360000/AsosHourlyInfoService/getWthrDataList?serviceKey=${serviceKey()}` +
      `&pageNo=${page}&numOfRows=999&dataType=JSON&dataCd=ASOS&dateCd=HR&startDt=${startYmd}&startHh=01&endDt=${endYmd}&endHh=23&stnIds=${station}`;
    const json = JSON.parse(await get(url));
    const header = json?.response?.header;
    if (header?.resultCode !== "00") throw new Error(`기상청 API 오류 ${header?.resultCode} ${header?.resultMsg ?? ""}`);
    const items: { tm: string; rn: string }[] = json.response.body?.items?.item ?? [];
    for (const it of items) out.push({ tm: it.tm, rnMm: it.rn === "" || it.rn == null ? 0 : Number(it.rn) });
    const total = Number(json.response.body?.totalCount ?? 0);
    if (page * 999 >= total) break;
  }
  return out;
}

/** 한국 시간 기준 오늘 YYYYMMDD (하루 단위 캐시 키) */
export function todayKst(now = new Date()): string {
  return new Date(now.getTime() + 9 * 3600_000).toISOString().slice(0, 10).replace(/-/g, "");
}
