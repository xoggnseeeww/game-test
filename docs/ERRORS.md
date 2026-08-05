# ERRORS — 오류 패턴

> 선택 로드 문서. 같은 증상이 재발하거나 원인이 안 잡힐 때 읽는다.
> 같은 오류가 **2회** 발생하면 즉시 여기에 추가하고, **3회** 발생하면 `.claude/rules/`로 내린다.
> ⚠️ **파일 크기 자동 분리 규칙**: 300줄(또는 15KB)을 넘으면 이 문서를 수정하는 세션이 별도 지시 없이
> `docs/errors-runtime.md` / `docs/errors-ai.md`로 분리하고 이 파일에는 인덱스만 남긴다. `CLAUDE.md` 상세 문서 표에 행 추가.

## 인덱스
| 증상 | 항목 |
|------|------|
| 화면 문구의 개수가 실제와 다름 | E-1 `count-hardcode` |
| 새 화면이 뒤로가기/직접 접속에서 깨짐 | E-2 `route-partial` |
| **배포 직후에만** 뒤로가기가 빈 화면 | E-2b `stale-screen-id` |
| 공유 링크를 열면 빈 테스트가 나옴 | E-3 `share-fallback` |
| 이전 화면의 타이머가 새 화면에서 발동 | E-4 `stale-timer` |
| 배포는 됐는데 사이트가 안 뜸 / 직접 접속 404 | E-5 `pages-serving` |
| **로컬에서만** 하위 경로 404 | E-9 `local-server-no-fallback` |
| 특정 브라우저에서만 레이아웃이 깨짐 | E-6 `modern-css` |
| 목업 잔재가 실기기에서 중복으로 보임 | E-7 `mockup-leftover` |
| 결과 유형이 답변과 모순됨 | E-8 `scoring-flatten` |
| 광고 슬롯 자리는 있는데 광고가 안 나옴 | E-10 `spa-third-party-script` |
| 배너가 2개인데 하나만 채워짐 | E-11 `duplicate-ad-unit` |

---

## 런타임 오류

### E-1. `count-hardcode` — 화면 문구의 개수가 데이터와 어긋난다
문항·유형·라운드 수를 화면 문구에 숫자로 적어두면, 데이터를 늘려도 문구가 따라오지 않는다.
에러가 나지 않고 **잘못된 숫자를 그대로 보여준다.**

```js
// ❌ 데이터가 바뀌어도 그대로 남는다
<div class="desc">집중 안 되는 나, 혹시…? · 12문항</div>

// ✅
<div class="desc">집중 안 되는 나, 혹시…? · ${QUESTIONS.length}문항</div>
```

- **재현 조건**: `QUESTIONS` / `RESULT_TYPES` / `CPT_ROUNDS` 를 늘리거나 줄인 뒤 목록·인트로 화면을 확인
- **확인 방법**: `npm test` (`test/copy.test.js`가 자동 검사). 수동으로 보려면
  `grep -rnE '>[^<{]*[0-9]+(문항|가지|라운드|개)' js/` → **출력이 없어야 함** (설계 배경을 적은 주석은 걸리지 않게 HTML 텍스트 노드만 본다)
- **실측 3회 → 4단(코드 강제)으로 승격**:
  1. ADHD 목록 카드가 `12문항` 리터럴 (인트로는 `${QUESTIONS.length}`) — 두 화면이 서로 다른 숫자를 말할 수 있었다
  2. Go/No-Go 주석이 "10라운드" (`CPT_ROUNDS`는 14) — **주석도 같은 종류의 하드코딩이다**
  3. DISC 인트로 본문이 `상황 12개` 리터럴 (같은 화면의 칩은 `${TETRADS.length}`)
  → 3회차에서 문서 규칙을 **테스트로 승격**시켰다: `test/copy.test.js`. 이제 `npm test`가 막는다.
- **정규식 함정**: 초판 검사는 `문항|가지|라운드`만 봐서 **`상황 12개`를 통과시켰다** — 단위가 숫자 뒤에 오는 조사형(`개`)이라 잡히지 않았다.
  검사를 추가했으면 **버그를 일부러 되살려 빨간불이 뜨는지 확인**할 것. 초록불만 보면 검사가 비어 있어도 모른다.

