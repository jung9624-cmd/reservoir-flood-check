"""권이 저수지 검증값 → data/validation/kwoni.json

값은 CLAUDE.md 6절(권이저수지 재해복구 세부설계 2023, 제3장 수문분석·제4장 사업계획)에서 옮겼다.
값을 바꾸려면 이 파일을 고치고 다시 실행한다:

    python scripts/build_kwoni.py
"""
import json
from pathlib import Path

OUT = Path(__file__).resolve().parent.parent / "data" / "validation" / "kwoni.json"

KWONI = {
    "code": "4713010226",
    "name": "권이",
    "location": "경북 경주",
    "source": "권이저수지 재해복구 세부설계 2023 (CLAUDE.md 6절)",
    "inputs": {
        "spillway": {"width_m": 61.0, "crest_el": 165.90, "coefficient": 2.05},
        "emergencyGate": {"width_m": 4.0, "crest_el": 164.40, "open": True, "coefficient": None},
        "damCrest_el": 169.10,
        "damCrestNote": "168.90 + 자갈 0.2",
        "cn": {"amc": "III", "value": 89.00},
        "tc_hr": 0.26,
        "k_hr": 0.20,
        "station": {"code": "138", "name": "포항", "firstYear": 1961, "lastYear": 2022},
    },
    "spec": {
        "catchment_ha": 640,
        "fullLevel_el": 165.9,
        "floodLevel_el": 167.1,
        "deadLevel_el": 154.0,
        "totalStorage_thm3": 550,
        "fullArea_ha": 9.9,
    },
    "storageTable": [
        {"level_el": 154.0, "storage_m3": 0},
        {"level_el": 155.0, "storage_m3": 9203},
        {"level_el": 156.0, "storage_m3": 24913},
        {"level_el": 157.0, "storage_m3": 45448},
        {"level_el": 158.0, "storage_m3": 71275},
        {"level_el": 159.0, "storage_m3": 103023},
        {"level_el": 160.0, "storage_m3": 141598},
        {"level_el": 161.0, "storage_m3": 187948},
        {"level_el": 162.0, "storage_m3": 240080},
        {"level_el": 163.0, "storage_m3": 300630},
        {"level_el": 164.0, "storage_m3": 375005},
        {"level_el": 164.5, "storage_m3": 417670},
        {"level_el": 165.0, "storage_m3": 462908},
        {"level_el": 165.5, "storage_m3": 510583},
        {"level_el": 165.9, "storage_m3": 550007},
        {"level_el": 167.1, "storage_m3": 675136},
        {"level_el": 168.5, "storage_m3": 842962},
    ],
    "check1_probableRainfall200": {
        "tolerance_pct": 0.3,
        "timeConvention": "khas",
        "duration_min": [60, 120, 180, 240, 360, 540, 720, 900, 1080, 1440],
        "rainfall_mm": [94.32, 127.82, 163.27, 189.61, 231.16, 283.19, 319.05, 347.24, 369.29, 410.82],
    },
    "check2_routing": {
        "tolerance": {"flow_pct": 0.5, "level_m": 0.01},
        "rows": [
            {"duration_min": 60, "inflowX1_2_cms": 222.53, "peakOutflow_cms": 188.16, "maxLevel_el": 167.05, "critical": False},
            {"duration_min": 120, "inflowX1_2_cms": 216.17, "peakOutflow_cms": 201.00, "maxLevel_el": 167.10, "critical": True},
            {"duration_min": 180, "inflowX1_2_cms": 203.96, "peakOutflow_cms": 198.02, "maxLevel_el": 167.09, "critical": False},
            {"duration_min": 240, "inflowX1_2_cms": 184.94, "peakOutflow_cms": 182.26, "maxLevel_el": 167.02, "critical": False},
        ],
        "initialOutflow_cms_approx": 15,
        "freeboard_m": 2.00,
        "verdict": "적합",
    },
}


def main() -> None:
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(KWONI, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"wrote {OUT}")


if __name__ == "__main__":
    main()
