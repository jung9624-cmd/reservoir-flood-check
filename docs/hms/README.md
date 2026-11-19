# HEC-HMS 교차검증: 권이 120분 (임계지속기간)

`python scripts/export_hms.py`가 만든 파일. 계산식은 `lib/`와 같고, 같은지는 `tests/hms.test.ts`가 확인한다.

| 파일 | 내용 |
|---|---|
| `kwoni_120min_rain.csv` | 10분 강우(mm) 12개. 보고서 200년 120분 확률강우량 127.82 mm × Huff 3분위(1 % 표 선형보간). `end_min` = 구간 끝 시각 |
| `kwoni_120min_inflow.csv` | 웹앱 계산식의 유입 수문곡선(10분). `inflow_raw_cms` = Clark, `inflow_x1_2_cms` = × 1.2 (필댐 할증) |
| `kwoni_esd.csv` | 표고-저류량-방류량. 설계 내용적표 17행 + EL.164.40~169.50 0.05 m 간격. 방류량 = 물넘이(61.0 m, 마루 165.90, C 2.05) + 비상수문(4.0 m, 바닥 164.40, C 2.0, 열림) |

비상수문 C 2.0은 CLAUDE.md에 값이 없어 웹앱 기본값을 썼다(calc-rules 7-11).

## 설정 체크리스트

### Basin Model

- [ ] **Subbasin** 1개, Area **6.40 km²**
- [ ] Canopy·Surface·Baseflow: None
- [ ] **Loss: SCS Curve Number**
  - [ ] Curve Number **89** (AMC-Ⅲ 값을 그대로)
  - [ ] Initial Abstraction 빈칸 (= 0.2S)
  - [ ] Impervious 0 %
- [ ] **Transform: Clark Unit Hydrograph** (Standard)
  - [ ] Time of Concentration **0.26 HR**
  - [ ] Storage Coefficient **0.20 HR**
  - [ ] 시간-면적 곡선은 HMS 기본(At/A = 1.414T^1.5)으로 둔다. 웹앱과 같은 식이다
- [ ] **Reservoir** 1개 (Subbasin → Reservoir)
  - [ ] Method: **Outflow Curve**, Storage Method: **Elevation-Storage-Discharge**
  - [ ] Paired Data: `kwoni_esd.csv`의 Elevation-Storage(`storage_1000m3`, 1000 M3)와 Elevation-Discharge(`discharge_cms`)
  - [ ] Initial Condition: **Elevation 165.90** (만수위)
- [ ] 할증 × 1.2: Simulation Run의 **Ratio**(유량에 적용) 1.2. HMS 버전마다 메뉴 위치가 다르니 확인한다.
  - [ ] Ratio를 쓸 수 없으면 아래 실행 C로 추적만 비교한다

### Meteorologic Model

- [ ] **Specified Hyetograph**, Precipitation Gage 1개
- [ ] Gage: Incremental Precipitation, 단위 MM, 간격 **10 Minutes**, `kwoni_120min_rain.csv`의 12개 값. 값은 구간 끝 시각(00:10 … 02:00)에 둔다

### Control Specifications

- 시작: 예) 01Jan2000 00:00
- 끝: 06:00 (유입은 약 4.5시간에 끝난다. 웹앱은 유입이 끝나고 60분 더 추적한다)
- 시간 간격은 아래 실행마다 다르다

### 실행

| 실행 | 구성 | 시간 간격 | 결과 파일 이름 | 무엇을 비교하나 |
|---|---|---|---|---|
| A | Subbasin → Reservoir, Ratio 1.2 | **10분** | `kwoni_120min_hms_A.csv` | 유효우량·Clark은 웹앱과 같은 간격. 추적 간격은 다르다(웹앱 1분) |
| B | 같음 | **1분** | `kwoni_120min_hms_B.csv` | 추적 간격은 같다. Clark을 1분으로 계산해서 첨두가 다를 수 있다(웹앱 10분) |
| C | **Source**(Discharge Gage = `kwoni_120min_inflow.csv`의 `inflow_x1_2_cms`, 10분) → Reservoir | **1분** | `kwoni_120min_hms_C.csv` | 홍수추적만 비교 (수정 Puls ↔ Outflow Curve) |

## 결과를 넣는 곳

`../Reference/05_HEC-HMS/`에 위 이름의 CSV(UTF-8)를 넣는다. 저장소에는 넣지 않는다.

```csv
time_min,inflow_cms,outflow_cms,elevation_m
0,0,14.697,165.90
10,...
```

- `time_min`: 시작부터의 분. HMS 결과표의 날짜·시각을 분으로 바꿔 넣는다
- `inflow_cms`: Reservoir 유입(Ratio 적용 후)
- `outflow_cms`: Reservoir 방류
- `elevation_m`: Reservoir 수위(EL.m)

넣은 뒤 `npm test`를 실행하면 `tests/hms.test.ts`가 웹앱 120분 결과와 비교한다(첨두 유입·최대방류 0.5 %, 최고수위 ±0.01 m). 파일이 없으면 이 비교는 건너뛴다.