### E-2. `route-partial` — 새 화면이 뒤로가기·직접 접속에서 조용히 깨진다
**대부분 해결됨(구조적).** 예전엔 라우트가 5곳(`ROUTES`·`SCREEN_TO_PATH`·`SCREEN_TITLES`·`render()` switch·`resolveScreen()`)에
흩어져 있어 하나만 빠뜨려도 에러 없이 홈 폴백·빈 화면이 됐다. 지금은 **디스크립터 하나**로 모인다(`docs/DECISIONS.md` D-13).

남아 있는 실패 지점은 두 개뿐이다.

| 빠뜨린 곳 | 증상 |
|-----------|------|
| `js/main.js`의 `registerScreens` | 화면 자체가 미등록 → 주소 직접 접속이 홈 폴백 |
| `js/main.js`의 `registerTest` | 화면은 뜨는데 **목록 카드와 공유 URL이 빠진다** (`listTests()`·`slugToKey`가 못 찾음) |

- **자동으로 잡히는 것**: 화면 id·경로 중복은 등록 시점에 **throw**하고, `test/modules.test.js`가 이를 검사한다. 조용히 덮어쓰던 예전 동작과 다르다.
- **확인 방법**: `npm test` 후 실제 브라우저에서 ① 주소 직접 접속 ② 진입 후 뒤로가기 ③ 뒤로가기 후 앞으로가기
- 관련 규칙: `CLAUDE.md` ABSOLUTE RULES, `.claude/rules/js-modules.md`

### E-2b. `stale-screen-id` — 배포 직후에만 뒤로가기가 깨진다
화면 `id`는 `history.state`에 저장된다. 배포 전에 열어둔 탭에는 **지금은 없는 id**가 남아 있다.

- **증상**: 배포 직후 일부 사용자만 뒤로가기 시 빈 화면. 새로고침하면 정상 → 재현이 어렵다.
- **현재 방어**: `resolveScreen()`이 미등록 id를 만나면 `pathToScreen(location.pathname)`으로 떨어진다.
- **규칙**: 그래도 **화면 id는 바꾸지 않는다.** ADHD 화면이 아직 `test-*`인 것은 이 때문이며, 일관성을 위해 개명하고 싶은 유혹을 참은 결과다.

### E-3. `share-fallback` — 공유 링크를 열면 빈 테스트/홈이 나온다
`parseSharedPath()`가 슬러그를 못 찾으면 `null`을 반환하고, 화면 guard가 `home`으로 떨어뜨린다.
**공유 버튼은 정상 동작한 것처럼 보이므로 공유한 사람은 끝까지 모른다.**

- **재현 조건**: 결과 유형을 추가하고 그 테스트 `data.js`의 슬러그 맵에 항목을 안 넣은 상태에서 그 유형의 결과를 공유
- **확인 방법** (유형 수와 슬러그 수가 같아야 함):
  ```bash
  node -e "import('./js/tests/adhd/data.js').then(m=>console.log(Object.keys(m.RESULT_TYPES).length, Object.keys(m.SLUG_TO_PROFILE).length))"
  node -e "import('./js/tests/disc/data.js').then(m=>console.log(Object.keys(m.DISC_TYPES).length, Object.keys(m.DISC_SLUG_TO_KEY).length))"
  ```
  DISC는 `slug`가 유형 정의 안의 필드고 맵이 거기서 파생되므로 **구조적으로 어긋날 수 없다** — ADHD만 수동 동기화 대상이다.
  `scripts/verify.cjs`가 두 테스트의 공유 주소를 실제로 열어 확인한다.
- 설계 배경: `docs/DECISIONS.md` D-7 (되돌림 항목 포함)

### E-4. `stale-timer` — 이전 화면의 콜백이 새 화면을 밀어버린다
`render()`는 매번 `app.innerHTML = ""`로 DOM을 통째로 버린다. **DOM 참조는 정리되지만 예약된 콜백은 남는다.**

