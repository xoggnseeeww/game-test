# architecture — 과몰입구역

> 선택 로드 문서. 모듈 구조·라우터 계약을 파악해야 할 때만 읽는다.
> ⚠️ **파일 크기 자동 분리 규칙**: 이 파일이 300줄(또는 15KB)을 넘으면, 이 문서를 수정하는 세션이 별도 지시 없이 즉시 분리한다 —
> 테스트별 상세는 `docs/<test-id>-architecture.md`로 떼고, 이 파일에는 모듈맵·라우터 계약·화면 표만 남긴다. 분리 후 `CLAUDE.md` 상세 문서 표에 행 추가.

## 인덱스
- 모듈맵 → §1
- 라우터 계약 (화면 디스크립터) → §2
- 화면 표 → §3
- 상태(state) 모양 → §4
- 테스트 추가 절차 → §5
- 채점 파이프라인 (ADHD / DISC) → §6
- 공유 · 결과 카드 → §7
- 테스트 스위트 → §8
- OG 미리보기 셸 (`og-shells/`) → §9

---

## 1. 모듈맵

브라우저 네이티브 ES 모듈. 번들러가 없으므로 **import 경로는 실제 파일 경로 그대로**이며 확장자 `.js`가 필수다.

```
js/main.js              부팅. registerScreens / registerTest / registerGame 호출 후 start()
js/core/
  router.js             화면 레지스트리 · 테스트/게임 레지스트리 · 경로 해석 · guard · teardown · 테마 · history · 렌더 후 refreshAds()
  state.js              단일 상태 객체 (테스트별·게임별 네임스페이스)
  dom.js                el() · bindNav() · showModal() · bindAdGate()(광고 게이트 카운트다운) ·
                        goHome()(전역 햄버거 메뉴의 "홈으로 가기" — router.js의 exitGuard를 봄)
  auth.js               일반 방문자 로그인(D-68) — cloud-auth.js의 공유 Supabase Auth(Google)를
                        그대로 쓴다. 로그인한 이메일을 currentEmail로 추적하고, isAdmin()이
                        ADMIN_EMAIL과 같은지만 별도로 판별한다(서버 검증 없음, "출시 예정" 게이트용).
                        localStorage(`gt_user_email`)에 이메일만 보관, isAdmin()/logout()/
                        renderSignInButton() 제공. onAuthChange()는 구독자가 여럿(header.js +
                        screens/home.js의 마이페이지)이라 Set 기반 pub-sub이다(D-70) — 단일
                        콜백 변수였다면 나중 구독이 먼저 것을 덮어썼다
  header.js             #app 밖(body)에 붙는 전역 우상단 햄버거 메뉴 — 로그인 상태 표시·로그인/로그아웃·
                        마이페이지 이동(D-70). 로그인 시 버튼 자체에 점 배지(`.logged-in`)를 남겨
                        메뉴를 열어보지 않아도 로그인 여부를 알 수 있다
  share.js              공유 URL · navigator.share · 결과 카드 캔버스
  util.js               shuffle · normalizePath · roundRect
  ads.js                카카오 AdFit — adSlotMarkup()(단위 코드 단일 소스) · adGateMarkup()(전면 게이트 마크업) · refreshAds()(로더 태그 재실행)
js/screens/home.js      홈(카테고리 3개: 심리테스트/미니게임/학습) · 심리테스트 목록 · 미니게임 목록 ·
                        학습 목록(등록된 학습 도구에서 자동 생성) · 개인정보처리방침 + commonScreens
js/tests/<id>/
  data.js               문항·결과 유형·슬러그·게임 상수 (단일 소스)
  score.js              채점 (DOM을 모른다 → node --test로 직접 검증 가능)
  screens.js            렌더 함수
  index.js              디스크립터: <id>Test(메타) + <id>Screens(화면 배열)
js/games/<id>/          테스트에 속하지 않는 독립 미니게임(예: numpath)
  data.js               레벨 커브 · 상수 (단일 소스)
  engine.js             순수 게임 로직 — 이동/Undo/클리어 판정 (DOM을 모른다)
  generate.js            역산(reverse engineering) 퍼즐 생성기 (DOM을 모른다)
  solve.js               DFS 솔버 — 해 개수 · 최적 이동수 (DOM을 모른다)
  audio.js               Web Audio 효과음 (외부 파일 없음)
  play.js                플레이 화면 — in-place 렌더 필요해서 screens.js와 분리
  screens.js            인트로 · 광고 게이트 · 결과 화면
  index.js               디스크립터: <id>Game(메타) + <id>Screens(화면 배열)
js/learning/<toolId>/   학습 카테고리 안의 독립 도구 1개 = 폴더 1개(예: basic-conversation,
                        elementary-conversation). tests/games와 같은 레지스트리 방식(D-63)
                        — 도구가 여럿이면 학습 목록(`/learning`)에 카드로 나열된다. 도구
                        내부는 챕터(목차) 여러 개로 이뤄질 수 있고, index.js가 챕터별 화면을
                        자동 생성한다. basic-conversation은 챕터 → 단계(D-73), elementary-
                        conversation은 학년 → 챕터 → 단계(D-77) — 학년 한 겹만 더 곱한
                        것뿐이라 자동 생성 방식 자체는 같다
  data.js               챕터 목차 — 단일 소스. 문장은 기본 → 중급(`level: "intermediate"`)
                        → 심화(`level: "advanced"`) 3단계로 이어진다(D-72, D-73). 챕터를
                        누르면 먼저 단계를 고르는 화면이 뜬다. elementary-conversation은
                        문장마다 `grammar`(그 학년 `grammarPoints`의 id)도 달아 문법
                        진행·반복을 추적한다(D-77) — basic-conversation엔 없는 필드
  screens.js            렌더 함수: 목차 화면 + 챕터 화면(브라우저 TTS/STT 직접 연동, 서버
                        API 없음). 듣기/말하기를 강제하지 않고 건너뛰기 버튼
                        (#learning-skip)을 항상 같이 보여준다(D-61). elementary-
                        conversation은 `type: "produce"` 문장(질문만 던지고 예시 답안으로
                        자가평가, 정답 유사도 채점 없음)과 낮은 점수/자가평가로 표시된
                        문장을 다시 도는 "헷갈렸던 문장만 복습하기"도 처리한다(D-77) —
                        basic-conversation의 renderChapter를 재사용하지 않고 따로 짰다
  index.js               디스크립터: <tool>(메타: id, card) + <tool>Screens(목차 화면 +
                        자동 생성한 챕터/학년별 화면)
js/learning/score.js     발음 유사도 판정 — Levenshtein 기반, DOM을 모른다. 도구 폴더
                        밖에 있어 여러 학습 도구가 공용으로 쓴다(D-77, 원래
                        basic-conversation 안에 있던 걸 두 번째 도구가 생기며 옮김 —
                        복사하면 한쪽만 고치는 버그가 생긴다)
js/learning/speech.js    TTS/STT 헬퍼(speak/listen/supportsSpeech/supportsRecognition) —
                        score.js와 같은 이유로 공용(D-77)
js/learning/cloud.js     학습 진행률(state.learning)을 Supabase에 동기화(D-68) — 도구 폴더
                        밖, 도구가 여럿이어도 공용으로 재사용한다. NumPath 마을(D-55)과 같은
                        패턴(cloud-auth-loader.js로 CDN 동적 import), 코인/마을 같은 보상
                        체계는 없다. initLearningSync()는 main.js 부팅 시 1회, saveLearningProgress()는
                        각 도구의 screens.js가 진행이 바뀔 때마다 호출
```

