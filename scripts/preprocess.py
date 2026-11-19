"""../Reference 자료로 data/의 JSON을 만든다. 내 PC(Windows)에서만 실행하고, 결과 JSON만 저장소에 넣는다.

사용법 (저장소 루트에서):
    python scripts/preprocess.py                 # A~F 모두 (B의 근사 좌표는 건너뜀)
    python scripts/preprocess.py A C             # 일부 단계만
    python scripts/preprocess.py B --geocode     # B에서 좌표 없는 저수지를 OSM Nominatim으로 근사

단계
    A 제원          → data/reservoirs.json
    B 위치          → data/coords.json
    C 2025 저수율   → data/storage-2025.json
    D 강우 연최대   → data/rainfall/annual-max/<관측소>.json, data/stations.json
    E Huff 3분위    → data/huff/khas-q3.json
    F 검증 출력     → 화면 출력만 (포항 200년 확률강우량, 보고서 대조)

원칙 (CLAUDE.md 7, ../Reference/README.md)
    - ../Reference는 읽기만 한다. Metdata.mdb는 열지 않고 추출 CSV(zip)를 쓴다.
    - 값은 고치지 않는다. 이상한 값에는 플래그만 단다.
    - 필요한 파일이 없으면 그 단계는 멈추고 알린다(종료 코드 1).

필요 패키지: pandas, numpy, requests(--geocode일 때만)
"""
from __future__ import annotations

import argparse
import json
import math
import re
import sys
import time
import zipfile
import xml.etree.ElementTree as ET
from pathlib import Path

import numpy as np
import pandas as pd

# ---------------------------------------------------------------------------
# Reference 경로 (이 상수 하나만 바꾸면 된다). 기본: 저장소 바로 옆 ../Reference
# ---------------------------------------------------------------------------
REFERENCE = (Path(__file__).resolve().parent.parent / ".." / "Reference").resolve()

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
CACHE = Path(__file__).resolve().parent / ".cache"  # .gitignore 대상

RAW = REFERENCE / "01_원자료"
PROC = REFERENCE / "02_가공자료"
KHAS = PROC / "KHAS_Metdata_추출"

SPEC_CSV = RAW / "공공데이터포털_저수지제원_15044339_20260907.csv"
COORD_LINK_CSV = PROC / "저수지_좌표_공유플랫폼_연결.csv"
RATE_CSV = RAW / "한국농어촌공사_전국 저수지 일별 저수율_20251231.csv"
RATE_LINK_CSV = PROC / "저수지_홍수기저수율_2025_연결.csv"
RAIN_ZIP = KHAS / "Rain_HrData_시간강우.zip"
POHANG_KHAS_CSV = KHAS / "포항138_연최대_1961-2022_KHAS방식.csv"
ASOS_STATIONS_CSV = RAW / "ASOS_지점정보.csv"
HUFF_XLSX = RAW / "k has.xlsx"

DURATIONS_HR = [1, 2, 3, 4, 6, 9, 12, 15, 18, 24]
FLOOD_SEASON = ("2025-06-21", "2025-09-20")

# 권이 보고서(제3장 표 3.12) 포항 200년 확률강우량, 지속기간 60~1440분
REPORT_POHANG_200 = [94.32, 127.82, 163.27, 189.61, 231.16, 283.19, 319.05, 347.24, 369.29, 410.82]


class Stop(Exception):
    """필요한 파일이 없어 단계를 멈춘다."""


def need(path: Path) -> Path:
    if not path.exists():
        raise Stop(f"파일이 없습니다: {path}")
    return path


