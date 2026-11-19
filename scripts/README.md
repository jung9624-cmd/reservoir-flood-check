# scripts/

내 PC(Windows)에서만 실행하는 Python 전처리. `../Reference`(저장소 밖)를 읽어 `data/`에 JSON을 쓴다. 결과 JSON만 저장소에 넣는다.

- `../Reference`의 파일은 수정하지 않는다. Metdata.mdb는 열지 않고 `02_가공자료/KHAS_Metdata_추출/`의 CSV(zip)를 쓴다.
- 웹앱(Vercel)은 Python을 실행하지 않는다.
- 필요 패키지: pandas, numpy (`--geocode`일 때 requests)

| 스크립트 | 만드는 파일 |
|---|---|
| `preprocess.py` | `data/` 전체 (아래 단계) |
| `build_kwoni.py` | `tests/fixtures/kwoni-report.json` (권이 보고서 검증값, CLAUDE.md 6절) |
| `export_hms.py` | `docs/hms/` (권이 120분 HEC-HMS 교차검증 입력·설정 체크리스트) |

## preprocess.py

```bash
python scripts/preprocess.py            # A~F
python scripts/preprocess.py C F        # 일부 단계
python scripts/preprocess.py B --geocode  # 좌표 없는 저수지를 OSM Nominatim으로 근사 (약 1,561건, 초당 1건)
```

Reference 경로는 파일 맨 위 `REFERENCE` 상수 하나로 바꾼다.

| 단계 | 입력 | 출력 | 마지막 실행 결과 (2026-11-19) |
|---|---|---|---|
| A 제원 | 15044339 CSV (cp949) | `reservoirs.json` | 3,402곳, 기준일 2026-09-07. 플래그: 총≠유효+사수 112, 홍수위≤만수위 36, 홍수빈도 0 26 … |
| B 위치 | `02_가공자료/저수지_좌표_공유플랫폼_연결.csv` | `coords.json` | 공유플랫폼 1,183곳 + `--geocode` 근사 2,219곳 (리·동 626, 읍·면 1,591, 시·군·구 2), 실패 0. 검색 2천여 건, 결과는 `scripts/.cache/nominatim.json`(저장소 밖)에 캐시. '전남광주통합특별시'는 OSM에 옛 이름·새 이름이 섞여 있어 둘 다 묻는다 |
| C 저수율 | 2025 일별 저수율 CSV | `storage-2025.json` | 이름+소재지 2,270 → 이름+끝 두 단어 1,028 → 이름+유효저수량 19 = 3,317곳. 100 % 초과 111셀. 기존 연결표(3,318)와 비교: 값 차이는 반올림 0.1 이내, 연결표에만 있는 1곳(해제1호 ↔ 저수율 파일 '해제1-1호') |
| D 강우 | `Rain_HrData_시간강우.zip` | `rainfall/annual-max/*.json`, `stations.json` | 92곳(30년 이상 70곳). `stations.json`은 ASOS 지점정보 파일이 없어 멈춤 |
| E Huff | `k has.xlsx` | `huff/khas-q3.json` | 합계 100.00004 %, 10 % 누가값이 CLAUDE.md 5-3과 같음 |
| F 검증 | 포항(138) 1961~2022 | 화면 출력 | khas 연최대가 기존 CSV와 같음, 200년 확률강우량 10개 모두 0.3 % 이내 (최대 −0.28 %, 120분). actual은 120분 +1.02 %, 240분 −1.28 %, 1440분 −2.07 % |

종료 코드: 멈춘 단계(파일 없음)나 검증 실패가 있으면 1.