**의존 방향**: `tests/*`·`games/*`·`learning/*` → `core/*`. `core`는 테스트도 게임도 학습 콘텐츠도 모른다.
`screens/home.js`는 `listTests()`/`listGames()`/`listLearning()`으로 등록된 것을 조회할 뿐, 개별
테스트·게임·학습 도구를 import 하지 않는다 — **뭘 추가해도 홈 화면 파일의 목록 렌더 로직은 안 고친다.**

**`score.js`/`engine.js`/`generate.js`/`solve.js`가 DOM을 모른다는 점이 중요하다.** 로직만 순수 함수로 떼어놨기 때문에 `node --test`에서 브라우저 없이 검증된다(§8).

## 2. 라우터 계약 (화면 디스크립터)

```js
{ id, path, title, render, theme?, guard?, dynamicPath? }
```

| 필드 | 의미 |
|------|------|
| `id` | 화면 식별자. **`history.state`에 저장되므로 바꾸면 안 된다** (배포 직후 열려 있던 탭의 뒤로가기가 깨진다) |
| `path` | 주소. 중복되면 등록 시점에 **throw** — 조용히 덮어쓰지 않는다 |
| `title` | `document.title` |
| `render` | 렌더 함수 (`app.innerHTML=""` 직후 호출됨) |
| `theme` | `adhd` \| `game` \| `disc` \| `couple` \| `learning`. `document.body`에 `theme-*` 클래스를 붙인다 (모달이 body에 붙기 때문에 `#app`이 아니라 body) |
| `guard` | 지금 이 화면을 띄우면 안 될 때 **대신 갈 화면 id**를 반환. falsy면 그대로 진행. 최대 5홉까지 재검사 |
| `dynamicPath` | 슬러그가 붙어 주소가 하나로 안 정해지는 화면(공유 결과). 주소를 건드리지 않고 `history.state`만 채운다 |

