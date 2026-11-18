# scripts/

내 PC에서만 실행하는 Python 전처리. `../Reference`(저장소 밖)를 읽어 `data/`에 JSON을 쓴다.

- `../Reference`의 파일은 수정하지 않는다. Metdata.mdb는 Windows에서 열지 않고 `02_가공자료/KHAS_Metdata_추출/`의 CSV를 쓴다.
- 웹앱(Vercel)은 Python을 실행하지 않는다.

| 스크립트 | 만드는 파일 |
|---|---|
| `build_kwoni.py` | `data/validation/kwoni.json` (권이 검증값, CLAUDE.md 6절) |