- **실측**: `setScreen()`이 반응속도 게임의 `setTimeout` **하나만** 직접 `clearTimeout` 했다.
  `requestAnimationFrame` 콜백은 그 방식으로 막을 수 없어서, **게임 도중 뒤로가기를 하면 살아남은 콜백이 엉뚱한 화면을 결과 화면으로 밀어버렸다.**
  → 특정 타이머를 이름으로 관리하던 방식 자체가 원인이었다. 정리 대상을 **등록받는 구조**로 바꿔서 종결했다.

```js
// ❌ 특정 타이머만 이름으로 관리 — 새로운 종류(rAF, 리스너)가 생길 때마다 샌다
if (reactionTimer) clearTimeout(reactionTimer);

// ✅ 화면이 스스로 정리 방법을 등록한다
const id = setTimeout(tick, 1000);
onLeave(() => clearTimeout(id));

const raf = requestAnimationFrame(loop);
onLeave(() => cancelAnimationFrame(raf));
```

- **규칙**: 화면에서 타이머·`requestAnimationFrame`·전역 리스너를 만들면 **반드시 `onLeave()`에 해제를 등록**한다.
- **재현 조건**: 게임 플레이 중 뒤로가기 → 다른 화면에서 1~2초 대기
- **일반 원칙**: "이번 것도 빠뜨리지 말자"는 규칙보다, **빠뜨릴 수 없는 구조**가 낫다(`docs/DECISIONS.md` D-14).

### E-8. `scoring-flatten` — 결과 유형이 사용자의 답변과 모순된다
3개 축 점수를 **합산해서** 평탄한 임계값(12/24/36/48)에 맞추면, 한 축을 최대로 찍은 사람이 나머지 두 축에 희석돼 "차분한 유형"을 받는다.
자기 답변과 정반대 결과를 받는 것이라 신뢰가 즉시 무너진다.

- **원인**: 총점 합산 자체 — 임계값 조정으로는 못 고친다.
- **해결**: 축별 독립 판정(`profileKey()`, `AXIS_HIGH_THRESHOLD`)으로 구조를 바꿈 → `docs/DECISIONS.md` D-1
- **같이 잡힌 것**: `[100, 100, 0]`을 "균형잡힘"이라 부르던 버그(상위 두 축만 비교), 이미 100%인 축에 보너스 배지가 뜨던 버그(`visibleBonus`)
- **회귀 확인용 입력 세트** (`scripts/verify.cjs`가 첫 줄을 자동 확인한다):

  | 입력 | 축 퍼센트 | 유형 |
  |------|-----------|------|
  | 전부 "매우 그렇다"(4점) | 각 축 **75%** | `111` 태풍형 |
  | 전부 "전혀 아니다"(0점) | 각 축 25% | `000` 올빼미형 |
  | 전부 "보통이다"(2점) | 각 축 50% | `000` 올빼미형 |

  ⚠️ **전부 최고점이라고 100%가 나오지 않는다.** 축마다 역채점 문항이 1개 있어 그 문항만 `4-4=0`점이 되므로
  `(4+4+4+0)/16 = 75%`다. 75 ≥ `AXIS_HIGH_THRESHOLD`(60)이라 유형은 `111`이 맞다.
  이걸 모르면 정상 동작을 "채점이 깨졌다"고 오판한다 — **역채점 설계(`docs/DECISIONS.md` D-3)의 직접적 결과다.**

---

## 브라우저 · 배포 오류

### E-5. `pages-serving` — 배포는 성공인데 사이트가 안 뜨거나 하위 경로가 404
코드가 멀쩡한데 안 되면 **빌드 환경·파일명·라우팅 설정을 먼저 본다.**

| 원인 | 증상 |
|------|------|
| 루트에 `index.html`이 없음 (파일명이 다름) | `/`가 아예 안 뜸 |
| `_redirects` 누락/오타 | `/`는 되는데 `/test/adhd` 직접 접속이 404 (앱 내 이동은 정상) |
| `<script src>` 경로가 실제 파일명과 불일치 | 흰 화면 + 콘솔 404 |

