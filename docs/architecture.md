# architecture — 과몰입구역

> 선택 로드 문서. 라우터 계약·상태 모양·추가 절차를 파악해야 할 때만 읽는다.
> ⚠️ **파일 크기 자동 분리 규칙**: 이 파일이 **300줄**을 넘으면, 이 문서를 수정하는 세션이 별도 지시 없이 즉시 분리한다.
> (예전 규칙엔 "또는 15KB"가 있었는데, 한글은 1자=3바이트라 바이트 기준이 **항상 먼저** 터져서
> 멀쩡한 문서까지 쪼개게 만들었다 — `docs/errors-ai.md` A-4가 지적한 그 함정이라 줄 수만 남겼다, D-105.)
> 지금까지의 분리는 두 축이다 — ① 테스트/게임별 상세는 `docs/<test-id>-architecture.md`로,
> ② **콘텐츠가 늘 때마다 같이 커지는 인벤토리**(무엇이 있는지 나열하는 표)는 별도 파일로 뗐다(D-88):
> 모듈맵 → `docs/module-map.md`, 화면 표 → `docs/screen-map.md`, OG 셸 → `docs/og-shells.md`.
> 이 파일에는 **계약과 절차**(어떻게 동작하고 어떻게 추가하는가)만 남긴다 — 콘텐츠를 추가해도
> 커지지 않는 내용이라, 다시 15KB를 넘을 일이 잘 없다. 분리 후 `CLAUDE.md` 상세 문서 표에 행 추가.

## 인덱스
- 모듈맵 → **`docs/module-map.md`로 분리됨**(D-88)
- 라우터 계약 (화면 디스크립터) → §2
- 화면 표 → **`docs/screen-map.md`로 분리됨**(D-88)
- 상태(state) 모양 → §4
- 테스트 추가 절차 → §5
- 채점 파이프라인 (ADHD / DISC) → §6
- 공유 · 결과 카드 → §7
- 테스트 스위트 → §8
- OG 미리보기 셸 (`og-shells/`) → **`docs/og-shells.md`로 분리됨**(D-88)

---

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
늘어날 뿐, 챕터 자체는 목차 화면(`docs/screen-map.md`의 `learning-basic-conversation`)이 그 도구의 `CHAPTERS`
데이터에서, 챕터별 단계 선택·연습 화면은 `CHAPTERS`와 `LEVEL_LABELS`를 곱해(D-73)
`index.js`가 직접 만든다. `elementary-conversation`은 여기에 `GRADES` 한 겹을 더 곱한다
(D-78) — 학년·챕터·단계가 늘어나도 `index.js`는 안 고친다. 처음엔(D-60) 챕터 하나
(`greeting`)를 도구인 것처럼 최상위에 바로 등록했다가, 사용자가 "학습 카테고리 안에 다른
공부 도구도 넣을 거다, 지금 건 그 안의 목차 항목 하나여야 한다"고 바로잡아서(D-63) 지금
모양(도구만 레지스트리, 챕터는 도구 내부)이 됐다.

---

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

---

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

---

## 6. 채점 파이프라인

ADHD·DISC 채점 파이프라인 상세는 각각 `docs/adhd-architecture.md` · `docs/disc-architecture.md`로
분리돼 있다(15KB 자동 분리 규칙 — 본문 상단 참고). NumPath는 성향 채점이 아니라 퍼즐 생성·솔버
로직이라 `docs/numpath-architecture.md`의 "게임 로직 개요"에 있다.

---

## 7. 공유 · 결과 카드 (`js/core/share.js`)

- 공유 URL은 **결과별 슬러그 주소** `${origin}/test/<testId>/result/<slug>` — 페이지 자체 주소를 공유하면 친구는 빈 테스트만 본다(`docs/DECISIONS.md` D-7)
  - **예외: NumPath는 슬러그 없는 게임 주소(`${origin}/game/numpath`)를 그대로 공유한다.** D-7이
    막은 건 "친구가 열면 빈 화면만 보이는" 경우였다 — 심리테스트는 공유할 게 "내 결과"라 슬러그가
    필요하지만, 게임은 공유할 게 "같은 게임"이라 인트로로 착지하는 게 정확한 동작이다
    (`docs/decisions/2027-h1.md` D-29).
- 공유 버튼: `navigator.share`(모바일 네이티브 공유시트) → 없으면 클립보드 복사 폴백. 카카오 전용 SDK는 쓰지 않는다(D-8)
- 결과 카드는 canvas에 직접 그린다. `document.fonts.ready`를 먼저 기다려야 폰트가 적용된다(CDN 차단 환경에선 sans-serif 폴백)
- 이미지 저장은 canvas → blob → `<a download>`. **자동 첨부가 아니라 다운로드**다

---

## 8. 테스트 스위트

`npm test` (= `node --test`, 의존성 0). **브라우저 없이 도는 것만** 여기 있다 —
라우팅·이벤트·레이아웃은 `scripts/verify.cjs`(헤드리스 브라우저)로만 잡힌다.

| 파일 | 무엇을 지키나 |
|------|---------------|
| `modules.test.js` | 모듈 import/export 정합성 · **화면 id·경로 중복** — 새 도구/게임을 추가하면 이 파일의 화면 목록에도 넣어야 검사 대상이 된다 |
| `copy.test.js` | 개수 하드코딩 금지(D-17) — 세 번 재발해서 문서 규칙에서 테스트로 승격됐다 |
| `adhd.score.test.js` · `disc.score.test.js` · `couple.score/match/shortcode.test.js` | 채점 불변식 · 부부 체크 안전 장치(유형 단독 노출 금지 등) · 짧은 코드 |
| `numpath.engine.test.js` · `numpath.generate.test.js` | 타일 모델 · 생성기 · 솔버 · 별 판정 |
| `learning.score.test.js` | 발음 채점 — **단어 단위** 정렬·판정 구간, 축약형/숫자 정규화, 오답 단어 표시(D-91) |
| `learning.elementary.test.js` | 문법 태그 유효성 · **반복(recycling) 규칙** · produce 문장의 hint/sample 존재 · kidLabel에 문법 용어가 안 남았는지 · `check` 정규식이 실제 문장에 걸리고 엉뚱한 문장은 안 잡는지(D-94) · 모든 문법에 `explain`이 있는지(D-96) |
| `learning.speech.test.js` | 음성 고르기(D-97) — 지역 일치가 로컬/네트워크보다 우선, 다른 언어 음성은 절대 안 고름. 소리로만 드러나는 결함이라 이것 말고는 자동 검증 수단이 없다 |
| `learning.srs.test.js` | 간격 반복 스케줄(D-92) — 틀리면 처음으로·맞히면 다음 칸·마지막 칸 넘기면 졸업, 옛 `weak: true` 형식 방어. 깨져도 화면엔 표시가 안 나고 며칠 기다려야 드러나는 종류 |
| `learning.cloud.test.js` | 진행률 병합 — 진도는 앞선 쪽, **weak는 합집합**(D-90 A-5). 조용히 깨지면 복습 목록이 사라지는데 화면엔 표시가 안 나서 테스트로 묶었다 |
| `og-shells.test.js` | OG 셸과 카드 데이터 일치 · `_redirects` 규칙 순서(와일드카드가 항상 마지막) |

> 새 검사를 추가했으면 **버그를 일부러 되살려 빨간불이 뜨는지 확인**한다 — 초록불만 보면
> 검사가 비어 있어도 모른다(`.claude/rules/js-modules.md`).
