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

---

## 1. 모듈맵

브라우저 네이티브 ES 모듈. 번들러가 없으므로 **import 경로는 실제 파일 경로 그대로**이며 확장자 `.js`가 필수다.

```
js/main.js              부팅. registerScreens / registerTest 호출 후 start()
js/core/
  router.js             화면 레지스트리 · 경로 해석 · guard · teardown · 테마 · history
  state.js              단일 상태 객체 (테스트별 네임스페이스)
  dom.js                el() · bindNav() · showModal()
  share.js              공유 URL · navigator.share · 결과 카드 캔버스
  util.js               shuffle · normalizePath · roundRect · localStorage 방어 래퍼
js/screens/home.js      홈 · 심리테스트 목록 · 미니게임 목록 + commonScreens
js/tests/<id>/
  data.js               문항·결과 유형·슬러그·게임 상수 (단일 소스)
  score.js              채점 (DOM을 모른다 → node --test로 직접 검증 가능)
  screens.js            렌더 함수
  index.js              디스크립터: <id>Test(메타) + <id>Screens(화면 배열)
```

**의존 방향**: `tests/*` → `core/*`. `core`는 테스트를 모른다.
`screens/home.js`는 `listTests()`로 등록된 테스트를 조회할 뿐, 개별 테스트를 import 하지 않는다 — **테스트를 추가해도 홈 화면 파일은 안 고친다.**

**`score.js`가 DOM을 모른다는 점이 중요하다.** 채점 로직만 순수 함수로 떼어놨기 때문에 `node --test`에서 브라우저 없이 검증된다(§8).

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
| `theme` | `adhd` \| `game` \| `disc`. `document.body`에 `theme-*` 클래스를 붙인다 (모달이 body에 붙기 때문에 `#app`이 아니라 body) |
| `guard` | 지금 이 화면을 띄우면 안 될 때 **대신 갈 화면 id**를 반환. falsy면 그대로 진행. 최대 5홉까지 재검사 |
| `dynamicPath` | 슬러그가 붙어 주소가 하나로 안 정해지는 화면(공유 결과). 주소를 건드리지 않고 `history.state`만 채운다 |

**`setScreen()` 흐름**: `runTeardowns()` → `resolveScreen()`(guard 연쇄) → 테마 클래스 교체 → `render()` → 스크롤 리셋 → `title` → history push/replace.

**`onLeave(fn)`** — 화면을 떠날 때 정리할 것을 등록한다. 타이머뿐 아니라 `requestAnimationFrame`도 여기로 보낸다.
`runTeardowns()`는 각 콜백을 try/catch로 감싸므로, 정리 중 하나가 터져도 화면 전환은 계속된다.

**공유 주소 해석**: `parseSharedPath()`가 `/test/<testId>/result/<slug>`를 등록된 테스트의 `slugToKey`로 푼다.
슬러그가 없는 `/test/adhd/result`는 여기 안 걸리고 일반 경로로 처리된다.

## 3. 화면 표

| 경로 | id | 테마 | guard |
|------|-----|------|-------|
| `/` | `home` | — | — |
| `/test` | `psych-list` | — | — |
| `/game` | `game-list` | — | — |
| `/test/adhd` | `test-intro` | — | — |
| `/test/adhd/play` | `test-question` | — | 답이 다 차 있으면 마지막 문항으로 되돌림 |
| `/test/adhd/result` | `test-result` | — | 답 부족 → `test-intro` |
| `/test/adhd/result/<slug>` | `test-shared` | — | 슬러그 안 풀리면 → `home` |
| `/test/adhd/reaction` | `reaction-intro` | game | — |
| `/test/adhd/reaction/play` | `reaction-play` | game | — |
| `/test/adhd/reaction/result` | `reaction-result` | game | 결과 없음 → `reaction-intro` |
| `/test/disc` | `disc-intro` | disc | — |
| `/test/disc/play` | `disc-question` | disc | 순서 미생성 → `disc-intro` |
| `/test/disc/result` | `disc-result` | disc | 문항 미완료 → `disc-intro` · 문항은 끝났지만 게임 미완료 → `dilemma-intro` |
| `/test/disc/result/<slug>` | `disc-shared` | disc | 슬러그 안 풀리면 → `home` |
| `/test/disc/dilemma` | `dilemma-intro` | disc | 문항 미완료 → `disc-intro` |
| `/test/disc/dilemma/play` | `dilemma-play` | disc | 문항 미완료 → `disc-intro` |

> ADHD 화면 id가 `test-*`인 것은 DISC보다 먼저 만들어졌기 때문이다. **이름을 바꾸지 않는다**(위 §2).