- **실측**: 초기 배포 실패의 원인은 코드가 아니라 **파일명**이었다. 진입 파일이 비표준 이름이라 Pages가 `/`를 서빙하지 못했다.
- **확인 방법**: `ls index.html _redirects && cat _redirects` → `/*  /index.html  200`
- **`_redirects`는 SPA의 생명선이다.** 라우팅을 건드리는 커밋에서 이 파일을 함께 확인한다.

### E-9. `local-server-no-fallback` — 로컬에서만 라우팅이 깨져 보인다
`python3 -m http.server`에는 SPA 폴백이 없다. 프로덕션은 `_redirects`로 모든 경로에 `index.html`을 주지만
로컬 기본 서버는 **실제 파일이 없는 경로를 전부 404**로 돌려준다.

- **증상**: `/`는 되는데 `/test/adhd`·`/test/adhd/result/typhoon` 직접 접속과 새로고침이 404. 앱 내부 이동은 정상.
- **오판 위험**: 이 상태로 검증하면 **멀쩡한 라우팅을 "깨졌다"고 판단**하고, 있지도 않은 버그를 고치려 든다.
  반대로 진짜 `_redirects` 문제와 구분도 안 된다.
- **해결**: 로컬은 `python3 serve.py <포트>`를 쓴다 (`_redirects`와 동일한 폴백 구현).
- **일반 원칙**: "개발 서버에서 안 된다"와 "프로덕션에서 안 된다"는 **다른 버그**다. 어느 쪽인지부터 확정한다.
- **실측**: 이 항목 자체가 검증 스크립트를 처음 돌렸을 때 나왔다. 공유 URL·결과 경로 직접 접속 2건이 FAIL로 떴는데
  원인은 앱이 아니라 테스트용 서버였다.

### E-6. `modern-css` — 특정 브라우저에서만 레이아웃이 깨진다
빌드·폴리필이 없으므로 **작성한 CSS가 그대로 사용자 브라우저에 간다.** 최신 셀렉터를 쓰면 구형 브라우저에서 규칙 전체가 무시된다.

- **실측**: `:has()`로 하단 네비게이션 여백을 주다가 Safari <15.4 / Firefox <103에서 여백이 사라져 콘텐츠가 가려졌다.
  → `render()`에서 `app.classList.toggle("has-bottom-nav", ...)`로 교체 (`docs/DECISIONS.md` D-11)
- **규칙**: 상태에 따른 조건부 스타일은 **CSS 셀렉터로 추론하지 말고 JS가 클래스를 붙인다.** 셀렉터 지원 여부에 의존하지 않게 된다.

### E-7. `mockup-leftover` — 목업 잔재가 실기기에서 중복/공백으로 보인다
`docs/design-draft.html`은 데스크톱에서 나란히 보는 목업이라, 앱에는 필요 없는 요소가 들어 있다.

- **실측 1**: 가짜 `9:41` 상태바 행이 그대로 남아 실기기에서 **진짜 상태바와 이중으로** 보였다.
- **실측 2**: 하단 네비게이션이 `min-height:100vh` + `margin-auto`에 기대고 있어, 실제 폰 뷰포트에서 **아래에 큰 빈 공간**이 생겼다. → `position:fixed` + 컨테이너 하단 패딩으로 교체.
- **규칙**: 목업에서 마크업을 옮길 때는 **① 기기 크롬을 흉내 낸 요소 ② 뷰포트 높이 가정**을 먼저 걷어낸다. 데스크톱 브라우저 창에서는 둘 다 정상으로 보인다 — **반드시 모바일 뷰포트에서 확인.**

### E-10. `spa-third-party-script` — 광고 슬롯 자리는 있는데 광고가 안 나온다
카카오 AdFit 로더(`ba.min.js`)는 **자기가 실행되는 순간 문서에 있던 `<ins class="kakao_ad_area">`만 훑고 끝난다.**
이 앱은 화면을 바꿀 때마다 `app.innerHTML`을 통째로 갈아끼우므로, `index.html`에 로더를 한 번 심는 방식은 통하지 않는다.

- **실측**: AdFit 승인이 났는데 홈에 광고가 안 나온다는 제보. 슬롯 마크업(`<ins>`)은 전부 정상이었고,
  `index.html` 헤드의 `async` 로더가 **비어 있는 `#app`을 훑고 끝난 것**이 원인이었다.
  운 좋게 첫 화면을 잡더라도 그 다음 화면 이동에서 새로 생긴 `<ins>`는 아무도 처리하지 않는다.
