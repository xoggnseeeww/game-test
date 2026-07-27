# architecture — 과몰입구역

> 선택 로드 문서. `app.js` 안의 구조를 파악해야 할 때만 읽는다.
> ⚠️ **파일 크기 자동 분리 규칙**: 이 파일이 300줄(또는 15KB)을 넘으면, 이 문서를 수정하는 세션이 별도 지시 없이 즉시 분리한다 —
> 화면별 상세는 `docs/<screen>-architecture.md`로 떼고, 이 파일에는 모듈맵·라우트 표·상태 모양만 남긴다. 분리 후 `CLAUDE.md` 상세 문서 표에 행 추가.

## 인덱스
- 라우팅 · 화면 → §1
- 상태(state) 모양 → §2
- `app.js` 모듈맵 → §3
- 채점 파이프라인 (테스트) → §4
- 게임 파이프라인 (Go/No-Go) → §5
- 결과 카드 이미지 · 공유 → §6

---

## 1. 라우팅 · 화면

History API를 직접 쓴다. 서버는 `_redirects` 덕분에 모든 경로에 `index.html`을 준다.

| 경로 | 화면 키 | 렌더 함수 |
|------|---------|-----------|
| `/` | `home` | `renderHome()` |
| `/test` | `psych-list` | `renderPsychList()` |
| `/test/adhd` | `test-intro` | `renderTestIntro()` |
| `/test/adhd/play` | `test-question` | `renderQuestion()` |
| `/test/adhd/result` | `test-result` | `renderResult()` |
| `/test/adhd/result/<slug>` | `test-shared` | `renderTestShared()` |
| `/test/adhd/reaction` | `reaction-intro` | `renderReactionIntro()` |
| `/test/adhd/reaction/play` | `reaction-play` | `renderReactionPlay()` |
| `/test/adhd/reaction/result` | `reaction-result` | `renderReactionResult()` |
| `/game` | `game-list` | `renderGameList()` |

**흐름**: `setScreen()` 이 단일 관문 — 타이머 해제 → `resolveScreen()` 보정 → `render()` → 스크롤 리셋 → `document.title` → history push/replace.
`go(screen)` = `setScreen(screen, {push:true})`. `popstate`는 `{replace:true}`로 되돌린다.

**예외 2가지**
- `test-shared`: 슬러그마다 주소가 달라 "화면 하나 = 주소 하나"인 `SCREEN_TO_PATH` 가정이 깨진다. 주소를 건드리지 않고 `history.state`만 채운다.
- `resolveScreen()`: 뒤로가기로 URL만 바뀌어 화면-상태가 어긋나는 경우를 보정한다.
  - `test-result`인데 답변이 부족 → `test-intro`
  - `reaction-result`인데 `lastReaction` 없음 → `reaction-intro`
  - `test-question`인데 답변이 이미 다 참 → 마지막 답변 하나를 되돌림

## 2. 상태(state) 모양

```js
state = {
  screen: "home",        // 화면 키
  answers: [],           // [{ group: "focus"|"impulse"|"energy", value: 0~4 }] — 역채점은 이미 적용된 값
  lastReaction: null,    // summarizeGameResults() 반환값 + prematureCount
}
```

**메모리 전용이다.** 새로고침하면 전부 초기화된다.
영속되는 것은 `localStorage["gt_reaction_best"]`(반응속도 최고 기록) 하나뿐이며, 프라이버시 모드에서 접근 자체가 throw 할 수 있어 `bestReactionTime()` / `saveBestReactionTime()`이 try/catch로 감싼다.

## 3. `app.js` 모듈맵

단일 파일. 위에서 아래로 다음 순서로 배치돼 있다 (줄 번호는 참고용 — 함수명으로 찾을 것).

