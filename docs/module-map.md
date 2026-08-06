# module-map — 모듈맵

> 선택 로드 문서. "이 파일이 뭘 하는 파일이지?"를 물을 때만 읽는다.
> `docs/architecture.md`에서 분리됐다(D-88) — 콘텐츠(테스트·게임·학습 도구)가 늘 때마다
> 같이 커지는 **인벤토리**라, 계약·절차만 남긴 architecture.md와 수명이 다르다.
> **모듈을 추가·이동·삭제하면 같은 커밋에 이 파일과 `CLAUDE.md`의 구조 개요 트리를 함께 고친다.**

## 모듈맵

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
js/learning/<toolId>/   학습 카테고리 안의 독립 도구 1개 = 폴더 1개(basic-conversation,
                        elementary-conversation, dialogue). tests/games와 같은 레지스트리
                        방식(D-63) — 도구가 여럿이면 학습 목록(`/learning`)에 카드로 나열된다.
                        도구 내부는 챕터(목차) 여러 개로 이뤄질 수 있고, index.js가 챕터별
                        화면을 자동 생성한다. basic-conversation은 챕터 → 단계(D-73),
                        elementary-conversation은 학년 → 챕터 → 단계(D-78) — 학년 한 겹만
                        더 곱한 것뿐이라 자동 생성 방식 자체는 같다. **dialogue만 모델이
                        다르다**(D-87) — 장면(SCENES) → 대화 하나이고, 카드가 "문장 하나"가
                        아니라 "대화의 한 턴"이다(상대 대사 ↔ 내 차례가 번갈아 옴). 단계·학년
                        층이 없어 한 단 얕다
  data.js               챕터 목차 — 단일 소스. 문장은 기본 → 중급(`level: "intermediate"`)
                        → 심화(`level: "advanced"`) 3단계로 이어진다(D-72, D-73). 챕터를
                        누르면 먼저 단계를 고르는 화면이 뜬다. elementary-conversation은
                        문장마다 `grammar`(그 학년 `grammarPoints`의 id)도 달아 문법
                        진행·반복을 추적한다(D-78) — basic-conversation엔 없는 필드
  screens.js            렌더 함수: 목차 화면 + 챕터 화면(브라우저 TTS/STT 직접 연동, 서버
                        API 없음). 듣기/말하기를 강제하지 않고 건너뛰기 버튼
                        (#learning-skip)을 항상 같이 보여준다(D-61). elementary-
                        conversation은 `type: "produce"` 문장(질문만 던지고 예시 답안으로
                        자가평가, 정답 유사도 채점 없음)과 낮은 점수/자가평가로 표시된
                        문장을 다시 도는 "헷갈렸던 문장만 복습하기"도 처리한다(D-78) —
                        basic-conversation의 renderChapter를 재사용하지 않고 따로 짰다
  index.js               디스크립터: <tool>(메타: id, card) + <tool>Screens(목차 화면 +
                        자동 생성한 챕터/학년별 화면). dialogue는 장면별 화면
js/learning/dialogue/   다중 턴 대화 연습(D-87) — §3-7이 오래 미뤄둔 것을 별도 도구로 신설.
                        data.js의 SCENES가 단일 소스이고, 각 장면의 `turns`는
                        `role: "partner"`(상대 대사, 자동 재생 + 다음 버튼)와 `role: "you"`
                        (내 차례 — 힌트만 주고 STT 후 예시 답안으로 자가평가)가 번갈아 온다.
                        **유사도 채점 없음**(정답이 여럿), **분기 없음**(자유 발화를 의미로
                        해석해 갈래를 고르면 STT 오인식 때 대화가 산으로 간다 — 한 줄기
                        역할극으로 고정). 지나온 턴은 화면 위에 로그(.dialogue-log)로 쌓아
                        앞 맥락을 보여준다 — 문장 단위 도구엔 없는 요구
js/learning/score.js     발음 유사도 판정 — Levenshtein 기반, DOM을 모른다. 도구 폴더
                        밖에 있어 여러 학습 도구가 공용으로 쓴다(D-78, 원래
                        basic-conversation 안에 있던 걸 두 번째 도구가 생기며 옮김 —
                        복사하면 한쪽만 고치는 버그가 생긴다)
js/learning/speech.js    TTS/STT 헬퍼(speak/listen/supportsSpeech/supportsRecognition) —
                        score.js와 같은 이유로 공용(D-78)
js/learning/record.js    STT가 없는 브라우저(iOS Safari)의 말하기 폴백(D-95) — MediaRecorder로
                        녹음해 되듣고 자가평가한다. 6개 호출부가 이 마크업+바인딩을 공용으로
                        쓰고, 결과는 STT 경로와 똑같이 weak/SRS에 반영된다
js/learning/prefs.js     연습 카드의 "받침대 치우기" 설정(D-93) — 영어 문장 가리기/뜻 접기
                        토글의 마크업·바인딩을 한 곳에 둔다(세 화면이 공용). 세션 한정
                        메모리라 state.learning에도 localStorage에도 안 넣는다
js/learning/srs.js       간격 반복(SRS) 스케줄(D-92) — DOM·state를 모르는 순수 함수라
                        node --test로 검증된다. `weak`의 값이 불리언에서 `{ due, step }`으로
                        바뀌었지만 **키는 그대로**라 기존에 weak를 읽던 코드는 무변경
js/learning/review.js    "오늘 복습" 화면(D-92) — 전 도구를 가로질러 오늘 볼 문장만 모은다.
                        도구를 import하지 않고 `listLearning()`의 `resolveReview(key,id)`로
                        문장을 되돌려받는다(D-70 경계). registerLearning은 안 한다
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