- **왜 늦게 발견되나**: 콘솔 에러가 없다. 슬롯 자리는 그려지므로 "광고가 아직 안 팔린 것"과 구분이 안 된다.
- **해결**: `js/core/ads.js`의 `refreshAds()`가 `index.html`에 있는 로더 `<script>` 태그를 그대로 두지 않고
  **새 `<script>` 엘리먼트로 통째로 갈아끼운다**(`replaceWith`) — `router.js`의 `render()`가 화면을 그린 뒤 그 화면에
  `.kakao_ad_area`가 하나라도 있으면 호출한다. 새로 삽입된 스크립트가 다시 실행되면서 **그 시점의 DOM을 처음부터
  재스캔**하므로, 화면 전환으로 새로 생긴 `<ins>`까지 다 잡힌다. `index.html`의 로더 `<script>` 태그 자체는
  지우면 안 된다 — `refreshAds()`가 갈아끼울 대상(`document.querySelector('script[src*="ba.min.js"]')`)이 없어지면
  아무 것도 하지 않고 조용히 리턴한다.
  (첫 시도는 `<ins>`마다 로더를 하나씩 새로 붙이는 `mountAds()`였는데, 병렬 세션에서 이 "태그 전체 재실행" 방식으로
  대체됐다 — 스크립트 태그가 화면마다 쌓이지 않고 항상 하나만 유지된다는 점에서 더 낫다.)
- **일반 원칙**: **"페이지 로드 시 1회 스캔"으로 동작하는 서드파티 스크립트는 전부 이 SPA와 충돌한다.**
  새로 붙일 때는 "화면 전환 후에도 다시 붙는가"를 먼저 묻는다.
- **검증**: `scripts/verify.cjs`의 "광고 슬롯마다 로더 스크립트가 존재" · "SPA 이동 후 로더가 재실행됨(태그가 교체됨)" 2건이 막는다.

### E-11. `duplicate-ad-unit` — 화면에 배너가 2개인데 하나만 채워진다
같은 광고 단위(unit) 코드를 **한 페이지에서 두 번** 쓰면, AdFit(다른 광고 네트워크도 대개 마찬가지)은 그걸
하나의 실물 지면(placement)으로 보고 **뒤쪽 인스턴스를 채우지 않는다.** 슬롯 DOM은 둘 다 정상이고 로더도
정상 실행되므로, E-10처럼 "코드가 막고 있다"는 신호가 전혀 없다 — 그냥 한쪽만 조용히 비어 보인다.

- **실측**: 화면당 배너를 1개(상단만) → 2개(상단+하단)로 늘리면서, 두 슬롯 모두
  `js/core/ads.js`의 `AD_UNITS.banner`(단일 코드)를 그대로 재사용했다. 배포 후 "상단에 하나밖에 안 뜬다"는
  리포트로 발견 — 콘솔 에러도 없고 두 슬롯 다 로더는 정상 실행되고 있어서(E-10과 증상이 겹쳐 보임) 원인을
  좁히는 데 시간이 걸렸다.
- **해결**: 위치별로 서로 다른 단위 코드를 쓴다. `AD_UNITS`에 `bannerTop`/`bannerBottom`처럼 **코드가 다른
  키**를 따로 두고, 마크업/CSS가 참조하는 시각적 종류(`cssClass`)는 그대로 `"banner"`로 둬서 `.ad-slot.banner`
  스타일 규칙은 재사용한다 — `adSlotMarkup(kind, style)`이 `AD_UNITS[kind]`에서 `{ unit, width, height, cssClass }`를
  읽어 `<div class="ad-slot ${cssClass}">`를 만드는 구조라, 새 위치를 추가해도 CSS를 중복 정의할 필요가 없다.
- **일반 원칙**: **한 화면(페이지)에 같은 크기의 광고를 두 개 이상 넣을 때는 반드시 서로 다른 단위 코드를 쓴다.**
  AdFit 관리자 페이지에서 같은 크기로 광고 단위를 새로 하나 더 만들면 된다 — 코드 쪽에서 "복제"로 흉내 낼 수 없다.

