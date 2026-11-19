"""권이 120분 HEC-HMS 교차검증 입력 → docs/hms/

만드는 파일:
    kwoni_120min_rain.csv      10분 강우(mm), 보고서 200년 확률강우량 127.82 mm × Huff 3분위
    kwoni_120min_inflow.csv    웹앱 계산식으로 만든 유입 수문곡선(10분, × 1.2 전·후). HMS의 Ratio가 안 될 때 Source로 쓴다
    kwoni_esd.csv              표고-저류량-방류량 (설계 내용적표 + 물넘이 + 비상수문)
    README.md                  HEC-HMS 설정 체크리스트

계산식은 lib/(hyetograph, runoff, storage, routing)과 같게 옮겼다. 같은지는 tests/hms.test.ts가 확인한다.
읽는 파일: data/huff/khas-q3.json, tests/fixtures/kwoni-report.json (../Reference는 읽지 않는다)

    python scripts/export_hms.py
"""
import csv
import json
import math
from bisect import bisect_right
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "docs" / "hms"
DURATION_MIN = 120
DT_MIN = 10
FILL_DAM_FACTOR = 1.2
GATE_COEFFICIENT_DEFAULT = 2.0  # CLAUDE.md에 없음 → 웹앱 기본값 (calc-rules 7-11)
ESD_STEP_M = 0.05
ESD_TOP_EL = 169.5  # 제정 169.10 위까지


def interp(x, xs, ys):
    if x <= xs[0]:
        return ys[0]
    if x >= xs[-1]:
        return ys[-1]
    i = bisect_right(xs, x) - 1
    t = (x - xs[i]) / (xs[i + 1] - xs[i])
    return ys[i] + t * (ys[i + 1] - ys[i])


def huff_hyetograph(total_mm, duration_min, huff, dt_min):
    n = round(duration_min / dt_min)
    total = huff["cumulativePct"][-1]
    cum = lambda k: interp(100 * k / n, huff["timePct"], huff["cumulativePct"]) / total
    return [(cum(k + 1) - cum(k)) * total_mm for k in range(n)]


def effective_rainfall(rain, cn):
    s = 25400 / cn - 254
    ia = 0.2 * s
    out, cum, prev = [], 0.0, 0.0
    for p in rain:
        cum += p
        q = (cum - ia) ** 2 / (cum - ia + s) if cum > ia else 0.0
        out.append(q - prev)
        prev = q
    return out


def time_area(t):
    if t <= 0:
        return 0.0
    if t >= 1:
        return 1.0
    return 1.414 * t**1.5 if t <= 0.5 else 1 - 1.414 * (1 - t) ** 1.5


def clark(eff, area_km2, tc_hr, k_hr, dt):
    tc = tc_hr * 60
    n = math.ceil(tc / dt - 1e-12)  # Tc 반올림 금지
    da = [time_area((k + 1) * dt / tc) - time_area(k * dt / tc) for k in range(n)]
    inflow = [0.0]
    for j in range(len(eff) + len(da) - 1):
        s = sum(eff[j - k] * da[k] for k in range(len(da)) if 0 <= j - k < len(eff))
        inflow.append(s * area_km2 / (0.06 * dt))
    ca = dt / (k_hr * 60 + 0.5 * dt)
    out, peak = [0.0], 0.0
    for i in range(1, 20000):
        i_now = inflow[i] if i < len(inflow) else 0.0
        i_prev = inflow[i - 1] if i - 1 < len(inflow) else 0.0
        o = ca * 0.5 * (i_now + i_prev) + (1 - ca) * out[-1]
        out.append(o)
        peak = max(peak, o)
        if i >= len(inflow) and abs(o) <= peak * 1e-6:
            break
    return out


def main():
    huff = json.loads((ROOT / "data" / "huff" / "khas-q3.json").read_text(encoding="utf-8"))
    kw = json.loads((ROOT / "tests" / "fixtures" / "kwoni-report.json").read_text(encoding="utf-8"))
    inp, spec = kw["inputs"], kw["spec"]
    j = kw["check1_probableRainfall200"]["duration_min"].index(DURATION_MIN)
    p_mm = kw["check1_probableRainfall200"]["rainfall_mm"][j]
    area_km2 = spec["catchment_ha"] / 100

    OUT.mkdir(parents=True, exist_ok=True)

    # 1) 10분 강우
    rain = huff_hyetograph(p_mm, DURATION_MIN, huff, DT_MIN)
    with open(OUT / "kwoni_120min_rain.csv", "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["end_min", "rain_mm"])  # 구간 끝 시각(분), 그 10분 동안의 강우
        for k, v in enumerate(rain):
            w.writerow([(k + 1) * DT_MIN, f"{v:.6f}"])

    # 2) 유입 수문곡선
    eff = effective_rainfall(rain, inp["cn"]["value"])
    q = clark(eff, area_km2, inp["tc_hr"], inp["k_hr"], DT_MIN)
    with open(OUT / "kwoni_120min_inflow.csv", "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["time_min", "inflow_raw_cms", "inflow_x1_2_cms"])
        for i, v in enumerate(q):
            w.writerow([i * DT_MIN, f"{v:.6f}", f"{v * FILL_DAM_FACTOR:.6f}"])

    # 3) 표고-저류량-방류량
    table = kw["storageTable"]
    xs = [r["level_el"] for r in table]
    ys = [r["storage_m3"] for r in table]
    slope = (ys[-1] - ys[-2]) / (xs[-1] - xs[-2])

    def storage(h):
        return ys[-1] + (h - xs[-1]) * slope if h > xs[-1] else interp(h, xs, ys)

    sp, gate = inp["spillway"], inp["emergencyGate"]
    outlets = [(sp["coefficient"], sp["width_m"], sp["crest_el"]),
               (gate["coefficient"] or GATE_COEFFICIENT_DEFAULT, gate["width_m"], gate["crest_el"])]

    def discharge(h):
        return sum(c * b * max(0.0, h - z) ** 1.5 for c, b, z in outlets)

    levels = set(round(x, 2) for x in xs)
    h = gate["crest_el"]
    while h <= ESD_TOP_EL + 1e-9:
        levels.add(round(h, 2))
        h += ESD_STEP_M
    with open(OUT / "kwoni_esd.csv", "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["elevation_m", "storage_m3", "storage_1000m3", "discharge_cms"])
        for h in sorted(levels):
            s = storage(h)
            w.writerow([f"{h:.2f}", f"{s:.3f}", f"{s / 1000:.6f}", f"{discharge(h):.6f}"])

    print(f"wrote {OUT}: rain {len(rain)}행 (합 {sum(rain):.4f} mm), inflow {len(q)}행 "
          f"(첨두 × 1.2 = {max(q) * FILL_DAM_FACTOR:.2f} m³/s), esd {len(levels)}행")


if __name__ == "__main__":
    main()
