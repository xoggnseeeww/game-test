# 과몰입구역 — Claude 작업 컨텍스트

## READ ORDER
1. `CLAUDE.md` — 항상
2. `CURRENT_TASK.md` — 항상
3. `PROGRESS.md` — 조건부 (회귀 추적 / 과거 설계 배경 확인 / 명시 요청 / 맥락 부족 시에만). `.claudeignore` 대상이라 필요할 때 명시적으로 Read 한다
4. `docs/*` — 필요 시 선택 로드

## 커맨드
| 동작 | 명령어 |
|------|--------|
| 로컬 실행 | `python3 serve.py 8766` — **`-m http.server` 금지** (SPA 폴백 없어 하위 경로 404 → 라우팅 오판) → `docs/ERRORS.md` E-9 |
| 빌드 | **없음** (ES 모듈을 브라우저가 직접 로드) |
| 테스트 | `npm test` (= `node --test`, 의존성 0) — 채점 로직·모듈 정합성 |
| 브라우저 회귀 | `mkdir -p /tmp/pw && cd /tmp/pw && npm i playwright` → `NODE_PATH=/tmp/pw/node_modules node scripts/verify.cjs` (서버 먼저) |
| 배포 | `main` push → Cloudflare Pages 자동 배포 |

## 식별자
- 도메인 `https://fun.data-pantry.com` / 저장소 `xoggnseeeww/game-test`
- 호스팅: Cloudflare Pages — 빌드 명령 없음, 출력 디렉터리 = 레포 루트
- SPA 폴백: `_redirects` (`/*  /index.html  200`, 항상 마지막 줄) — 없으면 하위 경로 직접 접속이 404.
  그 위에 페이지별 OG 셸로 보내는 rewrite 규칙 3개가 더 있다(D-32) — `_redirects`는 첫 매치 우선이라
  더 구체적인 규칙이 항상 와일드카드보다 **위**에 있어야 한다. `test/og-shells.test.js`가 순서를 검사한다
- 영속 데이터: `localStorage["gt_numpath_village"]`(NumPath 마을 코인·건설 목록, D-34) — 로그인 시
  data-pantry.com과 같은 Supabase 프로젝트(`duvpvwolgqurhgnhqezj`)의 `numpath_village` 테이블과
  선택적으로 동기화된다(D-35, `js/games/numpath/cloud.js`). 반응속도 최고기록(`gt_reaction_best`)은
  D-20에서 제거됐고 **되살리지 말 것** — D-20의 금지는 "검사에서 빠름을 성취로 프레이밍"하는 것이지
  게임 진행 저장이 아니다(경계는 D-34 참고) / 시크릿·환경변수 **없음**(Supabase anon key는 공개
  키라 시크릿이 아니다 — D-35). 백엔드는 이 저장소 자체엔 없고, data-pantry.com의 기존 계정
  체계를 재사용할 뿐이다
- 방문 분석: Cloudflare Web Analytics — `data-pantry.com` 존에 automatic setup으로 이미 등록돼 있고,
  `fun.data-pantry.com`은 같은 존의 서브도메인이라 **코드 변경 없이 자동으로 같이 잡힌다**(2026-07-28 확인).
  **이 레포에 분석 스크립트를 추가하지 말 것** — 페이지당 스니펫은 하나만 허용되는데 이미 상위 존에서
  주입되고 있어서, 여기 또 넣으면 충돌한다. 대시보드는 Cloudflare 계정의 Web Analytics → `data-pantry.com`
  → Manage site에서 경로별로 필터링해서 본다.

## 기술 스택
빌드 없는 정적 SPA. 브라우저 네이티브 ES 모듈(`<script type="module">`), 런타임 의존성 0(npm 설치
기준 — 브라우저가 직접 불러오는 CDN 모듈은 있다). 외부 CDN 의존: 폰트 하나 + NumPath 마을의 클라우드
로그인용 Supabase JS(`js/games/numpath/cloud.js`, D-35) — 후자는 **동적 import로만** 연결돼 있어
CDN이 막혀도 그 화면 하나만 로그인 기능이 빠지고 나머지 앱은 정상 동작한다(`cloud-loader.js` 참고).
라우팅은 History API 직접 구현 + **레지스트리 방식 라우터**. 상태는 메모리 내 단일 `state`
객체(새로고침하면 날아감).

