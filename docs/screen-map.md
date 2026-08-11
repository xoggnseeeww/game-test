# screen-map — 화면 표

> 선택 로드 문서. 화면 id·경로·guard를 확인할 때만 읽는다.
> `docs/architecture.md`에서 분리됐다(D-88) — 테스트·게임·학습 챕터가 늘 때마다 행이 늘어나는
> **인벤토리**라, 계약·절차만 남긴 architecture.md와 수명이 다르다.
> 화면 디스크립터의 **계약**(필드 의미·guard 규칙·teardown)은 여전히 `docs/architecture.md` §2에 있다.
> ⚠️ **화면 id는 바꾸지 않는다** — 이미 열려 있는 탭의 `history.state`에 옛 id가 남는다(D-16).

## 화면 표

> 학습 도구처럼 데이터에서 **자동 생성**되는 화면(챕터·학년·단계·장면별)은 **대표 1개만** 싣는다 —
> 실제 화면 수는 `data.js`의 배열 길이에 따라 달라지고(지금 elementary만 학년 3 × 챕터 6 × 단계 3),
> 여기 전부 나열하면 콘텐츠를 추가할 때마다 표를 손대야 해서 금방 낡는다. 정확한 전체 목록은
> 각 도구의 `index.js`가 단일 소스이고, `npm test`(`test/modules.test.js`)가 id·경로 중복을 검사한다.

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
| `/learning/elementary` | `learning-elementary` | learning | 학년이 1개뿐이면 그 학년 목차로 건너뜀(D-79 — 지금은 3개라 비활성) |
| `/learning/elementary/lower` | `learning-elementary-lower` | learning | — |
| `/learning/elementary/lower/school-day` | `learning-elementary-lower-school-day` | learning | — |
| `/learning/elementary/lower/school-day/basic` | `learning-elementary-lower-school-day-basic` | learning | — |
| `/learning/elementary/lower/school-day/basic/listen` | `learning-elementary-lower-school-day-basic-listen` | learning | — (D-95, 듣고 뜻 맞히기 — 단계 완료 화면에서만 들어간다) |
| `/learning/review` | `learning-review` | learning | — (D-92, 오늘 복습 — 도구를 가로지르는 화면이라 registerLearning은 안 한다) |
| `/learning/dialogue` | `learning-dialogue` | learning | — |
| `/learning/dialogue/make-plans` | `learning-dialogue-make-plans` | learning | — |
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
| `/test/couple/ad` · `/result` | `couple-ad` · `couple-result` | couple | **관리자만**(D-51) · 통과해도 문항 미완료 → `couple-intro` |
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

**부부 관계 성향 체크는 화면이 7개다** — 축 선택과 이용 안내가 더 있기 때문이다.
예전에는 10개였다(배우자 초대·코드 입력·결합 결과). 그 흐름과 유일한 백엔드
(Cloudflare Pages Functions + KV)는 **D-99에서 통째로 없앴다** — 지금 이 앱에는 서버 호출이
하나도 없다. 상세는 `docs/couple-architecture.md` §5.

- **광고 게이트(`reaction-ad`/`dilemma-ad`/`numpath-ad`)**: `core/ads.js`의 `adGateMarkup()` +
  `core/dom.js`의 `bindAdGate()`로 구성. 300×250 AdFit 광고 단위(`interstitial`)를 3초
  카운트다운 뒤 "결과 보러 가기" 버튼이 활성화되는 방식으로, AdFit 웹 SDK에 없는 자동 전환
  전면광고를 대신한다. 햄버거 메뉴의 "홈으로 가기"는 카운트다운과 무관하게 항상 즉시 동작 —
  강제 시청이 아니라 잠깐 보게 하는 정도로, 이탈률을 올리지 않는 선에서 노출 기회를 하나 늘리는
  게 목적이다.
