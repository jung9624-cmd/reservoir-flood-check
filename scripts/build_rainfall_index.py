"""data/rainfall/annual-max/*.json → data/rainfall/index.json (관측소별 자료기간·연수)

웹앱이 관측소 목록(자료 30년 이상 표시)과 자료기간 기본값을 고를 때 쓴다.
../Reference를 읽지 않는다. preprocess.py D를 다시 돌린 뒤 실행한다.

    python scripts/build_rainfall_index.py
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "data" / "rainfall" / "annual-max"
OUT = ROOT / "data" / "rainfall" / "index.json"


def main() -> None:
    stations = []
    for f in sorted(SRC.glob("*.json")):
        d = json.loads(f.read_text(encoding="utf-8"))
        years = d["actual"]["years"]
        stations.append({"code": d["station"], "firstYear": min(years), "lastYear": max(years), "nYears": len(years)})
    OUT.write_text(json.dumps({"source": "data/rainfall/annual-max (K-HAS Rain_HrData, actual 시각)", "stations": stations}, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"wrote {OUT}: {len(stations)}곳, 30년 이상 {sum(s['nYears'] >= 30 for s in stations)}곳")


if __name__ == "__main__":
    main()