def write_json(path: Path, obj) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(obj, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    print(f"  → {path.relative_to(ROOT)} ({path.stat().st_size / 1024:.0f} KB)")


def num(v):
    """문자열 → float. 빈칸은 None."""
    if v is None or (isinstance(v, float) and math.isnan(v)):
        return None
    s = str(v).strip()
    if s == "":
        return None
    return float(s)


def as_of_from_name(path: Path) -> str:
    """파일 이름 끝의 날짜(_YYYYMMDD)를 기준일로 쓴다. 데이터셋 번호(15044339)와 헷갈리지 않게 마지막 것을 쓴다."""
    m = re.findall(r"_((?:19|20)\d{2})(\d{2})(\d{2})(?=\D|$)", path.stem)
    return "-".join(m[-1]) if m else ""


# ---------------------------------------------------------------------------
# A. 제원 → data/reservoirs.json
# ---------------------------------------------------------------------------
SPEC_FIELDS = [
    # (원본 열, JSON 이름, 숫자 여부)
    ("표준코드", "code", False),
    ("본부", "hq", False),
    ("지사", "branch", False),
    ("시설명", "name", False),
    ("소재지", "address", False),
    ("착공년도", "startDate", False),
    ("준공년도", "completeDate", False),
    ("종별", "grade", False),
    ("구분", "category", False),
    ("유역면적", "catchmentHa", True),
    ("홍수면적", "floodAreaHa", True),
    ("만수면적", "fullAreaHa", True),
    ("수혜면적", "benefitAreaHa", True),
    ("한발빈도", "droughtFreqYr", True),
    ("홍수빈도", "floodFreqYr", True),
    ("제체형식", "damType", False),
    ("제체길이", "damLengthM", True),
    ("제체높이", "damHeightM", True),
    ("총저수량", "totalStorageThousandM3", True),
    ("유효저수량", "effectiveStorageThousandM3", True),
    ("사수량", "deadStorageThousandM3", True),
    ("취수형식", "intakeType", False),
    ("홍수위", "floodLevelElM", True),
    ("만수위", "fullLevelElM", True),
    ("사수위", "deadLevelElM", True),
    ("연락처", "contact", False),
]


def spec_flags(r: dict) -> list[str]:
    """값은 고치지 않고 이상한 곳에 플래그만 단다 (docs/data-audit.md 2.1)."""
    f = []
    fl, fu, de = r["floodLevelElM"], r["fullLevelElM"], r["deadLevelElM"]
    if fl is not None and fu is not None and fl <= fu:
        f.append("floodLevelNotAboveFull")  # 홍수위 ≤ 만수위
    if fu is not None and de is not None and fu <= de:
        f.append("fullLevelNotAboveDead")  # 만수위 ≤ 사수위
    if any(v == 0 for v in (fl, fu)):
        f.append("zeroLevel")  # 홍수위 또는 만수위 = 0
    if de is not None and de < 0:
        f.append("negativeDeadLevel")
    if r["catchmentHa"] == 0:
        f.append("zeroCatchment")
    if r["fullAreaHa"] == 0:
        f.append("zeroFullArea")
    if r["floodAreaHa"] == 0:
        f.append("zeroFloodArea")
    tot, eff, dead = r["totalStorageThousandM3"], r["effectiveStorageThousandM3"], r["deadStorageThousandM3"]
    if tot is not None and eff is not None and eff > tot:
        f.append("effectiveExceedsTotal")
    if None not in (tot, eff, dead) and tot > 0 and abs(tot - eff - dead) > 0.01 * tot:
        f.append("storageSumMismatch")  # 총 ≠ 유효 + 사수 (1 % 초과)
    if r["damHeightM"] == 0:
        f.append("zeroDamHeight")
    if r["damLengthM"] == 0:
        f.append("zeroDamLength")
    if r["floodFreqYr"] == 0:
        f.append("zeroFloodFreq")
    if r["grade"] is None:
        f.append("missingGrade")
    return f


def step_a() -> None:
    print("[A] 제원")
    d = pd.read_csv(need(SPEC_CSV), encoding="cp949", dtype=str, keep_default_na=False)
    print(f"  읽음: {len(d)}행 × {d.shape[1]}열")
    assert d["표준코드"].is_unique, "표준코드 중복"
    rows, counts = [], {}
    for _, src in d.iterrows():
        r = {}
        for col, key, is_num in SPEC_FIELDS:
            v = src[col]
            r[key] = num(v) if is_num else (v.strip() or None)
        r["flags"] = spec_flags(r)
        for fl in r["flags"]:
            counts[fl] = counts.get(fl, 0) + 1
        rows.append(r)
    for k, v in sorted(counts.items(), key=lambda x: -x[1]):
        print(f"  플래그 {k}: {v}")
    write_json(DATA / "reservoirs.json", {
        "source": "공공데이터포털 15044339 한국농어촌공사 저수지 제원",
        "asOf": as_of_from_name(SPEC_CSV),
        "units": {"Ha": "ha", "ThousandM3": "천m³", "ElM": "EL.m", "M": "m", "Yr": "년"},
        "count": len(rows),
        "flagCounts": counts,
        "reservoirs": rows,
    })


# ---------------------------------------------------------------------------
# B. 위치 → data/coords.json
# ---------------------------------------------------------------------------
GWANGJU_GU = {"동구", "서구", "남구", "북구", "광산구"}


def precision_m(decimals: int) -> float:
    """소수 d자리 → 위도 1°(약 111,320 m) / 10^d. 경도 방향은 cos(위도)만큼 더 작다."""
    return round(111_320 / 10 ** decimals, 2)


def geocode_query(address: str) -> list[str]:
    """리·동 → 읍·면 → 시·군·구 순으로 줄여 가며 검색할 문자열.
    '전남광주통합특별시'는 OSM에 옛 이름(전라남도/광주광역시)과 새 이름이 섞여 있어(2026-11, 장성군은 새 이름)
    단계마다 옛 이름 → 새 이름 순으로 둘 다 묻는다."""
    w = address.split()
    names = [w]
    if w and w[0] == "전남광주통합특별시":
        old = "광주광역시" if len(w) > 1 and w[1] in GWANGJU_GU else "전라남도"
        names = [[old] + w[1:], w]
    out = []
    for n in range(len(w), 1, -1):
        for ws in names:
            out.append(" ".join(ws[:n]))
    return out


def geocode_level(q: str) -> str:
    """검색 문자열 끝말로 근사 단계를 정한다."""
    last = q.split()[-1]
    if last.endswith(("리", "동", "가")):
        return "리·동"
    if last.endswith(("읍", "면")):
        return "읍·면"
    return "시·군·구"


def nominatim(q: str, session, tries: int = 5) -> tuple[float, float] | None:
    """5xx·시간초과는 기다렸다가 다시 묻는다(10, 20, 40, 80초). 그래도 안 되면 예외."""
    for k in range(tries):
        try:
            r = session.get(
                "https://nominatim.openstreetmap.org/search",
                params={"q": q, "format": "jsonv2", "limit": 1, "countrycodes": "kr", "accept-language": "ko"},
                timeout=30,
            )
            if r.status_code >= 500 or r.status_code == 429:
                raise RuntimeError(f"HTTP {r.status_code}")
            r.raise_for_status()
            js = r.json()
            break
        except Exception as e:  # noqa: BLE001
            if k == tries - 1:
                raise
            wait = 10 * 2 ** k
            print(f"    재시도 {k + 1}/{tries - 1} ({e}), {wait}초 대기")
            time.sleep(wait)
    time.sleep(1.1)  # 사용 정책: 초당 1건 이하
    if not js:
        return None
    return float(js[0]["lat"]), float(js[0]["lon"])


def step_b(geocode: bool) -> None:
    print("[B] 위치")
    spec = pd.read_csv(need(SPEC_CSV), encoding="cp949", dtype=str, keep_default_na=False)
    link = pd.read_csv(need(COORD_LINK_CSV), encoding="utf-8-sig", dtype=str, keep_default_na=False)
    link = link.set_index("표준코드")
    items, missing = [], []
    for code, addr in zip(spec["표준코드"], spec["소재지"]):
        row = link.loc[code] if code in link.index else None
        if row is not None and row["위도"] != "":
            dec = int(float(row["좌표소수자리"]))
            items.append({
                "code": code, "lat": float(row["위도"]), "lon": float(row["경도"]),
                "source": "safetydata", "decimals": dec, "precisionM": precision_m(dec),
            })
        else:
            missing.append((code, addr))
    print(f"  공유플랫폼 좌표: {len(items)}곳, 없음: {len(missing)}곳 (고유 소재지 {len({a for _, a in missing})}개)")

    approx_done = 0
    if geocode:
        import requests

        CACHE.mkdir(exist_ok=True)
        cache_file = CACHE / "nominatim.json"
        cache = json.loads(cache_file.read_text(encoding="utf-8")) if cache_file.exists() else {}
        s = requests.Session()
        s.headers["User-Agent"] = "reservoir-flood-check-preprocess/0.1 (one-time batch, cached)"
        def save_cache() -> None:
            cache_file.write_text(json.dumps(cache, ensure_ascii=False), encoding="utf-8")

        for i, (code, addr) in enumerate(missing, 1):
            hit = None
            for q in geocode_query(addr):
                if q not in cache:
                    try:
                        cache[q] = nominatim(q, s)
                    except Exception:
                        save_cache()  # 다시 돌리면 이어서 한다
                        raise
                    if len(cache) % 25 == 0:
                        save_cache()
                if cache[q]:
                    hit = (cache[q], geocode_level(q), q)
                    break
            if hit:
                (lat, lon), level, q = hit
                items.append({"code": code, "lat": lat, "lon": lon, "source": "approx",
                              "approxLevel": level, "approxQuery": q})
                approx_done += 1
            else:
                items.append({"code": code, "lat": None, "lon": None, "source": "none"})
            if i % 100 == 0:
                print(f"  근사 {i}/{len(missing)}", flush=True)
        save_cache()
        lv_counts = pd.Series([it.get("approxLevel") for it in items if it["source"] == "approx"]).value_counts().to_dict()
        print(f"  근사 좌표: {approx_done}곳 {lv_counts}, 실패: {len(missing) - approx_done}곳")
    else:
        print("  근사 좌표는 건너뜀 (--geocode 없이 실행). 좌표 없는 곳은 source='none'")
        items += [{"code": c, "lat": None, "lon": None, "source": "none"} for c, _ in missing]

    write_json(DATA / "coords.json", {
        "sources": {
            "safetydata": "재난안전데이터 공유플랫폼 DSSP-IF-20290 (2026-11-18 받음, 공공누리 제3유형)",
            "approx": "소재지(리·동) 검색 좌표, OpenStreetMap Nominatim (© OpenStreetMap contributors, ODbL). 위치 근사",
            "none": "좌표 없음",
        },
        "precisionNote": "precisionM = 111,320 m / 10^decimals (위도 방향)",
        "count": len(items),
        "counts": pd.Series([it["source"] for it in items]).value_counts().to_dict(),
        "coords": items,
    })


# ---------------------------------------------------------------------------
# C. 2025 저수율 → data/storage-2025.json
# ---------------------------------------------------------------------------
def last2(addr: str) -> str:
    return " ".join(str(addr).split()[-2:])


def unique_match(spec: pd.DataFrame, rate: pd.DataFrame, skey, rkey) -> dict[str, int]:
    """양쪽 모두에서 유일한 키만 연결한다. 반환: 표준코드 → 저수율 행 번호."""
    sk = spec.apply(skey, axis=1)
    rk = rate.apply(rkey, axis=1)
    su = sk[~sk.duplicated(keep=False)]
    ru = rk[~rk.duplicated(keep=False)]
    rmap = {k: i for i, k in ru.items()}
    return {spec.at[i, "표준코드"]: rmap[k] for i, k in su.items() if k in rmap}


def step_c() -> None:
    print("[C] 2025 저수율")
    spec = pd.read_csv(need(SPEC_CSV), encoding="cp949", dtype=str, keep_default_na=False)
    rate = pd.read_csv(need(RATE_CSV), encoding="utf-8-sig")
    print(f"  제원 {len(spec)}곳, 저수율 파일 {len(rate)}행")
    # 이름·위치 앞뒤 공백 정리 (저수율 파일에 '내지곡 '처럼 끝 공백이 있는 행이 있다). 값은 그대로.
    n_space = int((rate["저수지명"] != rate["저수지명"].str.strip()).sum())
    print(f"  저수지명 앞뒤 공백 있는 행: {n_space}")
    for df, cols in ((spec, ["시설명", "소재지"]), (rate, ["저수지명", "위치"])):
        for c in cols:
            df[c] = df[c].astype(str).str.strip()
    spec = spec.assign(유효=pd.to_numeric(spec["유효저수량"]).round(1))
    rate = rate.assign(유효=pd.to_numeric(rate["유효저수량"]).round(1))

    steps = [
        ("name+address", lambda r: (r["시설명"], r["소재지"]), lambda r: (r["저수지명"], r["위치"])),
        ("name+last2", lambda r: (r["시설명"], last2(r["소재지"])), lambda r: (r["저수지명"], last2(r["위치"]))),
        ("name+effective", lambda r: (r["시설명"], r["유효"]), lambda r: (r["저수지명"], r["유효"])),
    ]
    matched: dict[str, tuple[int, str]] = {}
    s_left, r_left = spec.copy(), rate.copy()
    for label, sk, rk in steps:
        m = unique_match(s_left, r_left, sk, rk)
        for code, ri in m.items():
            matched[code] = (ri, label)
        s_left = s_left[~s_left["표준코드"].isin(m.keys())]
        r_left = r_left.drop(index=list(m.values()))
        print(f"  {label}: {len(m)}곳 연결 (누계 {len(matched)}/{len(spec)})")

    cols = [c for c in rate.columns if c.startswith("2025-") and FLOOD_SEASON[0] <= c <= FLOOD_SEASON[1]]
    v = rate[cols].apply(pd.to_numeric, errors="coerce")
    clipped = int((v > 100).sum().sum())
    v = v.clip(upper=100)
    print(f"  홍수기 {FLOOD_SEASON[0]}~{FLOOD_SEASON[1]} {len(cols)}일, 100% 초과 {clipped}셀 → 100으로 자름")

    items = []
    for code in spec["표준코드"]:
        if code not in matched:
            continue
        ri, label = matched[code]
        row = v.loc[ri]
        mean = None if row.isna().all() else round(float(row.mean()), 1)
        mx = None if row.isna().all() else round(float(row.max()), 1)
        items.append({"code": code, "floodSeasonMeanPct": mean, "floodSeasonMaxPct": mx, "matchedBy": label})

    # 이전 연결표와 대조
    if RATE_LINK_CSV.exists():
        old = pd.read_csv(RATE_LINK_CSV, encoding="utf-8-sig", dtype={"표준코드": str})
        old = old.dropna(subset=["홍수기평균저수율_2025"]).set_index("표준코드")
        new = {it["code"]: it for it in items}
        both = set(old.index) & set(new)
        only_old, only_new = set(old.index) - set(new), set(new) - set(old.index)
        def gap(c):
            if new[c]["floodSeasonMeanPct"] is None:
                return math.inf
            return max(abs(old.at[c, "홍수기평균저수율_2025"] - new[c]["floodSeasonMeanPct"]),
                       abs(old.at[c, "홍수기최대저수율_2025"] - new[c]["floodSeasonMaxPct"]))
        gaps = {c: gap(c) for c in both}
        diff = [c for c, g in gaps.items() if g > 0.1 + 1e-9]
        rounding = sum(1 for g in gaps.values() if 1e-9 < g <= 0.1 + 1e-9)
        print(f"  연결표 대조: 연결표 {len(old)}곳, 새 연결 {len(new)}곳, 둘 다 {len(both)}곳, "
              f"연결표에만 {len(only_old)}, 새 연결에만 {len(only_new)}, "
              f"반올림 차이(0.1) {rounding}곳, 값 다름(0.1 초과) {len(diff)}곳")
        if diff:
            print(f"    값 다른 예: {sorted(diff)[:5]}")
        if only_old:
            print(f"    연결표에만 있는 예: {sorted(only_old)[:5]}")
    else:
        print(f"  연결표 없음, 대조 건너뜀: {RATE_LINK_CSV}")

    write_json(DATA / "storage-2025.json", {
        "source": "공공데이터포털 15113475 한국농어촌공사 전국 저수지 일별 저수율 (2025-12-31판)",
        "floodSeason": {"from": FLOOD_SEASON[0], "to": FLOOD_SEASON[1]},
        "clippedCellsOver100": clipped,
        "matchCounts": pd.Series([it["matchedBy"] for it in items]).value_counts().to_dict(),
        "unmatched": len(spec) - len(items),
        "count": len(items),
        "items": items,
    })


# ---------------------------------------------------------------------------
# D. 강우 → data/rainfall/annual-max/<관측소>.json, data/stations.json
# ---------------------------------------------------------------------------
HCOLS = [f"H{i:02d}" for i in range(1, 25)]


def read_rain() -> pd.DataFrame:
    with zipfile.ZipFile(need(RAIN_ZIP)) as z:
        with z.open("Rain_HrData.csv") as f:
            r = pd.read_csv(f, dtype={"Code": str})
    return r


def hourly_series(r: pd.DataFrame, convention: str) -> pd.Series:
    """한 관측소의 시간강우를 시각(구간 끝)으로 놓는다.
    actual: H01~H23 = 그날 01~23시, H24 = 그날 00시(전날 23~24시 강우)
    khas  : H01~H24 = 그날 01~24시(H24 = 다음날 00시)"""
    r = r.sort_values("Date")
    h = r[HCOLS].to_numpy(float)
    t = pd.to_datetime(r["Date"]).to_numpy()
    off = np.arange(1, 25) if convention == "khas" else np.array(list(range(1, 24)) + [0])
    times = (t[:, None] + off[None, :] * np.timedelta64(1, "h")).ravel()
    s = pd.Series(h.ravel(), index=pd.DatetimeIndex(times)).sort_index()
    assert not s.index.duplicated().any()
    return s


def annual_max(s: pd.Series, first_year: int) -> dict:
    """지속기간별 이동합의 연최대. 연도 = 구간 끝 시각에서 1시간 뺀 시각의 연도. 빈칸은 0으로 채운다.
    first_year(관측 첫날의 해)보다 앞선 해는 뺀다: actual 시각에서 첫날 H24(00시)는 전날 23~24시 강우라
    관측 시작 전 해에 1시간짜리 조각이 생기고 2시간 이상 이동합이 NaN이 된다(2026-11-19 수정)."""
    yr = (s.index - pd.Timedelta(hours=1)).year
    blank = s.isna().groupby(yr).sum()
    data = s.notna().groupby(yr).sum()
    v = s.fillna(0.0)
    cols = {}
    for d in DURATIONS_HR:
        cols[d] = v.rolling(d).sum().groupby(yr).max()
    am = pd.DataFrame(cols)
    keep = data[(data > 0) & (data.index >= first_year)].index  # 값이 없는 해, 관측 시작 전 해는 뺀다
    am = am.loc[keep]
    return {
        "years": [int(y) for y in am.index],
        "valuesMm": [[round(float(x), 4) for x in row] for row in am.to_numpy()],
        "blankHours": [int(blank[y]) for y in am.index],
        "dataHours": [int(data[y]) for y in am.index],
    }


def step_d() -> dict[str, dict]:
    print("[D] 강우 연최대")
    r = read_rain()
    print(f"  시간강우 {len(r)}일 × 24, 관측소 {r['Code'].nunique()}곳, {r['Date'].min()} ~ {r['Date'].max()}")
    out_dir = DATA / "rainfall" / "annual-max"
    out_dir.mkdir(parents=True, exist_ok=True)
    summary = {}
    for code, g in r.groupby("Code"):
        res = {"station": code, "durationsHr": DURATIONS_HR, "valueNote": "고정시간 연최대(mm), 환산계수 적용 전"}
        for conv in ("actual", "khas"):
            res[conv] = annual_max(hourly_series(g, conv), int(pd.to_datetime(g["Date"]).min().year))
        (out_dir / f"{code}.json").write_text(json.dumps(res, ensure_ascii=False, separators=(",", ":"), allow_nan=False) + "\n", encoding="utf-8")
        yrs = res["actual"]["years"]
        summary[code] = {"firstYear": yrs[0] if yrs else None, "lastYear": yrs[-1] if yrs else None, "nYears": len(yrs)}
    n30 = sum(1 for s in summary.values() if s["nYears"] >= 30)
    print(f"  관측소 파일 {len(summary)}개 → {out_dir.relative_to(ROOT)}/ (자료 있는 해 30개 이상 {n30}곳)")
    return summary


def step_d_stations(summary: dict[str, dict] | None) -> None:
    print("[D] 관측소 위치")
    path = need(ASOS_STATIONS_CSV)
    st = None
    for enc in ("utf-8-sig", "cp949"):
        try:
            st = pd.read_csv(path, encoding=enc, dtype=str)
            break
        except UnicodeDecodeError:
            continue
    print(f"  ASOS 지점정보 {len(st)}행, 열: {list(st.columns)}")
    col = {c: c for c in st.columns}
    pick = lambda *names: next((c for c in st.columns if any(n in c for n in names)), None)  # noqa: E731
    c_code, c_name, c_lat, c_lon = pick("지점번호", "지점"), pick("지점명"), pick("위도"), pick("경도")
    if None in (c_code, c_name, c_lat, c_lon):
        raise Stop(f"ASOS 지점정보 열을 알 수 없습니다(지점번호·지점명·위도·경도 필요): {list(col)}")
    c_start = pick("시작일")
    if c_start:
        st = st.sort_values(c_start, kind="stable")  # 지점 이전 이력: 시작일 순으로 놓고
    st = st.drop_duplicates(c_code, keep="last")  # 가장 최근 위치(마지막 행)를 쓴다
    if summary is None:
        summary = {p.stem: {} for p in (DATA / "rainfall" / "annual-max").glob("*.json")}
    items, nocoord = [], []
    for code, s in sorted(summary.items()):
        m = st[st[c_code].str.strip().str.zfill(3) == code]
        if m.empty:
            nocoord.append(code)
            continue
        row = m.iloc[0]
        items.append({"code": code, "name": row[c_name], "lat": float(row[c_lat]), "lon": float(row[c_lon]), **s})
    print(f"  관측소 {len(items)}곳 좌표 연결, 연결 안 됨 {len(nocoord)}곳 {nocoord}")
    write_json(DATA / "stations.json", {
        "source": "기상청 기상자료개방포털 ASOS 지점정보",
        "count": len(items),
        "stations": items,
    })


# ---------------------------------------------------------------------------
# E. Huff → data/huff/khas-q3.json
# ---------------------------------------------------------------------------
def read_xlsx_first_sheet(path: Path) -> list[list[str]]:
    """openpyxl 없이 xlsx 첫 시트를 읽는다."""
    ns = {"m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
    with zipfile.ZipFile(path) as z:
        ss = []
        if "xl/sharedStrings.xml" in z.namelist():
            for si in ET.fromstring(z.read("xl/sharedStrings.xml")).findall("m:si", ns):
                ss.append("".join(t.text or "" for t in si.iter(f"{{{ns['m']}}}t")))
        sheet = ET.fromstring(z.read("xl/worksheets/sheet1.xml"))
        rows = []
        for row in sheet.iter(f"{{{ns['m']}}}row"):
            vals = []
            for c in row.findall("m:c", ns):
                v = c.find("m:v", ns)
                t = v.text if v is not None else ""
                vals.append(ss[int(t)] if c.get("t") == "s" and t else t)
            rows.append(vals)
    return rows


def step_e() -> None:
    print("[E] Huff 3분위")
    rows = read_xlsx_first_sheet(need(HUFF_XLSX))
    header, body = rows[0], rows[1:]
    t = [float(r[0]) for r in body]
    inc = [float(r[1]) for r in body]
    assert t == list(range(0, 101)), "시간비율이 0~100 %, 1 % 간격이 아닙니다"
    cum = np.cumsum(inc).tolist()
    total = cum[-1]
    print(f"  {header} {len(body)}행, 합계 {total:.5f} %")
    if abs(total - 100) > 0.001:
        raise ValueError(f"강우분포율 합계가 100 %가 아닙니다: {total}")
    tenths = [round(cum[k], 1) for k in range(10, 100, 10)]
    claude = [1.6, 6.5, 14.7, 26.6, 42.3, 61.7, 80.8, 93.8, 99.1]
    print(f"  10 % 간격 누가값 {tenths} — CLAUDE.md 5-3과 {'같음' if tenths == claude else '다름'}")
    write_json(DATA / "huff" / "khas-q3.json", {
        "source": "K-HAS Huff 3분위 (k has.xlsx)",
        "timePct": t,
        "incrementPct": inc,
        "cumulativePct": [round(c, 6) for c in cum],
        "sumPct": round(total, 6),
    })


# ---------------------------------------------------------------------------
# F. 검증 출력: 포항(138) 1961~2022 200년 확률강우량
# ---------------------------------------------------------------------------
def conv_factor(d_hr: float) -> float:
    return 0.1346 * d_hr ** -1.417 + 1.0014


def gumbel_pwm_quantile(x, T: float) -> float:
    x = np.sort(np.asarray(x, float))
    n = len(x)
    b0 = x.mean()
    b1 = np.sum(np.arange(n) / (n - 1) * x) / n
    a = (2 * b1 - b0) / np.log(2)
    xi = b0 - 0.5772 * a
    return xi - a * np.log(-np.log(1 - 1 / T))


def step_f() -> bool:
    print("[F] 검증: 포항(138) 1961~2022, 200년")
    path = DATA / "rainfall" / "annual-max" / "138.json"
    if not path.exists():
        raise Stop("data/rainfall/annual-max/138.json이 없습니다. D를 먼저 실행하세요.")
    js = json.loads(path.read_text(encoding="utf-8"))
    ok = True

    def table(conv):
        yrs = js[conv]["years"]
        am = pd.DataFrame(js[conv]["valuesMm"], index=yrs, columns=DURATIONS_HR).loc[1961:2022]
        return am

    am_k = table("khas")
    ref = pd.read_csv(need(POHANG_KHAS_CSV), index_col=0)
    ref.columns = [int(c) for c in ref.columns]
    diff = float((am_k - ref).abs().max().max())
    same = len(am_k) == len(ref) and diff < 1e-3
    print(f"  khas 연최대 vs {POHANG_KHAS_CSV.name}: {len(am_k)}년, 최대 차이 {diff:.2e} mm → {'같음' if same else '다름'}")
    ok &= same

    print(f"  {'분':>5} {'보고서':>8} {'khas':>8} {'차이%':>7} {'actual':>8} {'차이%':>7}")
    am_a = table("actual")
    for d, rep in zip(DURATIONS_HR, REPORT_POHANG_200):
        qk = gumbel_pwm_quantile(am_k[d] * conv_factor(d), 200)
        qa = gumbel_pwm_quantile(am_a[d] * conv_factor(d), 200)
        ek, ea = (qk / rep - 1) * 100, (qa / rep - 1) * 100
        flag = "" if abs(ek) <= 0.3 else "  ← 0.3 % 초과"
        ok &= abs(ek) <= 0.3
        print(f"  {d * 60:>5} {rep:>8.2f} {qk:>8.2f} {ek:>+7.2f} {qa:>8.2f} {ea:>+7.2f}{flag}")
    print(f"  khas 방식 10개 모두 0.3 % 이내: {'예' if ok else '아니오'}")
    return ok


# ---------------------------------------------------------------------------
def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("steps", nargs="*", default=list("ABCDEF"), help="실행할 단계 (A~F)")
    ap.add_argument("--geocode", action="store_true", help="B: 좌표 없는 저수지를 Nominatim으로 근사")
    args = ap.parse_args()
    steps = [s.upper() for s in args.steps]
    print(f"Reference: {REFERENCE}")
    stopped, failed = [], []
    summary = None
    for s in steps:
        try:
            if s == "A":
                step_a()
            elif s == "B":
                step_b(args.geocode)
            elif s == "C":
                step_c()
            elif s == "D":
                summary = step_d()
                try:
                    step_d_stations(summary)
                except Stop as e:
                    print(f"  멈춤(D 관측소 위치): {e}")
                    print("  → 기상자료개방포털에서 ASOS 지점정보를 받아 위 경로에 넣은 뒤 다시 실행하세요. stations.json은 만들지 않았습니다.")
                    stopped.append("D-stations")
            elif s == "E":
                step_e()
            elif s == "F":
                if not step_f():
                    failed.append("F")
            else:
                print(f"알 수 없는 단계: {s}")
        except Stop as e:
            print(f"  멈춤({s}): {e}")
            stopped.append(s)
    if stopped or failed:
        print(f"\n멈춘 단계: {stopped}  검증 실패: {failed}")
        return 1
    print("\n완료")
    return 0


if __name__ == "__main__":
    sys.exit(main())
