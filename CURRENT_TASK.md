# 현재 작업 상태
> 항상 자동 로드. 세션 종료마다 갱신. 상세 이력은 `PROGRESS.md`.
> 이 파일은 1~2k 토큰 이하를 유지한다 — "언젠가 할 일"이 아니라 "지금 유효한 작업"만.

## 현재 작업
없음 (게임 종료 → 결과 사이 광고 게이트 화면 추가 + 딜레마 게임 4택 재설계·데이터팬트리 연동·AdFit SPA 재스캔 수정을 메인과 머지, 2026-07-28)

- **광고 게이트(전면형) 화면 추가**: 수익화 확대 요청에 따라, 반응속도 게임/딜레마 게임이 끝나고
  결과로 넘어가기 직전에 광고 화면을 하나 끼워 넣었다. AdFit 웹 SDK엔 앱처럼 몇 초 후 자동 전환되는
  진짜 전면 인터스티셜 포맷이 없어서, 새 광고 단위(`interstitial`, 300×250, `DAN-tmLP8h8cur4SzSpG`)를
  화면 하나로 채우고 3초 카운트다운 뒤 "결과 보러 가기" 버튼이 활성화되는 방식으로 대신했다.
  → `js/core/ads.js`에 `adGateMarkup()` 추가, `js/core/dom.js`에 `bindAdGate()` 추가(카운트다운 타이머는
  `onLeave`로 정리). 새 화면 `reaction-ad`(`/test/adhd/reaction/ad`)·`dilemma-ad`
  (`/test/disc/dilemma/ad`)를 각 테스트 `index.js`에 등록하고, 게임의 `finish()`가 결과로 직행하던 걸
  이 화면을 거치도록 바꿨다. **`.exit-btn`(홈)은 카운트다운과 무관하게 항상 즉시 동작** — 트래픽이
  빠지지 않는 선에서 노출만 하나 늘리는 게 목적이라 강제로 가두지 않는다.
  `scripts/verify.cjs`에 회귀 검사 4건 추가(게이트 경유 확인 2건 + 게임 미완료 시 인트로 폴백 2건).
  → `docs/architecture.md` 화면 표·흐름 설명 갱신, `docs/DECISIONS.md` D-25.

- **AdFit 광고 미노출 진단·1차 수정** (이 세션에서 시작, 최종 수정은 아래 병렬 세션 것으로 대체됨): 승인은 났는데
  홈에 광고가 안 나온다는 제보를 진단 — AdFit 로더(`ba.min.js`)는 **실행되는 순간의 문서만 훑는다.** 화면마다
  `app.innerHTML`을 갈아끼우는 SPA라 로더가 빈 `#app`을 훑고 끝난 게 근본 원인이었다(이 진단 자체는 맞았다).
  1차로 `<ins>`마다 로더 `<script>`를 하나씩 새로 붙이는 `mountAds()`로 고쳤는데, 머지 시점에 병렬 세션이
  더 나은 방식(`refreshAds()` — 아래 항목)으로 같은 버그를 이미 고쳐서 그쪽을 채택하고 `mountAds()`는 뺐다.
  `.ad-slot`의 점선 테두리(플레이스홀더 잔재)는 이 세션에서도 별도로 제거했다(병렬 세션의 PR #1과 동시에 나온
  중복 수정 — 내용은 같아서 머지 시 자연스럽게 합쳐짐).
- **광고 사이즈·배치 재점검** (같은 세션 후속): Playwright로 뷰포트별 슬롯 실폭을 직접 재서 두 가지를 발견·수정.
  ① 320px 폭 기기(구형 아이폰 SE 1세대 등)에서 배너(320px)가 좌우 여백(20px×2) 때문에 슬롯 안에 40px이 부족해
  `overflow:hidden`에 잘릴 수 있었다 → `.ad-slot.banner`에 `margin-left/right: min(20px, calc((100% - 320px) / 2))`
  추가, 세로 여백은 각 화면이 인라인(`margin-top`/`margin-bottom`만)으로 계속 지정. 360px 이상에서는 원래와 동일(20px).
  이 여백 공식은 `.ad-slot.interstitial`(300px)에도 그대로 적용돼 있다.
  ② ADHD 공유 결과 화면(`renderTestShared`, `/test/adhd/result/<슬러그>`)에만 광고가 아예 없었다 — DISC 공유
  결과 화면과 비대칭. CTA 버튼 아래에 banner 슬롯 추가로 통일. → `docs/ERRORS.md` E-10에 실측 표 추가