**`setScreen()` 흐름**: `runTeardowns()` → `resolveScreen()`(guard 연쇄) → 테마 클래스 교체 → `render()` → 스크롤 리셋 → `title` → history push/replace.

**`onLeave(fn)`** — 화면을 떠날 때 정리할 것을 등록한다. 타이머뿐 아니라 `requestAnimationFrame`도 여기로 보낸다.
`runTeardowns()`는 각 콜백을 try/catch로 감싸므로, 정리 중 하나가 터져도 화면 전환은 계속된다.

**`setExitGuard(onExit)` / `getExitGuard()`** — 진행 중인 화면(문항·게임 풀이 등)이 "지금 나가면
답이 사라진다"는 걸 등록한다. `onLeave()`와 같은 생명주기로 매 화면 전환마다 자동으로 비워진다.
전역 햄버거 메뉴(`core/header.js`)의 "홈으로 가기"가 `core/dom.js`의 `goHome()`을 통해 이걸 보고
확인 모달을 거칠지 정한다 — 화면마다 있던 홈 버튼(옛 `.exit-btn`)을 대신한다(D-57).

**공유 주소 해석**: `parseSharedPath()`가 `/test/<testId>/result/<slug>`를 등록된 테스트의 `slugToKey`로 푼다.
슬러그가 없는 `/test/adhd/result`는 여기 안 걸리고 일반 경로로 처리된다.

**`registerGame(descriptor)` / `listGames()`** — `registerTest`/`listTests`와 대칭인 독립 미니게임
레지스트리. 게임 디스크립터는 `{ id, card }`만 있고 `slugToKey`/`sharedScreen`이 없다 — 게임은
결과별 슬러그 공유가 아니라 게임 주소 자체를 공유한다(§7). 반응속도·딜레마 게임은 테스트 점수에
반영되는 하위 단계라 여기 등록하지 않는다(`docs/decisions/2026-h2.md` D-4).

**`registerLearning(descriptor)` / `listLearning()`** — `registerTest`/`listTests`와 대칭인
학습 도구 레지스트리(D-63). 학습 카테고리 **안에는** 서로 독립된 도구(기초 영어회화, 초등
영어회화, 나중엔 다른 과목)가 여러 개 들어갈 수 있어 도구 단위로는 카탈로그가 맞다 — 도구
하나(예: `basic-conversation`)를 등록하면 학습 목록(`/learning`)에 카드로 나온다. **도구
안의 챕터(목차)·학년·단계(레벨)는 여기 등록하지 않는다** — `registerScreens()`로 화면만
늘어날 뿐, 챕터 자체는 목차 화면(§3 `learning-basic-conversation`)이 그 도구의 `CHAPTERS`
데이터에서, 챕터별 단계 선택·연습 화면은 `CHAPTERS`와 `LEVEL_LABELS`를 곱해(D-73)
`index.js`가 직접 만든다. `elementary-conversation`은 여기에 `GRADES` 한 겹을 더 곱한다
(D-77) — 학년·챕터·단계가 늘어나도 `index.js`는 안 고친다. 처음엔(D-60) 챕터 하나
(`greeting`)를 도구인 것처럼 최상위에 바로 등록했다가, 사용자가 "학습 카테고리 안에 다른
공부 도구도 넣을 거다, 지금 건 그 안의 목차 항목 하나여야 한다"고 바로잡아서(D-63) 지금
모양(도구만 레지스트리, 챕터는 도구 내부)이 됐다.

## 3. 화면 표

