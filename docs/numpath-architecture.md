# numpath-architecture — NumPath: Stack & Clear

> `docs/architecture.md`에서 분리된 NumPath 전용 상세. 15KB 자동 분리 규칙(같은 파일 헤더 참고)에
> 따라 2026-07-28(추가 당시 본문이 15KB를 넘겼을 때) 처음부터 여기로 옮겨 실렸다. 모듈맵·라우터
> 계약·화면 표는 `docs/architecture.md`에 남아 있고, 여긴 게임 흐름·로직 개요만 있다.

## 흐름

`numpath-intro`에서 난이도(쉬움/보통/어려움)를 고르고 "런 시작하기"를 누르면
`state.numpath.run`(시드·난이도·스테이지·별점·이번 런 코인)을 만들고 `numpath-play`로
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

## 난이도 (D-34)

`data.js`의 `DIFFICULTIES` — 난이도 하나는 `LEVELS` 인덱스 배열(`stages`)로 자기 커브와
스테이지 수를 함께 정의한다(쉬움 5 · 보통 7 · 어려움 9). 레벨 파라미터 튜닝은 `LEVELS` 표
한 곳에만 있고, 난이도는 그 표를 어떤 순서·길이로 도는지만 정한다. 커브 밖 인덱스는 마지막
레벨을 이어 쓰는 안전망(`levelFor`)이 있다. 인트로에서 고른 난이도는 `state.numpath.difficulty`
(세션 한정)에 남아 다음 런의 기본값이 된다.

## 보상 — 넘버 마을 (D-34)

스테이지를 클리어하면 그 자리에서 코인(받은 별 × 난이도의 `coinsPerStar`)을 지급하고
`localStorage["gt_numpath_village"]` 지갑에 적립한다 — 런을 끝까지 못 가도 클리어한 만큼은 남는다.
코인으로 `numpath-village` 화면(`/game/numpath/village`, 런과 무관하니 guard 없음)에서 건물을
하나씩 지어 마을을 완성해 나간다. 판정·계산(`coinsFor`/`buildItem`/`canBuild` 등)은
`village.js`의 순수 함수고, localStorage 접근은 `loadVillage`/`saveVillage` 두 곳에만 격리돼
있다(프라이버시 모드에서 throw해도 빈 마을로 폴백). 이 저장이 D-20(반응속도 최고기록 제거)과
어떻게 다른지는 D-34 참고 — **반응속도 기록을 되살리는 근거로 쓰지 말 것**.

## 게임 로직 개요

```
js/games/numpath/
  data.js       레벨 커브(LEVELS) · 난이도(DIFFICULTIES·stageCountFor·levelFor) · MAX_STARS · starsFor()
  engine.js     순차 연산 · 이동 가능 판정 · 이동/Undo · 클리어/막힘 판정 (DOM 모름)
  generate.js   역산 생성기: 스테이지별 시드 파생(stageSeed) → 경로 → 수식 배치 → 더미/기믹 채우기 → solve()로 검증 (DOM 모름)
  solve.js      DFS 솔버: 해 개수(상한까지) · 최적 이동수, 노드 예산으로 종료 보장 (DOM 모름)
  village.js    보상: 코인 계산 · 건설 판정(순수 함수) + localStorage 저장 격리 (DOM 모름)
  audio.js      Web Audio 피치 스케일링 SFX (외부 파일 없음)
  play.js       플레이 화면 (in-place 렌더, screens.js와 분리)
  screens.js    인트로(난이도 선택) · 광고 게이트 · 결과 · 넘버 마을
  index.js      디스크립터
```

### 타일 모델

기획서의 NUM/OP 분리 대신, 타일 하나가 `{ op, operand }`를 함께 들고 모든 이동이 값 하나를
바꾼다(경로가 OP→NUM 교대를 강제받아 막다른 길이 되는 문제를 피한다). Multiplier Tile은 새 규칙이
아니라 `op:"*"` 타일의 특수화(표시용 태그일 뿐 연산은 동일)이고, Block Tile은 진입 불가 칸이다.
Lock·Warp 기믹은 1차 범위에서 뺐다.

### v1 불변식 — 값은 항상 양의 정수

`engine.isValidEntry()`가 나눗셈이 정수로 안 떨어지거나 뺄셈이 0 이하로 내려가는 칸의 진입을
막는다. 이게 Lock Tile 없이도 "진행 순서 강제"를 만든다. `generate.js`는 경로 위에서 이 조건을
지키며 숫자/연산자를 배치하고(÷는 그 시점 값의 약수만 골라 배치), 경로 밖 더미 타일은 값과
무관한 범위로 채운다(플레이 중 `canEnter()`가 그때그때 판정한다).

### 생성 → 검증 루프

`generatePuzzle(seed, stageIndex, difficultyId)`: ⓪런 시드에서 `stageSeed()`로 스테이지 전용
시드를 파생한다 — 예전엔 런 시드를 그대로 써서 레벨 설정이 같은 두 스테이지가 완전히 같은
보드로 나오는 버그가 있었다(회귀 테스트 있음) ①시드 PRNG로 self-avoiding 경로를 백트래킹으로
찾는다 ②경로에 순차 배치하며 목표값 산출, 레벨의 `targetRange` 밖이면 재시도 ③경로 밖 칸에
Block/Multiplier 기믹과 더미 타일 배치 ④`solve()`로 해 개수 검증 — 상한을 넘으면 다음 시도로,
시도 예산(`GENERATION_ATTEMPTS`)을 다 쓰면 마지막 후보를 그대로 채택한다(역산이라 해가 최소
1개는 있다는 게 보장돼 있다).

### 별 판정 (`starsFor()`)

3성 = 최적 이동수(`solve()`의 `minMoves`)와 동일, 2성 = 남은 여유(slack)의 절반 이하 사용, 1성 =
클리어. 힌트가 없는 1차 범위라 "힌트 미사용" 조건은 없다 — 힌트를 넣을 때 `solve()`를 그대로
재사용해 추가한다.
