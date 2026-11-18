# reservoir-flood-check

전국 농업용 저수지 치수안정성 평가 웹앱. 기준 문서는 [CLAUDE.md](CLAUDE.md), 계산 규칙은 [docs/calc-rules.md](docs/calc-rules.md), 자료 점검은 [docs/data-audit.md](docs/data-audit.md).

> 현재 상태: 프로젝트 뼈대만 있다. 계산식과 화면 디자인은 아직 구현하지 않았다.

## 실행

```bash
npm install
npm run dev     # http://localhost:3000
npm test        # vitest
npm run build
```

인증키는 `.env.local`(로컬)과 Vercel 환경변수에만 둔다. 이름은 `.env.example` 참고: `DATA_GO_KR_KEY`, `SAFETYDATA_KEY`.

## 구조

| 경로 | 내용 |
|---|---|
| `app/page.tsx` | 전국 목록·지도 |
| `app/r/[code]/page.tsx` | 저수지 상세(표준코드) |
| `app/api/water-level` | 수위 API(15099919) 프록시 |
| `app/api/rainfall` | ASOS API(15057210) 프록시 |
| `components/` | 화면 부품 |
| `lib/` | 계산(브라우저에서 실행) |
| `data/` | `scripts/`가 만든 JSON |
| `scripts/` | 내 PC에서만 도는 Python 전처리 |
| `tests/` | Vitest |

참고자료는 저장소 밖 `../Reference`에 있고 수정하지 않는다.

## 출처

공공데이터포털(한국농어촌공사 저수지 제원·수위·저수율), 재난안전데이터 공유플랫폼(공공누리 제3유형), 기상청(ASOS), 지도 © OpenStreetMap contributors.