| 경로 | id | 테마 | guard |
|------|-----|------|-------|
| `/` | `home` | — | — |
| `/test` | `psych-list` | — | — |
| `/game` | `game-list` | — | — |
| `/learning` | `learning-list` | — | — |
| `/privacy` | `privacy` | — | — |
| `/mypage` | `mypage` | — | — (D-70, 로그인 상태·학습 진행률 요약) |
| `/learning/basic-conversation` | `learning-basic-conversation` | learning | — |
| `/learning/basic-conversation/greeting` | `learning-basic-conversation-greeting` | learning | — |
| `/learning/basic-conversation/greeting/basic` | `learning-basic-conversation-greeting-basic` | learning | — |
| `/learning/elementary` | `learning-elementary` | learning | — |
| `/learning/elementary/lower` | `learning-elementary-lower` | learning | — |
| `/learning/elementary/lower/school-day` | `learning-elementary-lower-school-day` | learning | — |
| `/learning/elementary/lower/school-day/basic` | `learning-elementary-lower-school-day-basic` | learning | — |
| `/test/adhd` | `test-intro` | — | — |
| `/test/adhd/play` | `test-question` | — | 답이 다 차 있으면 마지막 문항으로 되돌림 |
| `/test/adhd/result` | `test-result` | — | 답 부족 → `test-intro`, 게임 미완료 → `reaction-intro` |
| `/test/adhd/result/<slug>` | `test-shared` | — | 슬러그 안 풀리면 → `home` |
| `/test/adhd/reaction` | `reaction-intro` | game | 답 부족 → `test-intro` |
| `/test/adhd/reaction/play` | `reaction-play` | game | 답 부족 → `test-intro` |
| `/test/adhd/reaction/ad` | `reaction-ad` | game | 답 부족 → `test-intro`, 게임 미완료 → `reaction-intro` |
| `/test/disc` | `disc-intro` | disc | — |
| `/test/disc/types` | `disc-types` | disc | — |
| `/test/disc/play` | `disc-question` | disc | 순서 미생성 → `disc-intro` |
| `/test/disc/result` | `disc-result` | disc | 문항 미완료 → `disc-intro` · 문항은 끝났지만 게임 미완료 → `dilemma-intro` |
| `/test/disc/result/<slug>` | `disc-shared` | disc | 슬러그 안 풀리면 → `home` |
| `/test/disc/dilemma` | `dilemma-intro` | disc | 문항 미완료 → `disc-intro` |
| `/test/disc/dilemma/play` | `dilemma-play` | disc | 문항 미완료 → `disc-intro` |
| `/test/disc/dilemma/ad` | `dilemma-ad` | disc | 문항 미완료 → `disc-intro`, 게임 미완료 → `dilemma-intro` |
| `/test/couple` · `/setup` | `couple-intro` · `couple-setup` | couple | **관리자만**(D-51) — 아니면 "곧 출시됩니다" 모달 + `psych-list` |
| `/test/couple/guide` | `couple-guide` | couple | **관리자만**(D-51) |
| `/test/couple/play` | `couple-question` | couple | **관리자만**(D-51) · 통과해도 축 미선택 → `couple-intro` · 다 답했으면 마지막 문항으로 되돌림 |
| `/test/couple/ad` · `/result` · `/invite` | `couple-ad` · `couple-result` · `couple-invite` | couple | **관리자만**(D-51) · 통과해도 문항 미완료 → `couple-intro` |
| `/test/couple/pair[?p=<코드>]` | `couple-pair` | couple | **관리자만**(D-51) · 통과하면 코드 없음/안 풀림 → 직접 입력 폼 렌더(D-45) · 코드 있고 본인 응답 완료 → `couple-report` |
| `/test/couple/together` | `couple-report` | couple | **관리자만**(D-51) · 통과해도 코드 없음·문항 미완료 → `couple-intro` |
| `/test/couple/result/<slug>` | `couple-shared` | couple | **관리자만**(D-51) · 통과해도 슬러그 안 풀리면 → `home` |
| `/game/numpath` | `numpath-intro` | game | — |
| `/game/numpath/play` | `numpath-play` | game | 런 없음 → `numpath-intro` |
| `/game/numpath/ad` | `numpath-ad` | game | 런 없음 → `numpath-intro`, 런 미완료 → `numpath-play` |
| `/game/numpath/result` | `numpath-result` | game | 런 없음 → `numpath-intro`, 런 미완료 → `numpath-play` |