| 구역 | 대략 줄 | 내용 |
|------|---------|------|
| 문항 데이터 | ~1–32 | `QUESTIONS`(12문항, 축당 4개 · 축당 1개는 `reverse`), `OPTIONS`(5단계 0~4점) |
| 결과 유형 | ~34–110 | `AXIS_HIGH_THRESHOLD`, `profileKey()`, `RESULT_TYPES`(3비트 키 8종) |
| 공유 슬러그 | ~112–130 | `SLUG_TO_PROFILE` / `PROFILE_TO_SLUG` / `sharedProfileFromPath()` |
| 게임 상수·집계 | ~131–167 | `CPT_*`, `shuffle()`, `summarizeGameResults()` |
| 상태·라우팅 | ~169–300 | `state`, `ROUTES`, `normalizePath()`, `pathToScreen()`, `render()`, `resolveScreen()`, `SCREEN_TITLES`, `setScreen()`, `go()`, `popstate` |
| DOM 유틸 | ~287–323 | `el()`, `bindNav()`, `showModal()` |
| 테스트 화면 | ~324–480 | `renderHome()`, `renderPsychList()`, `renderTestIntro()`, `renderQuestion()` |
| 채점 | ~482–563 | `gameBonuses()`, `computeResult()`, `axisIntensityText()`, `axisBreakdown()` |
| 결과 카드 | ~564–655 | `roundRect()`, `drawResultCard()` (canvas 1080×1080) |
| 결과 화면 | ~656–810 | `renderResult()`, `renderTestShared()`, `renderGameList()` |
| 게임 화면 | ~827–1069 | `bestReactionTime()`, `saveBestReactionTime()`, `renderReactionIntro()`, `renderReactionPlay()`, `reactionComment()`, `renderReactionResult()` |
| 부트스트랩 | 마지막 줄 | `setScreen(pathToScreen(location.pathname), { replace: true })` |

**렌더링 방식**: 각 `render*()`가 템플릿 문자열 → `el()` → `app.appendChild()`. `render()`가 매번 `app.innerHTML = ""`로 전체 교체한다.
→ **DOM은 매 전환마다 버려지므로, 화면 밖에 남는 것은 타이머와 전역 리스너뿐이다.** 새 화면에서 `setTimeout`을 쓰면 반드시 `reactionTimer`처럼 해제 경로를 만든다.

## 4. 채점 파이프라인 (테스트)

```
답변 수집        renderQuestion()   → reverse 문항은 (4 - value)로 저장
  ↓
게임 보너스      gameBonuses()      → state.lastReaction → { impulse: 0~4, focus: 0~4 }
  ↓
퍼센트 환산      computeResult()    → toPct(raw + bonus), 분모 16 (= 축당 4문항 × 4점)
  ↓
프로필 키        profileKey()       → 축별 >= AXIS_HIGH_THRESHOLD(60) 여부 → "010" 같은 3비트
  ↓
유형 조회        RESULT_TYPES[key]  → 8종
```

**주의 지점**
- `energy` 축에는 게임 보너스가 없다 — 과잉행동을 Go/No-Go로 잰다는 근거가 없어 의도적으로 뺐다.
- 보너스가 이미 100%인 축에는 실제로 반영되지 않으므로, `visibleBonus`로 "반영된 보너스만" 화면에 표시한다.
- 유형은 8종 고정이지만 유형 안에서도 퍼센트에 따라 `axisIntensityText()`가 다른 문장을 준다.

## 5. 게임 파이프라인 (Go/No-Go)

`CPT_ROUNDS`(14) 라운드 중 `CPT_NOGO_COUNT`(4)가 no-go. `shuffle()`로 순서를 섞는다.

| 신호 | 정답 | 오답 이름 |
|------|------|-----------|
| 초록(go) | 누른다 | 누락(omission) — `CPT_GO_WINDOW`(1000ms) 내 무반응 |
| 주황(no-go) | 참는다 | 억제 실패(commission) — `CPT_NOGO_WINDOW`(1000ms) 내 누름 |

신호가 뜨기 전에 누르면 **성급한 반응(premature)** — 그 라운드는 소모하지 않고 다시 진행하되 `prematureCount`에 누적된다.

`summarizeGameResults()` 산출: `goCount`, `noGoCount`, `avgRt`, `rtSD`, `omissionErrors`, `commissionErrors`, `accuracy`.
→ `gameBonuses()`가 이걸 충동/집중 보너스로 환산한다. 근거와 기각안은 `docs/DECISIONS.md`.

## 6. 결과 카드 이미지 · 공유

- `drawResultCard(r)` — 1080×1080 canvas에 직접 그린다. `document.fonts.ready`를 먼저 기다려야 Pretendard가 적용된다(CDN 차단 환경에서는 sans-serif로 폴백).
- 공유 URL은 **결과별 슬러그 주소** `${origin}/test/adhd/result/<slug>` — 페이지 자체 주소를 공유하면 친구는 빈 테스트만 본다(`docs/DECISIONS.md` 되돌림 항목).
- 공유 버튼은 `navigator.share`(모바일 네이티브 공유시트) → 없으면 클립보드 복사로 폴백. 카카오 전용 SDK는 쓰지 않는다.
- 이미지 저장은 canvas → blob → `<a download>` 클릭. **자동 첨부가 아니라 다운로드**다.
