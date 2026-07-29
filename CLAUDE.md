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
- SPA 폴백: `_redirects` (`/*  /index.html  200`) — 없으면 하위 경로 직접 접속이 404
- 영속 데이터: **없음** (예전엔 `localStorage["gt_reaction_best"]`로 반응속도 최고기록을 저장했으나 D-20에서 제거) / 시크릿·환경변수·백엔드 **없음**
- 방문 분석: Cloudflare Web Analytics — `data-pantry.com` 존에 automatic setup으로 이미 등록돼 있고,
  `fun.data-pantry.com`은 같은 존의 서브도메인이라 **코드 변경 없이 자동으로 같이 잡힌다**(2026-07-28 확인).
  **이 레포에 분석 스크립트를 추가하지 말 것** — 페이지당 스니펫은 하나만 허용되는데 이미 상위 존에서
  주입되고 있어서, 여기 또 넣으면 충돌한다. 대시보드는 Cloudflare 계정의 Web Analytics → `data-pantry.com`
  → Manage site에서 경로별로 필터링해서 본다.

## 기술 스택
빌드 없는 정적 SPA. 브라우저 네이티브 ES 모듈(`<script type="module">`), 런타임 의존성 0.
외부 의존은 CDN 폰트 하나. 라우팅은 History API 직접 구현 + **레지스트리 방식 라우터**.
상태는 메모리 내 단일 `state` 객체(새로고침하면 날아감).

## 구조 개요
```
index.html            진입점 (메타·OG·referrer 정책은 전 주소 공통 — 페이지별 미리보기 불가)
assets/                favicon(svg) · apple-touch-icon(png) · og-image(png, 1200×630)
js/main.js            부팅: 화면·테스트·게임을 라우터에 등록
js/core/              router(레지스트리·guard·teardown·게임 레지스트리) · state · dom · share · util · ads
js/screens/home.js    홈 · 심리테스트 목록(등록된 테스트에서 자동 생성) · 미니게임 목록(등록된 게임에서 자동 생성)
js/tests/<id>/        테스트 1개 = 폴더 1개: data · score · screens · index(디스크립터)
                      현재 adhd(+반응속도 게임), disc(+딜레마 게임),
                      couple(+assemble · match — 문항지 조립과 부부 매칭이 따로 검증돼야 해서 분리)
js/games/<id>/        테스트에 속하지 않는 독립 미니게임 1개 = 폴더 1개. 현재 numpath
test/                 node --test 스위트 (채점 로직 · 게임 로직 · 모듈 import/export 정합성)
styles.css            전체 스타일. 브랜드 색은 CSS custom properties + theme-* 클래스
_redirects            Cloudflare Pages SPA 폴백
serve.py              로컬 개발 서버 (SPA 폴백 포함, 개발 전용)
scripts/verify.cjs     헤드리스 브라우저 회귀 스위트 (레포 의존성 아님 — 파일 헤더 참고)
docs/design-draft.html  최초 디자인 목업. 배포·동작과 무관 (.claudeignore)
```

## 상세 문서
| 문서 | 내용 |
|------|------|
| `docs/architecture.md` | 모듈맵 · 라우터 계약 · 화면 표 (15KB 넘겨 테스트/게임별 상세는 아래로 분리됨) |
| `docs/adhd-architecture.md` | ADHD 흐름 · 채점 파이프라인 |
| `docs/disc-architecture.md` | DISC 흐름 · 채점 파이프라인 |
| `docs/couple-architecture.md` | 부부 관계 성향 체크 흐름 · 문항지 조립 · 채점 · 부부 매칭 · 배우자 코드 · 안전 장치 |
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
- **부부 체크의 결과 전달 안전 장치를 빼지 말 것** — 유형 라벨 단독 노출 금지(연속 점수·확신도 동반),
  **단일 궁합 점수 산출 금지**(블록별 구간 서술만), 백분위·석차 표현 금지(규준 표본이 없다),
  격차의 **방향·지목 노출 금지**(크기와 개념명만), 원 척도 유형명·축 명칭 노출 금지(자사 표기 AT/CS만).
  전부 기획서 §2·§6~§9의 요구이고 `npm test`와 `scripts/verify.cjs`가 함께 검사한다 →
  `docs/couple-architecture.md` §8

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
- 부부 체크의 배우자 코드 필드 추가/순서 변경 → `match.js`의 `VERSION`도 함께 올린다. 자리로만
  읽는 코드라, 순서를 바꾸면 **이미 공유된 링크가 조용히 다른 값으로 해석된다**
- 부부 체크 문항 추가/삭제 → 문장이 부부 양쪽에 동일한 문항만 `computeCouple()`의 `comparable`
  ·`anchors`에 넣는다. 역할별로 문장이 갈리는 문항(R1~R4)이 들어가면 서로 다른 문장의 점수를 빼게 된다
- 부부 체크 앵커 문항 수 변경 → `assemble.js`의 `ANCHOR_ZONE_START`/`ANCHOR_STRIDE`가 문항지
  끝을 넘지 않는지 확인한다(6개×3칸이 34번에서 시작해 정확히 49번에 끝난다). 넘으면 조립이
  조용히 앞으로 밀린다
- 구조 변경(모듈 추가·이동·삭제) → **같은 커밋에** `docs/architecture.md` 모듈맵과 위 구조 개요 트리 갱신
- `styles.css` 클래스명 변경 → 템플릿 문자열은 타입 체크가 없다. `grep -rn '<클래스명>' js/ styles.css`로 양쪽 확인

## 절대 수정 금지
`.git/` · `node_modules/` · `docs/design-draft.html`