## 구조 개요
```
index.html            진입점 (메타·OG·referrer 정책은 기본값 — 아래 3곳 외 전 주소 공통)
og-shells/             테스트·게임 진입 화면 3곳의 정적 OG 셸(og-shells/test-adhd.html 등).
                      _redirects가 해당 경로만 이 파일로 rewrite한다 — index.html과 내용은
                      거의 같고 <title>·og:*만 페이지별이다(D-32)
assets/                favicon(svg) · apple-touch-icon(png) · og-image*.png(1200×630, 홈+테스트/게임별)
js/main.js            부팅: 화면·테스트·게임을 라우터에 등록
js/core/              router(레지스트리·guard·teardown·게임 레지스트리) · state · dom · share · util · ads
js/screens/home.js    홈 · 심리테스트 목록(등록된 테스트에서 자동 생성) · 미니게임 목록(등록된 게임에서 자동 생성)
js/tests/<id>/        테스트 1개 = 폴더 1개: data · score · screens · index(디스크립터)
                      현재 adhd(+반응속도 게임), disc(+딜레마 게임)
js/games/<id>/        테스트에 속하지 않는 독립 미니게임 1개 = 폴더 1개. 현재 numpath
test/                 node --test 스위트 (채점 로직 · 게임 로직 · 모듈 import/export 정합성 · OG 셸 정합성).
                      `og-shells/`와 이름이 비슷하지만 무관 — 여긴 순수 JS 유닛 테스트 폴더다
styles.css            전체 스타일. 브랜드 색은 CSS custom properties + theme-* 클래스
_redirects            Cloudflare Pages SPA 폴백 + 페이지별 OG 셸 rewrite (순서 중요, 위 항목 참고)
serve.py              로컬 개발 서버 — `_redirects`를 실제로 읽어 규칙대로 적용한다(개발 전용)
scripts/verify.cjs     헤드리스 브라우저 회귀 스위트 (레포 의존성 아님 — 파일 헤더 참고)
docs/design-draft.html  최초 디자인 목업. 배포·동작과 무관 (.claudeignore)
```

## 상세 문서
| 문서 | 내용 |
|------|------|
| `docs/architecture.md` | 모듈맵 · 라우터 계약 · 화면 표 (15KB 넘겨 테스트/게임별 상세는 아래로 분리됨) |
| `docs/adhd-architecture.md` | ADHD 흐름 · 채점 파이프라인 |
| `docs/disc-architecture.md` | DISC 흐름 · 채점 파이프라인 |
| `docs/numpath-architecture.md` | NumPath 흐름 · 게임 로직(타일 모델 · 생성기 · 솔버 · 별 판정) 개요 |
| `docs/ERRORS.md` | 오류 패턴 (같은 증상이 재발할 때) |
| `docs/DECISIONS.md` | 설계 결정 · 기각안 · 되돌림 |

## ⚠️ ABSOLUTE RULES
- **화면은 디스크립터로만 추가한다** — `{ id, path, title, render, theme?, guard?, dynamicPath? }`를 해당 테스트의 `index.js` 배열에 넣는다.
  라우터가 등록된 것만 안다. **`render()`에 분기를 추가하거나 경로 표를 따로 두지 말 것** — 그러려고 레지스트리로 바꿨다(`docs/DECISIONS.md` D-13).
- **화면을 떠날 때 정리할 것은 `onLeave()`에 등록한다** — 타이머·`requestAnimationFrame`·전역 리스너. 직접 `clearTimeout`으로 관리하지 말 것.
  등록하지 않으면 뒤로가기 후에도 콜백이 살아남아 **다른 화면을 결과 화면으로 밀어버린다** → `docs/ERRORS.md` E-4
- **화면 id를 바꾸지 않는다** — 이미 열려 있는 탭의 `history.state`에 옛 id가 남아 있어, 이름을 바꾸면 배포 직후 뒤로가기가 깨진다. (`test-*`가 ADHD인 것은 이 때문이다)
- **개수는 화면 문구에도 하드코딩 금지** — `${QUESTIONS.length}`, `${TETRADS.length}`, `${CPT_ROUNDS}` 를 쓴다. 주석도 마찬가지.
  확인: `grep -rnE '>[^<{]*[0-9]+(문항|가지|라운드|개)' js/` → **출력이 없어야 함**