### E-12. `oauth-redirect-not-allowlisted` — Supabase 로그에는 로그인 성공인데 앱은 로그인 안 된 것처럼 보인다
`signInWithOAuth`가 이 사이트(`fun.data-pantry.com`)에서 시작해 Google 계정 선택까지 정상 진행되고,
Supabase 대시보드/`get_logs`(`auth` 서비스)에도 `Login` 이벤트가 실제 계정으로 성공(`status: 302`, 에러 없음)
기록되는데, 정작 브라우저는 로그인 상태를 못 받는 증상(D-71에서 발견).

- **원인**: `signInWithOAuth`의 `redirectTo`(예: `${location.origin}/`)가 Supabase 프로젝트의
  **Authentication → URL Configuration → Redirect URLs 허용 목록**에 없으면, GoTrue는 에러를 내지 않고
  로그인 자체는 그대로 처리한 뒤 **최종 리다이렉트만 등록된 Site URL로 조용히 바꿔치기**한다. 이 레포는
  data-pantry.com과 같은 Supabase 프로젝트를 재사용하는데, Site URL이 원래 `data-pantry.com`으로 등록돼
  있으면 `fun.data-pantry.com`에서 로그인해도 세션이 `data-pantry.com` 쪽 origin의 localStorage에 실려서
  이 사이트는 영원히 로그인 안 된 것처럼 보인다.
- **왜 늦게 발견됐나**: 이 실패는 클라이언트 콘솔에도, `npm test`/`scripts/verify.cjs`에도 안 잡힌다 —
  헤드리스 검증은 처음부터 OAuth 리다이렉트를 재현하지 못해 `localStorage`를 직접 채워 로그인 상태를
  흉내내는 우회로만 써왔다(D-55·D-56·D-58 공통 한계). 실기기로 "진짜 버튼 클릭 → 계정 선택 → 결과"
  전체 왕복을 확인해야만 드러난다 — D-56 도입 당시 이미 "확인 필요"로 남겨뒀던 항목이 실제로 여기서 터졌다.
- **진단법**: 클라이언트 쪽 증상(버튼 무반응 등, D-58)과 구분하려면 Supabase MCP의
  `get_logs(service: "auth")`로 해당 시각의 로그인 이벤트가 실제 성공했는지부터 본다. 성공 기록이 있는데
  앱만 로그인 안 된 상태라면 클라이언트 버그가 아니라 리다이렉트 허용 목록 문제일 가능성이 크다.
- **해결**: Supabase 대시보드에서 실제 서비스하는 도메인(`https://fun.data-pantry.com/`, 필요하면
  와일드카드 `https://fun.data-pantry.com/**`)을 Redirect URLs에 추가한다 — 대시보드 전용 설정이라
  이 저장소의 코드나 MCP 도구로는 고칠 수 없다.
- **검증**: 자동화된 검사는 아직 없다(다른 unit 코드를 쓰는지는 실제 AdFit 계정 없이는 재현이 안 된다).

### E-13. `router-strips-oauth-hash` — Redirect URLs를 고쳐도 여전히 로그인이 안 된다
E-12를 고친 뒤에도(Redirect URLs 허용 목록에 정확한 도메인을 추가한 뒤에도) 로그인이 그대로 안
되는 증상(D-75에서 발견). E-12와 증상이 같아 보이지만 원인은 완전히 다르다 — 둘 다 확인해야 한다.

- **원인**: `js/core/cloud-auth.js`의 `createClient()`가 `flowType`을 지정하지 않아 supabase-js
  기본값 `implicit` 플로우를 쓴다 — OAuth 토큰이 `?code=`가 아니라 `#access_token=...` **URL 해시**로
  돌아온다. 이 클라이언트는 CDN 실패 격리를 위해 동적 import로만 연결되는데, `js/main.js`는 그 import를
  시작만 시켜두고 곧바로 동기로 `router.js`의 `start()` → `setScreen(..., {replace:true})`를 호출한다.
  그 안의 `history.replaceState(state, "", path)`가 `location.search`만 이어 붙이고 `location.hash`를
  빼먹은 채 URL을 즉시 덮어써서, 동적 import가 끝나 Supabase 클라이언트가 `detectSessionInUrl`로
  해시를 읽으려 할 때는 이미 토큰이 사라진 뒤다.
