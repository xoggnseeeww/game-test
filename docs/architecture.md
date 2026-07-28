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
  router.js             화면 레지스트리 · 경로 해석 · guard · teardown · 테마 · history · 렌더 후 refreshAds()
  state.js              단일 상태 객체 (테스트별 네임스페이스)
  dom.js                el() · bindNav() · showModal() · bindAdGate()(광고 게이트 카운트다운)
  share.js              공유 URL · navigator.share · 결과 카드 캔버스
  util.js               shuffle · normalizePath · roundRect · localStorage 방어 래퍼
  ads.js                카카오 AdFit — adSlotMarkup()(단위 코드 단일 소스) · adGateMarkup()(전면 게이트 마크업) · refreshAds()(로더 태그 재실행)
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
| `/test/adhd/result` | `test-result` | — | 답 부족 → `test-intro`, 게임 미완료 → `reaction-intro` |
| `/test/adhd/result/<slug>` | `test-shared` | — | 슬러그 안 풀리면 → `home` |
| `/test/adhd/reaction` | `reaction-intro` | game | 답 부족 → `test-intro` |
| `/test/adhd/reaction/play` | `reaction-play` | game | 답 부족 → `test-intro` |
| `/test/adhd/reaction/ad` | `reaction-ad` | game | 답 부족 → `test-intro`, 게임 미완료 → `reaction-intro` |
| `/test/disc` | `disc-intro` | disc | — |
| `/test/disc/play` | `disc-question` | disc | 순서 미생성 → `disc-intro` |
| `/test/disc/result` | `disc-result` | disc | 문항 미완료 → `disc-intro` · 문항은 끝났지만 게임 미완료 → `dilemma-intro` |
| `/test/disc/result/<slug>` | `disc-shared` | disc | 슬러그 안 풀리면 → `home` |
| `/test/disc/dilemma` | `dilemma-intro` | disc | 문항 미완료 → `disc-intro` |
| `/test/disc/dilemma/play` | `dilemma-play` | disc | 문항 미완료 → `disc-intro` |
| `/test/disc/dilemma/ad` | `dilemma-ad` | disc | 문항 미완료 → `disc-intro`, 게임 미완료 → `dilemma-intro` |

> ADHD 화면 id가 `test-*`인 것은 DISC보다 먼저 만들어졌기 때문이다. **이름을 바꾸지 않는다**(위 §2).

**두 테스트 모두 딸린 게임이 결과 화면 뒤의 선택 보너스가 아니라, 마지막 문항 직후 반드시
거쳐야 하는 필수 단계로 통합돼 있다.** 게임 없이는(직접 URL 접속 포함) 결과를 볼 수 없고,
별도의 "게임 결과" 화면도 없다 — 게임이 끝나면 광고 게이트를 한 번 거쳐 검사 결과로 이동해
하나의 결과로 합쳐 보여준다.

- **DISC**: 문항(12) → 딜레마 게임(8라운드) → 광고 게이트(`dilemma-ad`) → 결과. 12번째
  문항을 답하면 `dilemma-intro`로 넘어가고, `disc-result`의 guard가 게임 완료를 요구한다.
  `dilemma-play`의 `finish()`가 `state.disc.dilemma`를 채운 뒤 `dilemma-ad`로 이동하며,
  게임이 실제로 유형에 영향을 줬을 때만 "⚡ 딜레마 게임 결과 반영됨" 줄이 붙는다
  (`docs/DECISIONS.md` D-18). 뒤로가기는 두 지점: `dilemma-intro`→`disc-question`(그 guard가
  이미 "답이 다 차 있으면 마지막 문항으로 되돌림"을 하므로 별도 상태 없이 재사용),
  `dilemma-play`→`dilemma-intro`(문항 답변은 유지한 채 게임만 재시작).
- **ADHD**: 문항(12) → 반응속도 게임 → 광고 게이트(`reaction-ad`) → 결과. `test-question`이
  마지막 문항 응답 직후 `reaction-intro`로 넘어가고, `test-result`의 guard가
  `state.lastReaction` 없이는 결과를 보여주지 않는다. 게임 통계는 `test-result`에 병합돼
  하나의 결과로 나온다(`docs/DECISIONS.md` D-19).
- **광고 게이트(`reaction-ad`/`dilemma-ad`)**: `core/ads.js`의 `adGateMarkup()` + `core/dom.js`의
  `bindAdGate()`로 구성. 300×250 AdFit 광고 단위(`interstitial`)를 3초 카운트다운 뒤 "결과
  보러 가기" 버튼이 활성화되는 방식으로, AdFit 웹 SDK에 없는 자동 전환 전면광고를 대신한다.
  `.exit-btn`(홈)은 카운트다운과 무관하게 항상 즉시 동작 — 강제 시청이 아니라 잠깐 보게
  하는 정도로, 이탈률을 올리지 않는 선에서 노출 기회를 하나 늘리는 게 목적이다.

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

**메모리 전용이다.** 새로고침하면 초기화된다. 영속 데이터는 없다 — 예전엔 `localStorage["gt_reaction_best"]`로
반응속도 최고기록을 저장했으나, 게임의 "빠를수록 좋다"는 프레이밍이 채점 철학(D-5, 빠른 반응 ≠ 충동적)과
충돌해서 제거했다(D-20).

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
- 딜레마 게임: 문항과 같은 형식(상황 8개 × D/I/S/C 4지선다, most만 — least 단계는 없음).
  8라운드 중 한 축이 절반(4개) 이상이면 +1, 3/4(6개) 이상이면 +2. 고르게 흩어지면 보너스 없음.
  클릭 타이밍은 더 이상 안 본다(`docs/DECISIONS.md` D-24 — 예전엔 2택 선택지 + 지연시간
  추론이었는데 지연시간 신호가 잘 흔들려서 4택으로 바꿨다)

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
| `test/adhd.score.test.js` | 반응 코멘트가 억제 실패×누락 9개 조합 모두 다른 문장을 주는가 / 게임 보너스 임계값 / 이미 100%인 축엔 보너스가 안 보이는가 |
| `test/copy.test.js` | 화면 문구의 개수가 데이터에서 파생되는가 (`docs/ERRORS.md` E-1) |

**여기서 안 잡히는 것**: 라우팅·이벤트 바인딩·타이머·레이아웃 → `scripts/verify.cjs`(헤드리스 브라우저)의 몫이다.