- **AdFit SPA 재스캔 버그 수정** (병렬 세션 작업, 메인에서 머지 — 최종 채택된 수정): 위 진단과 같은 버그를
  다른 세션이 별도로 고쳤다. `js/core/ads.js`의 `refreshAds()`가 `index.html`의 로더 `<script>` 태그 자체를
  통째로 갈아끼워(`replaceWith`) 재실행시킨다 — `router.js`의 `render()`가 새로 그린 화면에 `.kakao_ad_area`가
  있으면 호출한다. `mountAds()`(슬롯마다 로더를 새로 붙이는 방식)보다 스크립트 태그가 화면마다 쌓이지 않고
  항상 하나만 유지된다는 점에서 더 낫다고 판단해 이 방식을 채택했다 — **`index.html`의 원래 로더 `<script>`
  태그는 지우면 안 된다**, `refreshAds()`가 갈아끼울 대상 자체가 없어진다(이 세션이 1차 수정에서 그 태그를
  preconnect로 바꿨던 걸 다시 원복함). → `docs/ERRORS.md` E-10 갱신.
- **딜레마 게임 4택(D/I/S/C) 재설계** (병렬 세션 작업, 메인에서 머지): 2택(과업/사람)+응답속도 추론 방식을 주 문항과 동일한 4택 단일 선택으로 교체.
  `dilemma-play` 화면도 새 `.progress-row`(진행바+홈 버튼) 구조로 병합했다. → `docs/DECISIONS.md` D-24.
  광고 게이트는 이 새 `dilemma-play`의 `finish()` 위에 다시 얹었다 — `state.disc.dilemma = picks` 직후 결과 대신
  `dilemma-ad`로 이동.
- **데이터팬트리 연동** (병렬 세션 작업, 메인에서 머지): 데이터팬트리(`data-pantry-web-site`) 헤더에 커뮤니티↔요금제 사이 FUN 버튼을 추가해
  `fun.data-pantry.com`(이 사이트)로 연결. 이 저장소 쪽은 그동안 없던 `og:image`/파비콘을 새로 만들어 채움:
  - `assets/og-image.png`(1200×630, Playwright로 생성) + `assets/favicon.svg` + `assets/apple-touch-icon.png`
  - `index.html`에 `og:image`·`og:image:width/height`·`twitter:image`(카드 타입 `summary_large_image`로 변경)·파비콘 링크 추가
  - `renderHome()`(`js/screens/home.js`) 하단에 `data-pantry.com`으로 가는 `site-footer` 링크 추가 (`styles.css` 클래스 동반)
  - 이 사이트는 데이터팬트리와 별도 배포·별도 저장소로 운영되며, 영속 데이터·백엔드는 여전히 없음 — 순수 정적 자산만 추가함

- **PC 레이아웃 v2 (카드 넓히기)**: 1차로 480px 그대로 두고 카드 프레임(그림자·둥근 모서리)만 얹었더니
  사용자가 "여전히 폰 화면 보는 느낌"이라고 피드백. `@media (min-width: 768px)`에서 `#app { max-width: 640px; }`로
  카드 자체를 넓혔다 — 문항·결과·게임 화면 구조는 그대로, 콘텐츠 폭만 커짐. → `docs/DECISIONS.md` D-21
- **전 화면 우상단 홈 버튼**: 진행 중 화면(문항·게임)에만 있던 `.exit-btn`을 인트로·결과 화면까지 확장.
  잃을 진행 상황이 없는 화면은 `data-nav="home"`으로 바로 이동, 진행 중 화면은 기존 `bindExit()` 확인 모달 유지.
  아이콘도 ✕ → 🏠로 통일. `test-result`/`disc-result`는 원래 헤더가 아예 없어서 홈 버튼만 든 `.back-row`를 새로 얹었다.
  → `docs/DECISIONS.md` D-22
- **홈 하단 네비게이션 제거**: 장식만 하던 인기·저장·내정보 탭을 완전히 삭제(`js/screens/home.js`,
  `styles.css`의 `.bottom-nav`/`#app.has-bottom-nav`, `js/core/router.js`의 토글 로직, `scripts/verify.cjs`의
  관련 검사까지 전부 정리). → `docs/DECISIONS.md` D-23
- **테스트 진행 중 홈 나가기**: 문항 수만큼 뒤로가기를 눌러야 홈에 갈 수 있던 문제. `js/core/dom.js`에
  `bindExit(root, onExit)` 추가 — `.exit-btn`(🏠) 클릭 시 확인 모달 → 확인하면 상태 초기화 후 `go("home")`.
  적용 화면: ADHD `test-question`·`reaction-intro`·`reaction-play`, DISC `disc-question`·`dilemma-intro`·`dilemma-play`.
- (병렬 세션 작업) **카카오 AdFit 실연동**: `js/core/ads.js`(단위 코드 단일 소스, `adSlotMarkup(kind, style)`) 추가,
  `index.html`에 로더 스크립트, `.ad-slot` 플레이스홀더 7곳을 실제 `<ins class="kakao_ad_area">`로 교체.
  배너 `DAN-YtXY1keVu0glLXJQ`(320×50) · 사각 `DAN-PKr3oCfRI9IIiXwz`(250×250). `.ad-slot.rect` 높이도
  120px(플레이스홀더 시절 값)에서 실제 250px로 수정.
