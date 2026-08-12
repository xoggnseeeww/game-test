# numpath-architecture — NumPath: Stack & Clear

> `docs/architecture.md`에서 분리된 NumPath 전용 상세. 15KB 자동 분리 규칙(같은 파일 헤더 참고)에
> 따라 2026-07-28(추가 당시 본문이 15KB를 넘겼을 때) 처음부터 여기로 옮겨 실렸다. 모듈맵·라우터
> 계약·화면 표는 `docs/architecture.md`에 남아 있고, 여긴 게임 흐름·로직 개요만 있다.

## 흐름

`numpath-intro`에서 난이도(쉬움/보통/어려움)를 고르고 "런 시작하기"를 누르면
`state.numpath.run`(시드·난이도·스테이지·별점·시작/종료 시각)을 만들고 `numpath-play`로
이동한다. `numpath-play`는 스테이지가 바뀔 때마다 `go()`로 화면을 다시 그리지 않고 HUD·보드만
갈아끼운다(ADHD `test-question`/반응속도 게임과 같은 in-place 렌더 패턴 — 안 그러면 광고 슬롯이
스테이지마다 새로 만들어져 `refreshAds()`가 반복 실행된다). 마지막 스테이지를 클리어하면
`numpath-ad` → `numpath-result`로 이어진다.

**퍼즐 보드 자체는 `state`에 저장하지 않는다** — `generatePuzzle(seed, stageIndex, difficultyId)`가
결정적이라 매번 다시 만들어도 완전히 같은 보드가 나오고, 그래야 뒤로가기(popstate)로 재진입해도
최소한 "몇 번째 스테이지인지"는 잃지 않는다(진행 중이던 이동·소멸은 다른 게임들처럼 화면 지역
변수라 초기화됨). 런 시드는 시작할 때마다 `Math.random`으로 새로 뽑으므로 **매 런 보드가 다르다** —
결정성은 "한 런 안에서의 재현"용이지 판마다 같은 문제를 내려는 게 아니다.

`numpath-play`는 `theme-game`(반응속도 게임과 같은 초록 팔레트)을 재사용한다 — 새 테마를 만들지
않았다. 공유 URL은 심리테스트와 달리 슬러그 없는 게임 주소 `${origin}/game/numpath` 그대로다
(`docs/architecture.md` §7 참고, `docs/decisions/2027-h1.md` D-29).

## 난이도 (D-54)

`data.js`의 `DIFFICULTIES` — 난이도 하나는 `LEVELS` 인덱스 배열(`stages`)로 자기 커브와
스테이지 수를 함께 정의한다(쉬움 5 · 보통 7 · 어려움 9). 레벨 파라미터 튜닝은 `LEVELS` 표
한 곳에만 있고, 난이도는 그 표를 어떤 순서·길이로 도는지만 정한다. 커브 밖 인덱스는 마지막
레벨을 이어 쓰는 안전망(`levelFor`)이 있다. 인트로에서 고른 난이도는 `state.numpath.difficulty`
(세션 한정)에 남아 다음 런의 기본값이 된다.

## 이동 제한 강제 (D-60)

`puzzle.moveLimit`(생성기가 `pathLen + slack`으로 정함)은 처음부터 데이터로 있었고
`solve.js`도 탐색 상한으로 써 왔지만, 플레이 화면(`play.js`)은 HUD에 "이동 횟수 X / Y"를
보여주고 다 쓰면 메시지만 띄울 뿐 실제로 이동을 막지는 않았다 — 그래서 퍼즐이 항상 풀리는
것(역산 생성)과 겹쳐 클리어에 실패 리스크가 전혀 없었다. `attemptMove()`에
`isOutOfMoves(puzzle, playState)` 가드를 추가해 제한 도달 시 이동을 실제로 차단하고,
`renderBoard()`도 그 시점에 `np-board--locked`(클리어 때와 같은 클래스)를 씌워 CSS
`pointer-events: none`으로 한 번 더 막는다. `canEnter()`(engine.js)는 건드리지 않았다 —
거기서 moveLimit까지 검사하면 `isStuck()`(갈 곳 없음)과 `isOutOfMoves()`(제한 소진)가 항상
동시에 true가 돼 "서로 배타적으로 판정된다"는 기존 계약이 깨진다.

## Lock/Warp 기믹 (D-61)