> ADHD 화면 id가 `test-*`인 것은 DISC보다 먼저 만들어졌기 때문이다. **이름을 바꾸지 않는다**(위 §2).

**NumPath는 반응속도·딜레마 게임과 달리 테스트에 속하지 않는 독립 미니게임이다** — `/game/numpath/*`
경로에 있고 `registerGame()`으로 `/game` 목록에 자동 노출된다(`docs/decisions/2027-h1.md` D-28).
`numpath-play`는 `theme-game`(반응속도 게임과 같은 초록 팔레트)을 재사용한다 — 새 테마를 만들지 않았다.
난이도(3커브)·스테이지별 시드·런 타이머·개인 최고 기록(localStorage) 구조는
`docs/numpath-architecture.md`와 D-54·D-59 참고.

**두 테스트 모두 딸린 게임이 결과 화면 뒤의 선택 보너스가 아니라, 마지막 문항 직후 반드시
거쳐야 하는 필수 단계로 통합돼 있다.** 게임 없이는(직접 URL 접속 포함) 결과를 볼 수 없고,
별도의 "게임 결과" 화면도 없다 — 게임이 끝나면 광고 게이트를 한 번 거쳐 검사 결과로 이동해
하나의 결과로 합쳐 보여준다. 테스트별 흐름 상세는 각각 `docs/adhd-architecture.md` ·
`docs/disc-architecture.md`로 분리돼 있다. NumPath(테스트에 속하지 않는 독립 게임)의 흐름·게임
로직 개요는 `docs/numpath-architecture.md` 참고.

**학습은 다른 카테고리처럼 3단 구조지만, 맨 안쪽 단위가 "결과"가 아니라 "챕터 × 단계"다** —
홈 → 학습 목록(도구 카드) → 도구의 목차(챕터 카드) → 챕터의 단계 선택(기본/중급/심화) →
문장 연습. 지금은 도구가 `basic-conversation`(기초 영어회화, 7세 이하 대상) 하나, 그 안
챕터는 4개(총 362문장, 기본 122 + 중급 120 + 심화 120, D-74)다 — 인사/기분 표현, 하루
일과(아침+식사+목욕/잠자리 통합), 가족·자기소개, 놀이터에서(놀이+날씨 통합). 단어 나열이
아니라 일상대화 위주로 구성했고(어린이 애니메이션 참고, D-65), 시간순으로 이어지거나
소재가 겹치는 상황은 챕터 하나로 묶는다(D-66) — 처음엔 8개로 더 잘게 나눴다가 통합했다.
챕터 안에는 같은 문장 틀에 단어만 바꾼 반복(패턴 드릴, 예 "I like ~"·"This is my ~")도
섞여 있다(D-67). 챕터마다 기본(입문 생존 표현) → 중급(짧은 질문·요청) → 심화(원어민 7세
수준의 의견·이유·비교·협상 문장, `level: "advanced"`)로 이어지는 3단계 구성이다(D-72,
D-73) — 단계별로 새 챕터를 만들지 않고 같은 챕터 데이터 안에서 `level` 필드로만 나눈다.
챕터를 클릭하면 단계 선택 화면이 먼저 뜨고, 각 단계는 진행 상태가 서로 독립적이다. 문장
카드의 한국어 해석 옆에 🔊 버튼이 있어 `speechSynthesis`를 `lang: "ko-KR"`로 다시 불러
한국어도 읽어준다(D-69) — 한글을 아직 못 읽는 어린이가 뜻을 들을 수 있게. 광고 슬롯은
아직 없다(파일럿 단계라 뺐다). 서버 API 없이 브라우저 내장 TTS(`speechSynthesis`)·
STT(`SpeechRecognition`)만 쓴다. 상세·범위·향후 확장은 `docs/learning-architecture.md`.

**부부 관계 성향 체크만 화면이 10개다** — 축 선택·이용 안내·배우자 초대·결합 결과가 더 있기 때문이다.
배우자 결과는 기본적으로 주소(`?p=<25자 코드>`)로 실어 나르므로 `couple-pair`만 쿼리 스트링에
의존한다. **이 테스트만 예외적으로 백엔드(Cloudflare Pages Functions + KV)를 하나 쓴다** —
25자 코드를 8자로 줄여주는 `functions/api/couple-code/`. 스키마 자체는 그대로 백엔드 없이도
동작해서(`couple-pair`가 25자 코드·링크 직접 입력도 받는다), 백엔드는 최적화지 의존성이
아니다. 상세는 `docs/couple-architecture.md` §6-1.