**DISC는 문항(12) → 딜레마 게임(8라운드) → 결과 순으로 강제된다.** 딜레마 게임은 더 이상
결과 화면에서 선택적으로 들어가는 보너스 콘텐츠가 아니다 — 12번째 문항을 답하면 곧바로
`dilemma-intro`로 넘어가고, 게임이 끝나야 `disc-result`의 guard를 통과한다. 별도의
"게임 결과" 화면(`dilemma-result`)은 없다 — `dilemma-play`의 `finish()`가
`state.disc.dilemma`를 채운 뒤 바로 `disc-result`로 이동하고, 게임이 실제로 유형에
영향을 줬을 때만 결과 화면에 "⚡ 딜레마 게임 결과 반영됨" 줄이 붙는다(`docs/DECISIONS.md` D-18).

뒤로가기는 이 강제 순서 위에서 두 지점만 마련돼 있다: `dilemma-intro`의 뒤로가기는
`disc-question`으로 가는데, 그 guard가 이미 "답이 다 차 있으면 마지막 문항으로 되돌림"을
하므로 별도 상태 없이 마지막 문항(2단계)을 다시 풀게 된다. `dilemma-play`의 뒤로가기는
`dilemma-intro`로 돌아가 게임을 처음부터 다시 시작할 수 있게 한다(문항 답변은 그대로 남는다).

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
}
```

**메모리 전용이다.** 새로고침하면 초기화된다. 영속되는 건 `localStorage["gt_reaction_best"]` 하나뿐.

`disc.pending`이 state에 있는 이유: `render()`가 매번 DOM을 버리므로, 반쪽 답을 지역 변수에 두면 뒤로가기·popstate에서 사라진다.

## 5. 테스트 추가 절차

1. `js/tests/<id>/` 폴더 생성 — `data.js` / `score.js` / `screens.js` / `index.js`
2. `index.js`에서 `<id>Test`(메타: `id`, `slugToKey`, `sharedScreen`, `card`)와 `<id>Screens`(화면 배열) export
3. `js/main.js`에서 `registerTest(<id>Test)` **와** `registerScreens(<id>Screens)` **둘 다** 호출
4. `npm test` — 화면 id·경로 중복과 import/export 누락을 잡아준다

홈·목록 화면은 고치지 않는다. `renderPsychList()`가 `listTests()`로 카드를 만든다.

## 6. 채점 파이프라인

### ADHD (`js/tests/adhd/score.js`)
```
답변 수집   → 역채점 문항은 (4 - value)로 저장
게임 보너스 → gameBonuses(state.lastReaction) → { impulse: 0~4, focus: 0~4 }
퍼센트      → toPct(raw + bonus), 분모 16 (= 축당 4문항 × 4점)
프로필 키   → 축별 >= AXIS_HIGH_THRESHOLD(60) → "010" 같은 3비트
유형        → RESULT_TYPES[key] (8종)
```
- `energy` 축에는 게임 보너스가 없다(근거 부재 — `docs/DECISIONS.md` D-6)
- 이미 100%인 축에는 보너스가 실제로 반영되지 않으므로 `visibleBonus`로 표시를 거른다

### DISC (`js/tests/disc/score.js`)
- **ipsative(강제선택)**: 상황마다 4개 선택지 중 "가장 나 같은 것"과 "아닌 것"을 고른다 → 축별 원점수 합은 **항상 0**
- 유형은 12종 (순수형 4 + 조합형 8). **대척점 조합(DS·SD·IC·CI)은 어떤 입력에도 나오지 않는다**
- 동점이면 결정론적으로 같은 답을 준다
- 딜레마 게임 보너스: 축당 최대 +1. 선택이 갈리거나 시간초과가 잦으면 신호를 버린다

## 7. 공유 · 결과 카드 (`js/core/share.js`)

- 공유 URL은 **결과별 슬러그 주소** `${origin}/test/<testId>/result/<slug>` — 페이지 자체 주소를 공유하면 친구는 빈 테스트만 본다(`docs/DECISIONS.md` D-7)
- 공유 버튼: `navigator.share`(모바일 네이티브 공유시트) → 없으면 클립보드 복사 폴백. 카카오 전용 SDK는 쓰지 않는다(D-8)
- 결과 카드는 canvas에 직접 그린다. `document.fonts.ready`를 먼저 기다려야 폰트가 적용된다(CDN 차단 환경에선 sans-serif 폴백)
- 이미지 저장은 canvas → blob → `<a download>`. **자동 첨부가 아니라 다운로드**다

## 8. 테스트 스위트

`npm test` (= `node --test`, 의존성 0). 브라우저 없이 도는 것만 여기 있다.

| 파일 | 무엇을 지키나 |
|------|---------------|
| `test/modules.test.js` | import가 실재하는 export를 가리키는가 / export 없이 쓰는 곳이 없는가 / 화면 id·경로 중복 없는가 |
| `test/disc.score.test.js` | DISC 채점 불변식 (합 0, 순서 무관, 결정론, 대척점 배제, 12유형 도달, 슬러그 왕복) |
| `test/copy.test.js` | 화면 문구의 개수가 데이터에서 파생되는가 (`docs/ERRORS.md` E-1) |

**여기서 안 잡히는 것**: 라우팅·이벤트 바인딩·타이머·레이아웃 → `scripts/verify.cjs`(헤드리스 브라우저)의 몫이다.
