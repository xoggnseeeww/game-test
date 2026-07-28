# 현재 작업 상태
> 항상 자동 로드. 세션 종료마다 갱신. 상세 이력은 `PROGRESS.md`.
> 이 파일은 1~2k 토큰 이하를 유지한다 — "언젠가 할 일"이 아니라 "지금 유효한 작업"만.

## 현재 작업
없음 (AdFit 광고가 안 나오던 문제 수정, 2026-07-28)

- **AdFit 광고 미노출 수정**: 승인은 났는데 홈에 광고가 안 나온다는 제보. 슬롯 마크업은 정상이었고,
  `index.html`에 로더(`ba.min.js`)를 한 번 심어둔 것이 원인이었다 — AdFit 로더는 **실행되는 순간의 문서만 훑는다.**
  화면마다 `app.innerHTML`을 갈아끼우는 SPA라 로더가 빈 `#app`을 훑고 끝났다.
  → `js/core/ads.js`에 `mountAds(root)` 추가(아직 로더가 안 붙은 `<ins>` 뒤에 `<script>`를 DOM API로 주입),
  `js/core/router.js`의 `render()` 끝에서 호출. `index.html`의 로더는 preconnect로 교체.
  `.ad-slot`의 점선 테두리(플레이스홀더 잔재)도 제거 — 실제 광고 둘레에 남아 있었다.
  `scripts/verify.cjs`에 회귀 검사 2건 추가(홈 · SPA 이동 후). → `docs/ERRORS.md` E-10
- **광고 사이즈·배치 재점검** (같은 세션 후속): Playwright로 뷰포트별 슬롯 실폭을 직접 재서 두 가지를 발견·수정.
  ① 320px 폭 기기(구형 아이폰 SE 1세대 등)에서 배너(320px)가 좌우 여백(20px×2) 때문에 슬롯 안에 40px이 부족해
  `overflow:hidden`에 잘릴 수 있었다 → `.ad-slot.banner`에 `margin-left/right: min(20px, calc((100% - 320px) / 2))`
  추가, 세로 여백은 각 화면이 인라인(`margin-top`/`margin-bottom`만)으로 계속 지정. 360px 이상에서는 원래와 동일(20px).
  ② ADHD 공유 결과 화면(`renderTestShared`, `/test/adhd/result/<슬러그>`)에만 광고가 아예 없었다 — DISC 공유
  결과 화면과 비대칭. CTA 버튼 아래에 banner 슬롯 추가로 통일. → `docs/ERRORS.md` E-10에 실측 표 추가

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
- **광고 슬롯** — 로더 주입까지 고쳤고 "슬롯마다 `<script>`가 붙는가"는 `scripts/verify.cjs`가 확인한다.
  다만 샌드박스는 `t1.daumcdn.net`이 막혀 **실제 광고가 그려지는지는 확인하지 못했다.** 배포 후 실기기 확인 필요.
  배포 후에도 안 나오면 다음 순서로 본다: ① 슬롯 `<ins>` 뒤에 `ba.min.js` `<script>`가 있는가(DevTools Elements)
  ② 그 스크립트가 200인가(Network) ③ 둘 다 정상이면 코드가 아니라 **AdFit 쪽 노출 유예/미충족**이다(승인 직후 몇 시간~1일, 트래픽 부족 시 미충족)

## 알려진 이슈
| 이슈 | 영향 | 우선순위 |
|------|------|----------|
| 페이지별 OG 메타·`og:image` 없음 | 중 — 공유 미리보기가 전부 동일, 썸네일 없음. 테스트가 둘이 되며 체감 커짐 | 중 |
| `THEME_CLASSES`의 `theme-adhd`에 대응하는 CSS 블록이 없음 | 낮음 — 아무 화면도 `theme: "adhd"`를 쓰지 않아 무해. 쓰려면 `styles.css`에 변수 블록부터 | 하 |
| 헤더 ☰ 버튼이 동작 없음 | 낮음 — 고장으로 보임 | 하 |
| 진행 중 새로고침하면 답변 소실 (`state`가 메모리 전용) | 낮음 | 하 |

## 보류 (차단됨)
- 없음

## 백로그
(3개월 이상 미처리 항목은 삭제하거나 `docs/IDEAS.md`로 이동)
- 기억력 미니게임 추가 (홈 문구가 이미 예고 중)
- 공유 시 결과 이미지 자동 첨부 (현재는 다운로드 후 수동)