- **광고 게이트(`reaction-ad`/`dilemma-ad`/`numpath-ad`)**: `core/ads.js`의 `adGateMarkup()` +
  `core/dom.js`의 `bindAdGate()`로 구성. 300×250 AdFit 광고 단위(`interstitial`)를 3초
  카운트다운 뒤 "결과 보러 가기" 버튼이 활성화되는 방식으로, AdFit 웹 SDK에 없는 자동 전환
  전면광고를 대신한다. 햄버거 메뉴의 "홈으로 가기"는 카운트다운과 무관하게 항상 즉시 동작 —
  강제 시청이 아니라 잠깐 보게 하는 정도로, 이탈률을 올리지 않는 선에서 노출 기회를 하나 늘리는
  게 목적이다.

## 4. 상태(state) 모양

```js
state = {
  screen: "home",
  answers: [],        // ADHD: [{ group: "focus"|"impulse"|"energy", value: 0~4 }] — 역채점 적용 후 값
  lastReaction: null, // Go/No-Go 요약
  disc: {
    order: null,      // 문항별 선택지 표시 순서 (셔플)
    answers: [],
    pending: { most: null },  // DISC는 한 문항이 2단계라 반쯤 답한 상태도 state에 있어야 한다
    dilemma: null,
  },
  numpath: {
    run: null,   // { seed, difficulty, stageIndex, stars: [], startedAt, finishedAt } — 퍼즐 보드 자체는 안 들고 있다(위 참고)
    muted: false,
    difficulty: "normal",
  },
  couple: {
    setup: null,     // { t, r, k } — 세 축을 고르기 전에는 null
    items: null,     // 조립된 문항지 (축을 고른 뒤에 만들어진다)
    answers: {},     // 문항 코드 → 1~5
    index: 0,
    completed: false,  // 문항을 끝까지 마쳤는가. answers 개수로 대신 세지 않는다(D-44)
    startedAt: null, elapsedMs: null,  // 소요시간 검사용. 완료 시점에 한 번 고정한다
    partner: null,   // 초대 링크(?p=)나 직접 입력으로 푼 배우자 결과 — 문항을 다시 시작해도 살려둔다
    shortCode: null, // 초대 화면에서 발급받은 짧은 코드 캐시 { code, for } (D-45)
  },
  learning: {},  // 챕터 화면이 처음 열릴 때 `state.learning[chapter.id] ??= { index: 0 }`로
                 // 챕터 id별 키가 늘어난다. index만 있으면 충분하다(D-60, D-63)
}
```

**메모리 전용이다.** 새로고침하면 초기화된다. 영속 데이터는 없다 — 예전엔 `localStorage["gt_reaction_best"]`로
반응속도 최고기록을 저장했으나, 게임의 "빠를수록 좋다"는 프레이밍이 채점 철학(D-5, 빠른 반응 ≠ 충동적)과
충돌해서 제거했다(D-20).

`disc.pending`이 state에 있는 이유: `render()`가 매번 DOM을 버리므로, 반쪽 답을 지역 변수에 두면 뒤로가기·popstate에서 사라진다.

## 5. 테스트/게임 추가 절차

### 테스트
1. `js/tests/<id>/` 폴더 생성 — `data.js` / `score.js` / `screens.js` / `index.js`
2. `index.js`에서 `<id>Test`(메타: `id`, `slugToKey`, `sharedScreen`, `card`)와 `<id>Screens`(화면 배열) export
3. `js/main.js`에서 `registerTest(<id>Test)` **와** `registerScreens(<id>Screens)` **둘 다** 호출
4. `npm test` — 화면 id·경로 중복과 import/export 누락을 잡아준다

홈·목록 화면은 고치지 않는다. `renderPsychList()`가 `listTests()`로 카드를 만든다.

### 독립 미니게임 (테스트에 속하지 않는 경우)
1. `js/games/<id>/` 폴더 생성 — 순수 로직(`data.js`/`engine.js`/생성기·솔버가 있다면 그것도)과
   화면(`screens.js`, 필요하면 `play.js`로 분리)을 나눈다
2. `index.js`에서 `<id>Game`(메타: `id`, `card` — `slugToKey`/`sharedScreen` 없음)과
   `<id>Screens`(화면 배열) export