D-31에서 1차 범위를 좁히며 뺐던 두 기믹. **경로 밖 더미로만** 배치한다 — 경로 생성 로직
자체는 그대로다.

- **Lock**: `isValidEntry(cell, value)`에 `cell.gimmick === "lock" && value < cell.lockMin`
  조건이 하나 더 붙는다. 나눗셈 정수·뺄셈 양수 조건이 이미 만들던 "값 의존 간선"을 게임
  요소로 드러낸 것뿐이라 새 판정 체계가 아니다. `engine.js`(canEnter)·`solve.js`·
  `scripts/verify.cjs`의 독립 솔버가 전부 이 함수(또는 그 이식)만 보므로 세 곳이 갈라질
  걱정이 없다.
- **Warp**: 같은 `warpId`를 가진 두 칸이 짝이다. 먼저 밟힌 쪽이 트리거(자기 op 적용 후 즉시
  짝 칸으로 이동), 나머지는 도착 지점(자기 op 미적용) — 양쪽 다 트리거로 두면 서로를 계속
  트리거하는 무한 루프 위험이 있어 역할을 고정했다. `engine.warpLanding(puzzle, r, c)`가
  착지 좌표를 찾고(짝이 없으면 자기 자신), `applyMove()`가 트리거+착지 칸을 함께 visited
  처리하며 위치를 착지 칸으로 옮긴다. 이동 횟수는 1만 쓴다. `undo()`도 둘 다 되돌린다.
  `solve.js`는 `warpLanding()`을 그대로 가져다 쓰고, `scripts/verify.cjs`는 파일 관례대로
  (페이지 엔진 재사용 안 함) 같은 로직을 독립적으로 재구현한다.

레벨 표(`data.js`)의 `gimmicks.lock`/`gimmicks.warp`(warp는 칸 수가 아니라 "쌍" 개수)로
난이도별 밀도를 정한다. 가장 쉬운 레벨(0)만 기믹 없이 순수 사칙연산으로 남아 있다. 자리가
모자라면(레벨 설정 실수 등) `generate.js`의 `buildBoard()`가 조용히 순수 더미로 남긴다 —
기믹은 장식이라 필수 조건이 아니고, 경로 자체는 항상 풀리게 보장돼 있다.

## 런 타이머 + 개인 최고 기록 (D-59)

플레이 HUD에 실시간 타이머(m:ss, `formatTime()`)가 흐르고, 결과 화면에 이번 런 소요 시간과
난이도별 개인 최고 기록(신기록 배지 또는 기존 기록과 비교)을 보여준다. `run.startedAt`은
런 시작 시각, `run.finishedAt`은 마지막 스테이지를 클리어한 시각(광고 게이트를 거치는 동안
표시 시간이 안 흔들리도록 그 순간 고정) — 둘 다 `Date.now()`. 타이머 표시는 매 tick마다
`Date.now() - startedAt`을 다시 계산해서 드리프트가 없다.

최고 기록은 `localStorage["gt_numpath_best_<난이도>"]`에 저장한다(`screens.js`의
`loadBestTime`/`saveBestTime` 두 곳에만 접근 격리). **로그인·멀티유저 랭킹이 아니라 이 기기
로컬 기록이다** — 여러 사용자를 비교하려면 아래 "되돌린 보상 체계"에서 지운 Supabase 백엔드를
다시 켜야 해서, 요청("사용자 랭킹")의 범위를 사용자 확인 하에 로컬 기록으로 좁혔다.

## 되돌린 보상 체계 — 넘버 마을·클라우드 동기화 (D-54/D-55, 되돌림)

한때 스테이지 클리어마다 코인을 지급하고(`village.js`) `numpath-village` 화면에서 건물을
지어 마을을 완성해 나가는 보상 루프가 있었고, 로그인 시 data-pantry.com과 같은 Supabase
프로젝트에 마을을 동기화하는 기능(`cloud.js`/`cloud-loader.js`)도 있었다. **메리트가 크지
않다는 판단으로 전부 되돌렸다** — 채울 "공간"이랄 게 딱히 없는 코인 경제였고, 클라우드
동기화는 백엔드 하나를 유지하는 비용에 비해 얻는 게 적었다. 코드는 삭제됐고, Supabase
`numpath_village` 테이블만 비용이 없어 남겨뒀다(나중에 재사용 가능). 설계 배경·기각 이유
전문은 `docs/decisions/2027-h1.md` D-54·D-55에 그대로 남아 있다 — **다시 제안하지 말 것**,
재검토하려면 "더 큰 그림"이 먼저 나와야 한다는 게 그때 결정이었다.

