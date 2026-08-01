// NumPath 레벨 커브 · 난이도 · 별 판정 상수. 로직은 engine.js/generate.js/solve.js,
// 화면은 play.js/screens.js.
//
// 난이도는 그리드 크기 · 허용 연산자 · 경로 길이(pathLen) · 이동 여유(slack) · 기믹 수 4가지로 결정한다.
// 기획서의 Difficulty Rating = GridArea*1.5 + OpComplexity*2.0 + GimmickCount*3.0 산출식은 이 표를
// 만들 때 순위를 매기는 데만 참고했고, 런타임에는 이 표를 직접 읽는다 — 공식을 다시 계산하는 것보다
// 표가 더 명확하고, 표를 보면 바로 다음 레벨과 비교할 수 있다.
export const LEVELS = [
  { size: 3, ops: ["+", "-"], pathLen: 4, slack: 2, gimmicks: { block: 0, multiplier: 0 }, targetRange: [10, 30], maxSolutions: 6 },
  { size: 3, ops: ["+", "-"], pathLen: 5, slack: 2, gimmicks: { block: 1, multiplier: 0 }, targetRange: [10, 30], maxSolutions: 6 },
  { size: 4, ops: ["+", "-", "*"], pathLen: 6, slack: 2, gimmicks: { block: 2, multiplier: 1 }, targetRange: [20, 100], maxSolutions: 8 },
  { size: 4, ops: ["+", "-", "*", "/"], pathLen: 7, slack: 2, gimmicks: { block: 2, multiplier: 1 }, targetRange: [20, 150], maxSolutions: 8 },
  { size: 5, ops: ["+", "-", "*", "/"], pathLen: 8, slack: 3, gimmicks: { block: 3, multiplier: 2 }, targetRange: [30, 300], maxSolutions: 10 },
  { size: 5, ops: ["+", "-", "*", "/"], pathLen: 9, slack: 3, gimmicks: { block: 4, multiplier: 2 }, targetRange: [30, 500], maxSolutions: 10 },
];

// 난이도 하나 = 레벨 표(LEVELS)를 참조하는 스테이지 커브 하나. stages는 LEVELS의 인덱스 배열이라
// "몇 스테이지짜리 런인지"(길이)와 "몇 번째 스테이지에 어떤 레벨이 나오는지"(값)를 한 곳에서 정한다.
export const DIFFICULTIES = [
  { id: "easy", name: "쉬움", emoji: "🌱", desc: "작은 보드로 가볍게 몸풀기", stages: [0, 0, 1, 1, 2] },
  { id: "normal", name: "보통", emoji: "🌿", desc: "사칙연산과 기믹이 다 나와요", stages: [0, 1, 2, 3, 3, 4, 4] },
  { id: "hard", name: "어려움", emoji: "🌶️", desc: "큰 보드 + 기믹 총출동", stages: [2, 3, 3, 4, 4, 5, 5, 5, 5] },
];

export const DEFAULT_DIFFICULTY = "normal";

export function difficultyById(id) {
  return DIFFICULTIES.find((d) => d.id === id) || DIFFICULTIES.find((d) => d.id === DEFAULT_DIFFICULTY);
}

export function stageCountFor(difficultyId) {
  return difficultyById(difficultyId).stages.length;
}

// stages 배열 밖 인덱스는 마지막 레벨을 이어 쓴다 — 커브를 나중에 줄여도(혹은 진행 중인 런의
// stageIndex가 어긋나도) 화면이 깨지는 대신 가장 어려운 레벨이 나오는 안전망이다.
export function levelFor(difficultyId, stageIndex) {
  const stages = difficultyById(difficultyId).stages;
  return LEVELS[stages[Math.min(stageIndex, stages.length - 1)]];
}

// 별 등급의 최대치. starsFor()가 반환하는 최댓값이자, 화면에서 "☆☆☆" 빈 칸 수를 채울 때도 쓴다.
export const MAX_STARS = 3;

// 3성: 최적 경로(solve()의 minMoves)와 이동 횟수가 같다.
// 2성: 남은 여유(moveLimit - minMoves, "slack")의 절반 이하만 썼다.
// 1성: 클리어.
//
// "이동 제한의 80%"처럼 moveLimit 기준 고정 비율로 재는 대신 minMoves 기준 slack의 절반으로
// 정의한다 — LEVELS의 slack이 pathLen 대비 작게(2~3) 잡혀 있어서, moveLimit*0.8이 항상
// minMoves 이하로 떨어져 2성 구간이 모든 레벨에서 통째로 사라지는 문제가 있었다
// (test/numpath.generate.test.js의 회귀 테스트가 이걸 잡는다).
export function starsFor({ movesUsed, moveLimit, minMoves }) {
  if (minMoves !== null && movesUsed <= minMoves) return 3;
  const twoStarThreshold = minMoves !== null ? minMoves + Math.ceil((moveLimit - minMoves) / 2) : Math.floor(moveLimit * 0.8);
  if (movesUsed <= twoStarThreshold) return 2;
  return 1;
}