3. `js/main.js`에서 `registerGame(<id>Game)` **와** `registerScreens(<id>Screens)` **둘 다** 호출
   (하나만 하면 목록 카드나 라우팅 한쪽이 조용히 빠진다 — 테스트와 같은 함정)
4. `npm test` — `test/modules.test.js`에 새 `<id>Screens`를 import 목록에 추가해야 화면 id·경로
   중복 검사가 이 게임도 본다

홈·목록 화면은 고치지 않는다. `renderGameList()`가 `listGames()`로 카드를 만든다. 반응속도·딜레마
게임처럼 테스트 점수에 반영되는 하위 단계는 `registerGame()`하지 않는다(D-4) — guard가 테스트
진행 상태를 요구해서, 독립 게임으로 노출하면 사용자를 테스트 인트로로 되돌려버린다.

### 학습 도구 (독립 미니게임과 같은 절차)
1. `js/learning/<toolId>/` 폴더 생성 — `data.js`(챕터 목차: `CHAPTERS` 배열) / `score.js` /
   `screens.js`(목차 화면 + 챕터 화면) / `index.js`
2. `index.js`에서 `<tool>`(메타: `id`, `card`)과 `<tool>Screens`(목차 화면 1개 +
   `CHAPTERS.map()`으로 생성한 챕터별 화면) export
3. `js/main.js`에서 `registerLearning(<tool>)` **와** `registerScreens(<tool>Screens)` **둘 다** 호출
4. `npm test` — `test/modules.test.js`의 import 목록에 새 `<tool>Screens`도 추가

홈·목록 화면은 고치지 않는다. `renderLearningList()`가 `listLearning()`으로 도구 카드를 만든다.

### 학습 도구 안에 새 챕터(목차 항목) 추가할 때
레지스트리에 새로 등록하지 않는다 — 해당 도구의 `data.js`(`CHAPTERS` 배열)에 항목만
추가하면 그 도구의 `index.js`가 화면을 자동 생성하고, 목차 화면(`renderBasicConversationIntro`
류)도 데이터에서 카드를 만들어서 따로 고칠 게 없다. **새 챕터부터 만들지 않는다(D-66)** —
새 상황이 시간순으로 이어지거나 소재가 겹치는 기존 챕터가 있으면 그 챕터의 `sentences`에
문장만 보태고, 정말 별개 상황일 때만 새 챕터를 만든다. 목차가 한 화면에서 훑어볼 수
있는 길이를 유지하는 게 목적이다.

## 6. 채점 파이프라인

ADHD·DISC 채점 파이프라인 상세는 각각 `docs/adhd-architecture.md` · `docs/disc-architecture.md`로
분리돼 있다(15KB 자동 분리 규칙 — 본문 상단 참고). NumPath는 성향 채점이 아니라 퍼즐 생성·솔버
로직이라 `docs/numpath-architecture.md`의 "게임 로직 개요"에 있다.

## 7. 공유 · 결과 카드 (`js/core/share.js`)

- 공유 URL은 **결과별 슬러그 주소** `${origin}/test/<testId>/result/<slug>` — 페이지 자체 주소를 공유하면 친구는 빈 테스트만 본다(`docs/DECISIONS.md` D-7)
  - **예외: NumPath는 슬러그 없는 게임 주소(`${origin}/game/numpath`)를 그대로 공유한다.** D-7이
    막은 건 "친구가 열면 빈 화면만 보이는" 경우였다 — 심리테스트는 공유할 게 "내 결과"라 슬러그가
    필요하지만, 게임은 공유할 게 "같은 게임"이라 인트로로 착지하는 게 정확한 동작이다
    (`docs/decisions/2027-h1.md` D-29).
- 공유 버튼: `navigator.share`(모바일 네이티브 공유시트) → 없으면 클립보드 복사 폴백. 카카오 전용 SDK는 쓰지 않는다(D-8)
- 결과 카드는 canvas에 직접 그린다. `document.fonts.ready`를 먼저 기다려야 폰트가 적용된다(CDN 차단 환경에선 sans-serif 폴백)
- 이미지 저장은 canvas → blob → `<a download>`. **자동 첨부가 아니라 다운로드**다

## 8. 테스트 스위트

`npm test` (= `node --test`, 의존성 0). 브라우저 없이 도는 것만 여기 있다.

## 9. OG 미리보기 셸 (`og-shells/`)

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