- **진단법**: E-12와 마찬가지로 서버 로그인은 성공(`get_logs`)하는데 브라우저만 로그인이 안 된
  것처럼 보인다 — 다만 Redirect URLs를 이미 고쳤는데도 재현되면 이쪽을 의심한다. 로그인 버튼을 누른
  직후(리다이렉트 완료 시점) 주소창에 `#access_token=`이 잠깐이라도 보였는지, 새로고침 없이 바로
  사라졌는지를 확인하면 구분된다.
- **해결**: `router.js`의 `setScreen()`이 부팅/popstate 시 쓰는 `replaceState` 호출에서 `location.hash`를
  보존한다(`path + location.hash`). 평상시엔 해시가 비어 있어 동작이 그대로다.
- **검증**: `#access_token=...`을 실은 주소로 직접 접속해 부팅 후에도 `location.hash`가 남아 있는지
  Playwright로 확인(`npm test`/`scripts/verify.cjs`는 실제 OAuth 리다이렉트를 재현 못 해 못 잡는다,
  E-12와 같은 한계).
  대신 `.ad-slot.banner ins`의 `data-ad-unit` 값이 같은 화면 안에서 서로 달라야 한다는 걸 코드 리뷰 시 확인한다 —
  `grep -n 'adSlotMarkup("banner' js/` 결과에 `"banner"`(위치 구분 없는 옛 이름)가 남아있으면 회귀다.

### E-14. `implicit-flow-hash-fragile` — E-13을 고치고 배포해도 실기기에서 여전히 로그인이 안 될 수 있다
E-13(해시 보존)을 고쳐 배포한 뒤에도, 실기기 재현 시 로그인이 안 되는 사례가 있었다(D-76). 서버 로그(`get_logs`)엔
로그인이 성공으로 찍히고 주소창도 정확히 `fun.data-pantry.com`으로 돌아오는데도(E-12는 배제됨) 로그인 상태가 안 뜬다.

- **원인**: implicit 플로우 자체가 토큰을 URL 해시 하나에 전부 실어 나르는 구조라서, `router.js`가 해시를 보존해도
  그 사이 어딘가(리다이렉트 체인을 여러 번 타는 구간, 카카오톡 인앱 브라우저 같은 커스텀 웹뷰 등)에서 해시가
  통째로 사라지면 무엇을 고쳐도 못 막는다 — 코드로 재현·확정은 못 했지만, 해시는 그 자체로 살아남는다는
  보장이 약한 값이다.
- **해결**: `createClient()`에 `auth: { flowType: "pkce" }`를 지정해 애초에 해시를 안 쓰게 한다. PKCE는 토큰 대신
  코드를 `?code=`(location.search)로 돌려주는데, 이 값은 `router.js`의 모든 `replaceState`가 E-13 이전부터도
  이미 무조건 보존하던 값이라(`def.path + location.search`) 훨씬 안전하다.
- **검증**: `npm test` 141/141 무영향(순수 JS 정합성만 봄, 플로우 자체는 범위 밖). 실제 OAuth 왕복은 이번에도
  샌드박스에서 재현 불가(E-12·E-13과 같은 한계) — **배포 후 확인 필요**로 남긴다.

