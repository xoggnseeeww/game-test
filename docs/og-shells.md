# og-shells — 페이지별 OG 미리보기 셸

> 선택 로드 문서. 카카오톡·트위터 링크 미리보기를 손볼 때만 읽는다.
> `docs/architecture.md`에서 분리됐다(D-88) — 테스트·게임이 늘 때마다 셸도 늘어나는
> **인벤토리**라, 계약·절차만 남긴 architecture.md와 수명이 다르다.
> 폴더 `og-shells/`와 이름이 같지만 이 파일은 문서다.

## OG 미리보기 셸 (`og-shells/`)

정적 SPA는 `index.html` 하나가 전 주소를 서빙해서, OG 태그도 원래 전 주소 공통이었다
(`docs/DECISIONS.md` D-47 이전). 테스트·게임 진입 화면 3곳(`/test/adhd`·`/test/disc`·
`/game/numpath`)만 예외로 페이지별 미리보기를 지원한다:

- `_redirects`가 그 3개 경로만 `og-shells/*.html`로 **rewrite**(200, 주소창은 안 바뀜)한다.
  나머지 모든 경로는 그대로 `/index.html`로 떨어진다 — 규칙은 **위에서부터 첫 매치**이므로
  이 3개 규칙이 반드시 와일드카드(`/*`)보다 **위**에 있어야 한다.
- 셸 파일은 `index.html`과 거의 같다(같은 `<script type="module" src="/js/main.js">`,
  같은 `#app`) — `<title>`·`og:title`·`og:description`·`og:image`·`og:url`만 페이지별이다.
  크롤러는 이 정적 `<head>`만 읽고, 실제 방문자는 같은 모듈 스크립트가 이어서 SPA를 그린다.
- `og:image`는 앱 이름·이모지·브랜드 색(`card.color`)을 홈 화면 목록 카드(`.test-card`)와
  같은 스타일로 재구성한 1200×630 PNG(`assets/og-<이름>.png`) — Playwright로 생성했다
  (레포 의존성 아님, `docs/DECISIONS.md` D-9와 같은 이유).
- 카드 문구(`card.name`/`card.desc`)가 바뀌면 셸의 텍스트는 **자동으로 안 바뀐다** —
  `test/og-shells.test.js`가 카드 데이터와 셸 파일 내용을 대조해서 벌어지면 빨간불을 낸다.
- 로컬 검증: `serve.py`가 `_redirects`를 실제로 파싱해서 같은 규칙을 적용하므로,
  `python3 serve.py 8766` 상태에서 `curl localhost:8766/test/adhd`로 그대로 확인할 수 있다.

| 파일 | 무엇을 지키나 |
|------|---------------|
| `test/modules.test.js` | import가 실재하는 export를 가리키는가 / export 없이 쓰는 곳이 없는가 / 화면 id·경로 중복 없는가 |
| `test/disc.score.test.js` | DISC 채점 불변식 (합 0, 순서 무관, 결정론, 대척점 배제, 12유형 도달, 슬러그 왕복) |
| `test/adhd.score.test.js` | 반응 코멘트가 억제 실패×누락 9개 조합 모두 다른 문장을 주는가 / 게임 보너스 임계값 / 이미 100%인 축엔 보너스가 안 보이는가 |
| `test/copy.test.js` | 화면 문구의 개수가 데이터에서 파생되는가 (`docs/ERRORS.md` E-1) |
| `test/couple.score.test.js` | 문항 뱅크 구조 / 조립 규칙(요인 이격·역채점 분산·앵커 후미·축 조합 무관 동일 구성) / 채점 임계값 / 유효성 플래그 / 유형×문구 뱅크 빠짐없음 |
| `test/couple.match.test.js` | ΔDISC 정규화 · Risk Matrix 대칭 · Gap 방향 보존 · 게이지 방향(K2 가산/K4 감산) · 등급 완충 · 구간 문구에 숫자 없음 · 배우자 코드 왕복/체크섬 |
| `test/couple.shortcode.test.js` | 짧은 코드 형식(8자·Crockford Base32) · 혼동 글자(I·L·O·U) 미포함 · 바이트→문자 매핑이 치우치지 않는가 · 정규화(대소문자·대시) |
| `test/numpath.engine.test.js` | 순차 연산 · 이동 판정(나눗셈 정수·뺄셈 양수) · Undo 왕복 불변식 · 클리어/막힘/이동초과 판정 |
| `test/numpath.generate.test.js` | 시드 재현성 · 스테이지별 시드 파생(같은 레벨 반복 시 보드 중복 금지) · 난이도 커브 유효성 · 커브의 모든 스테이지가 항상 solve() 가능한가(교차 검증) · 별 등급 임계값 · formatTime() 표시 형식 |

**여기서 안 잡히는 것**: 라우팅·이벤트 바인딩·타이머·레이아웃 → `scripts/verify.cjs`(헤드리스 브라우저)의 몫이다.