- (이전 세션 작업) 딜레마 게임을 DISC 문항 뒤 강제 단계로, 반응속도 게임을 ADHD 문항 뒤 필수 단계로 각각 재배치 +
  UI 대비/줄바꿈 정리 + 반응속도 게임 시작 전 확인 모달 추가 완료

## 다음 작업 우선순위
1. **미니게임 목록이 비어 있음** — `/game`이 "준비 중" 빈 화면인데, 딜레마 게임은 이미 동작한다.
   딜레마 게임을 `/game` 목록에 노출하거나 홈 문구를 조정 / 관련 파일: `js/screens/home.js` `renderGameList()`
   ※ 게임은 테스트 하위 경로에 속해 있다(`docs/DECISIONS.md` D-4). 목록에 넣더라도 경로는 바꾸지 않는다 — id·경로 변경 금지(D-16)
   ⚠️ **반응속도 게임은 여기 넣지 않는다** — 이제 ADHD 문항을 다 풀어야만 들어갈 수 있는 필수 단계라(D-19),
   미니게임 목록에서 단독으로 열도록 노출하면 guard가 사용자를 ADHD 인트로로 되돌려버려 혼란만 준다.

## 배포 후 확인 필요
> 샌드박스는 아웃바운드가 프록시로 막혀 아래를 **확인하지 못했다.** "확인됨"으로 간주하지 말 것.

- **결과 카드 폰트** — CDN 차단으로 결과 카드가 sans-serif 폴백으로만 그려졌다
- **`navigator.share` 공유시트** — 헤드리스엔 API가 없어 클립보드 폴백 경로만 확인됨. 실기기 확인 필요
- **`_redirects` 실동작** — 로컬은 `serve.py`로 흉내 낸 것. 배포본에서 `/test/disc/result/lion` 직접 접속이 200인지 확인
- **광고 슬롯(배너·rect·interstitial)** — 코드 연동 + SPA 재스캔 버그 수정(`refreshAds()`) 완료. 로더 태그가
  화면 전환마다 실제로 갈아끼워지는지는 `scripts/verify.cjs`가 확인하지만, 샌드박스는 `t1.daumcdn.net`이 막혀
  **실제 광고가 그려지는지는 확인하지 못했다.** 배포 후 실기기 확인 필요 — 특히 홈→테스트 화면 등 여러 번
  이동하며 매번 광고가 뜨는지, 광고 게이트(`reaction-ad`/`dilemma-ad`)의 300×250도 포함해서.
  안 나오면 다음 순서로 본다: ① 로더 `<script>`가 화면 전환마다 새 엘리먼트로 갈아끼워지는가(DevTools Elements)
  ② 그 요청이 200인가(Network) ③ 둘 다 정상이면 코드가 아니라 **AdFit 쪽 노출 유예/미충족**이다(승인 직후 몇 시간~1일, 트래픽 부족 시 미충족)
- **OG 이미지 실제 미리보기** — 카카오톡/트위터/페이스북 디버거로 `https://fun.data-pantry.com/assets/og-image.png`가 실제로 불러와지는지, 카드가 `summary_large_image`로 정상 렌더되는지 배포 후 확인 필요 (샌드박스는 절대경로 이미지 요청을 외부에서 검증 못 함)
- **데이터팬트리 헤더 FUN 버튼** — `data-pantry-web-site` 저장소의 헤더에 새 링크를 추가했음. 두 사이트가 각각 배포된 뒤 실제로 FUN 버튼 → `fun.data-pantry.com` 이동이 되는지, 이 사이트 하단 `by 데이터팬트리` 링크 → `data-pantry.com` 이동이 되는지 상호 확인 필요

## 알려진 이슈
| 이슈 | 영향 | 우선순위 |
|------|------|----------|
| 페이지별(테스트별) OG 메타는 여전히 공통 | 낮음 — `og:image`는 2026-07-28에 채웠으나, 정적 SPA라 테스트별 미리보기 문구·썸네일 분기는 안 됨(결과 주소마다 정적 셸이 있어야 가능) | 하 |
| `THEME_CLASSES`의 `theme-adhd`에 대응하는 CSS 블록이 없음 | 낮음 — 아무 화면도 `theme: "adhd"`를 쓰지 않아 무해. 쓰려면 `styles.css`에 변수 블록부터 | 하 |
| 헤더 ☰ 버튼이 동작 없음 | 낮음 — 고장으로 보임 | 하 |
| 진행 중 새로고침하면 답변 소실 (`state`가 메모리 전용) | 낮음 | 하 |

## 보류 (차단됨)
- 없음

## 백로그
(3개월 이상 미처리 항목은 삭제하거나 `docs/IDEAS.md`로 이동)
- 기억력 미니게임 추가 (홈 문구가 이미 예고 중)
- 공유 시 결과 이미지 자동 첨부 (현재는 다운로드 후 수동)