- **에러 삼킴 금지** — `.catch(() => {})` 금지, 최소한 `console.error`.
  예외: `localStorage` 접근(프라이버시 모드 throw)과 `runTeardowns()`의 catch는 **의도된 방어**다. 제거하지 말 것.
- **검증은 `npm test` + 실제 브라우저 둘 다** — 빌드가 없어 "빌드 통과"라는 신호가 없다.
  `npm test`는 채점·모듈 정합성만 본다. 라우팅·이벤트·레이아웃은 `scripts/verify.cjs`로만 잡힌다.
  **확인하지 못한 항목은 `CURRENT_TASK.md`의 "배포 후 확인 필요"로 옮긴다** — 침묵은 "확인됨"으로 오독된다.
- **의학적 진단 표현 금지** — "성향 체크"까지만. `disclaimer` 문구를 제거하거나 약화하지 말 것 → `docs/DECISIONS.md` D-3

## 동기화 매트릭스
> `[바꾸는 것] → [반드시 같이 고칠 것]`. 모를 때 필요한 정보라서 자동 로드에 둔다.
> 라우터·목록 카드처럼 **레지스트리가 흡수한 결합은 여기서 뺐다** — 매트릭스를 늘리기 전에 결합을 없앨 수 있는지 먼저 본다.

- 새 테스트 추가 → `js/main.js`에 `registerTest` + `registerScreens` **둘 다**. 하나만 하면 목록 카드나 공유 URL 한쪽이 조용히 빠진다
- 새 독립 미니게임 추가(테스트에 속하지 않는 경우) → `js/main.js`에 `registerGame` + `registerScreens` **둘 다**, `test/modules.test.js`의 화면 목록에도 새 `<id>Screens` 추가. 반응속도·딜레마처럼 테스트 하위 단계인 게임은 여기 해당 안 됨(D-4)
- 결과 유형 추가/삭제 → 같은 `data.js`의 슬러그 맵도 갱신 (없으면 공유 URL이 조용히 홈으로 폴백) — DISC는 `slug` 필드가 단일 소스라 자동
- 문항 수 변경 → 해당 `score.js`의 만점 분모가 문항 수에서 파생되는지 확인 (ADHD `toPct` 분모 `16` = 축당 4문항 × 4점)
- `AXIS_HIGH_THRESHOLD` 변경 → `axisIntensityText()`의 구간 경계(`60`)도 같이 조정
- `CPT_ROUNDS` / `CPT_NOGO_COUNT` 변경 → `gameBonuses()`의 오류율 구간이 여전히 의미 있는지 확인
- 새 `theme` 값 추가 → `js/core/router.js`의 `THEME_CLASSES` 배열 + `styles.css`의 `theme-*` 변수 블록
- 구조 변경(모듈 추가·이동·삭제) → **같은 커밋에** `docs/architecture.md` 모듈맵과 위 구조 개요 트리 갱신
- `styles.css` 클래스명 변경 → 템플릿 문자열은 타입 체크가 없다. `grep -rn '<클래스명>' js/ styles.css`로 양쪽 확인
- 새 테스트/게임에 OG 미리보기 추가 → `og-shells/<이름>.html` 작성 + `_redirects`에 규칙 추가(**와일드카드 위**) + `assets/og-<이름>.png` + `test/og-shells.test.js`의 `SHELLS` 배열에 항목 추가. 카드(`card.name`/`card.desc`) 문구 변경 시 셸의 `<title>`·`og:title`·`og:description`도 같이 고친다 — 자동 반영 안 됨(D-32), `og-shells.test.js`가 불일치를 잡아준다
- `assets/og-*.png` **내용**을 고칠 때 → **파일명도 반드시 같이 바꾼다**(예: `-v2`, `-v3`). URL이 그대로면 카카오·CDN·브라우저의 이미지 캐시가 옛 파일을 계속 서빙한다 — 제목·설명은 갱신되는데 이미지만 안 바뀌는 증상으로 나타나 원인 추적이 어렵다. 파일명을 바꾸면 셸의 `og:image`/`twitter:image`와 `test/og-shells.test.js`의 `SHELLS` 배열도 같이 갱신

## 절대 수정 금지
`.git/` · `node_modules/` · `docs/design-draft.html`