**후속(같은 세션, E-11)**: 로더가 붙어도 **자리(geometry)가 안 맞으면** 여전히 문제다. Playwright로 뷰포트별 `.ad-slot` 실폭을
직접 재보니 320px 폭 기기에서 배너(320px 고정폭)가 좌우 여백(20px×2 = 40px) 때문에 슬롯 안에 다 안 들어가
`overflow:hidden`에 잘렸다. `.ad-slot.banner`에 `margin-left/right: min(20px, calc((100% - 320px) / 2))`를 줘서
360px 이상에서는 원래 20px, 그 아래로는 광고 폭에 맞춰 자동으로 줄어들게 했다 — 미디어쿼리 없이 `min()` 하나로 해결.
**함정**: 이 여백은 화면마다 `adSlotMarkup(kind, style)`의 `style` 인자로 `margin: 6px 20px 22px;`처럼 **좌우까지 포함한
shorthand**로 인라인 지정돼 있었다. 인라인 스타일은 클래스 규칙보다 항상 이기므로, 클래스에서 아무리 `margin-left`를
고쳐도 인라인이 덮어썼다 — 호출부를 `margin-top:6px; margin-bottom:22px;`처럼 **세로만** 지정하도록 바꾸고 나서야
클래스의 좌우 규칙이 먹었다. 인라인 스타일로 여백을 주는 다른 곳을 고칠 때도 이 우선순위를 먼저 확인할 것.
  샌드박스는 `t1.daumcdn.net`이 막혀 **실제 노출은 확인할 수 없다** — DOM에 스크립트가 붙었는지까지만 본다.

---

## AI 반복 실수

### A-1. "`npm test` 통과"를 검증 완료라고 보고하는 것
`npm test`는 **채점 로직과 모듈 정합성만** 본다. 브라우저를 띄우지 않으므로 이벤트 바인딩·라우팅·타이머·레이아웃은 하나도 못 잡는다.
E-2·E-4·E-6·E-7이 전부 여기를 통과하는 버그였다. 빌드가 없어 "빌드 통과"라는 신호조차 없다는 점도 잊기 쉽다.

- **규칙**: `npm test` **와** `scripts/verify.cjs`를 둘 다 돌린다(실행법은 `CLAUDE.md` 커맨드 표). 새 화면·새 채점 규칙을 추가했으면 케이스도 함께 추가한다.
  재현하지 못한 항목은 **"확인하지 못했다"고 명시하고 `CURRENT_TASK.md`의 "배포 후 확인 필요"로 옮긴다.** 침묵은 "확인됨"으로 오독된다.
- **샌드박스 한계**: 아웃바운드가 프록시로 막혀 CDN(폰트·광고)이 로드되지 않는다.
  → 폰트 적용 상태의 결과 카드 렌더링, `navigator.share` 네이티브 공유시트, 광고 노출은 **여기서 확인할 수 없다.** 배포 후 확인 항목이다.

### A-2. 화면 문구의 숫자를 손으로 맞추기
E-1과 같은 뿌리. 숫자를 고치는 게 아니라 **하드코딩을 없앤다.** 같은 값이 두 곳 이상에 나타나면 그 자체가 리팩터링 신호다.

### A-4. `wc -m`으로 한글 문서 크기를 재고 예산을 오판하기
로케일이 C/POSIX면 `wc -m`은 **문자가 아니라 바이트**를 센다. UTF-8 한글은 1자 = 3바이트라 **크기가 2~3배로 부풀려 보인다.**

- **실측**: `CLAUDE.md`가 `wc -m` 기준 6,597로 나와 "예산 초과"로 판단했는데, 실제 문자 수는 4,113(한글 1,186)이었다. 추정 토큰은 약 3,000으로 상한의 절반이었다.
- **위험**: 멀쩡한 문서를 예산 때문에 깎게 된다. 반대로 영문 위주 문서에서는 차이가 없어 **한글 문서에서만 틀린다.**
- **확인 방법**:
  ```bash
  python3 -c "import re,sys;s=open(sys.argv[1]).read();h=len(re.findall(r'[가-힣]',s));print(f'{len(s)}자 (한글 {h}) → 약 {h*1.8+(len(s)-h)*0.3:.0f} 토큰')" CLAUDE.md
  ```
  (한글 ≈1.8토큰/자, ASCII·코드·경로 ≈0.3토큰/자)

### A-3. 이미 되돌린 접근을 다시 제안하기
`docs/DECISIONS.md`의 **되돌림** 항목(D-5 속도 기반 충동 점수, D-7 페이지 자체 주소 공유, D-10 ADHD 명칭 제거)은 전부 한 번 시도했다가 되돌린 것이다.
새 접근을 제안하기 전에 그 문서의 인덱스를 먼저 확인한다.
