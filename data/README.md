# data/

`scripts/`가 `../Reference` 자료로 만든 JSON만 둔다 (CLAUDE.md 7). 다시 만들려면 저장소 루트에서 `python scripts/preprocess.py`.

| 파일 | 내용 | 단계 | 상태 |
|---|---|---|---|
| `reservoirs.json` | 저수지 제원 3,402곳 (15044339, 기준일 `asOf` 2026-09-07). 필드 이름에 단위, 이상값 `flags` | preprocess A | 생성 |
| `coords.json` | 표준코드별 위경도. `source`: safetydata(공유플랫폼, 1,183곳, 소수자리·`precisionM`) / approx(소재지 검색 근사, OSM Nominatim, `approxLevel`·`approxQuery`, 화면에 "위치 근사") / none | preprocess B `--geocode` | 생성: 공유플랫폼 1,183 + 근사 2,219 (리·동 626, 읍·면 1,591, 시·군·구 2), 없음 0 |
| `storage-2025.json` | 2025 홍수기(6/21~9/20) 평균·최대 저수율, 100 % 초과는 100으로 자름. 3,317곳 | preprocess C | 생성 |
| `rainfall/annual-max/<관측소>.json` | 지속기간 1~24시간 고정시간 연최대(mm). `actual`(기본)·`khas`(검증용) 두 시각 배치, 빈칸 수 | preprocess D | 생성 (92곳) |
| `stations.json` | ASOS 관측소 위치 | preprocess D | **미생성** — `../Reference/01_원자료/ASOS_지점정보.csv` 필요 |
| `rainfall/index.json` | 관측소별 자료기간·연수 (웹앱 관측소 목록) | build_rainfall_index.py | 생성 |
| `huff/khas-q3.json` | K-HAS Huff 3분위, 1 % 간격 분포율과 누가값 | preprocess E | 생성 |
| `validation/kwoni.json` | 권이 보고서 설계값 (웹앱 "보고서 값 불러오기", CLAUDE.md 6절). `tests/fixtures/kwoni-report.json`과 같은 내용 | build_kwoni.py | 생성 |