## 게임 로직 개요

```
js/games/numpath/
  data.js       레벨 커브(LEVELS) · 난이도(DIFFICULTIES·stageCountFor·levelFor) · MAX_STARS · starsFor() · formatTime()
  engine.js     순차 연산 · 이동 가능 판정(Lock 포함) · 이동/Undo(Warp 착지 포함) · 클리어/막힘 판정 (DOM 모름)
  generate.js   역산 생성기: 스테이지별 시드 파생(stageSeed) → 경로 → 수식 배치 → 더미/기믹(Block·Multiplier·Lock·Warp) 채우기 → solve()로 검증 (DOM 모름)
  solve.js      DFS 솔버: 해 개수(상한까지) · 최적 이동수, 노드 예산으로 종료 보장 (DOM 모름)
  audio.js      Web Audio 피치 스케일링 SFX (외부 파일 없음)
  play.js       플레이 화면 — in-place 렌더, 타이머 tick 포함 (screens.js와 분리)
  screens.js    인트로(난이도 선택) · 광고 게이트 · 결과(타이머·최고 기록) · loadBestTime/saveBestTime
  index.js      디스크립터
```

### 타일 모델

기획서의 NUM/OP 분리 대신, 타일 하나가 `{ op, operand }`를 함께 들고 모든 이동이 값 하나를
바꾼다(경로가 OP→NUM 교대를 강제받아 막다른 길이 되는 문제를 피한다). Multiplier Tile은 새 규칙이
아니라 `op:"*"` 타일의 특수화(표시용 태그일 뿐 연산은 동일)이고, Block Tile은 진입 불가 칸이다.
Lock·Warp도 이제 있다(D-61, 아래 절 참고) — 둘 다 op/operand는 그대로 두고 진입·이동 처리에만
조건/부가효과가 붙는 특수화라, gimmick 필드 하나로 표현 가능한 이 모델의 확장으로 자연스럽게 들어갔다.

### v1 불변식 — 값은 항상 양의 정수

`engine.isValidEntry()`가 나눗셈이 정수로 안 떨어지거나 뺄셈이 0 이하로 내려가는 칸의 진입을
막는다. 이게 "진행 순서 강제"의 기본형이고, Lock Tile(D-61)의 `lockMin` 조건도 같은 함수
안에 한 줄로 얹혀 있다. `generate.js`는 경로 위에서 이 조건을 지키며 숫자/연산자를
배치하고(÷는 그 시점 값의 약수만 골라 배치), 경로 밖 더미 타일은 값과 무관한 범위로
채운다(플레이 중 `canEnter()`가 그때그때 판정한다).

### 생성 → 검증 루프

`generatePuzzle(seed, stageIndex, difficultyId)`: ⓪런 시드에서 `stageSeed()`로 스테이지 전용
시드를 파생한다 — 예전엔 런 시드를 그대로 써서 레벨 설정이 같은 두 스테이지가 완전히 같은
보드로 나오는 버그가 있었다(회귀 테스트 있음) ①시드 PRNG로 self-avoiding 경로를 백트래킹으로
찾는다 ②경로에 순차 배치하며 목표값 산출, 레벨의 `targetRange` 밖이면 재시도 ③경로 밖 칸에
Block/Multiplier/Lock/Warp 기믹과 더미 타일 배치 ④`solve()`로 해 개수 검증 — 상한을 넘으면 다음 시도로,
시도 예산(`GENERATION_ATTEMPTS`)을 다 쓰면 마지막 후보를 그대로 채택한다(역산이라 해가 최소
1개는 있다는 게 보장돼 있다).

### 별 판정 (`starsFor()`)

3성 = 최적 이동수(`solve()`의 `minMoves`)와 동일, 2성 = 남은 여유(slack)의 절반 이하 사용, 1성 =
클리어. 힌트가 없는 1차 범위라 "힌트 미사용" 조건은 없다 — 힌트를 넣을 때 `solve()`를 그대로
재사용해 추가한다.
