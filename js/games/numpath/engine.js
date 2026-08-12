// 순수 게임 로직: 순차 연산 · 이동 가능 판정 · 이동/Undo · 클리어/막힘 판정.
// DOM을 모른다 — score.js와 같은 이유로 node --test가 브라우저 없이 이 파일을 검증한다.
//
// 보드 칸(cell) 모양: { type: "start"|"tile"|"block", op, operand, gimmick, value, lockMin?, warpId? }
//  - "start": op/operand/gimmick는 null, value가 시작 숫자
//  - "tile": op("+"|"-"|"*"|"/")와 operand(양의 정수)가 항상 세트. gimmick은
//            "multiplier"|"lock"|"warp"|null
//     - multiplier: 새 규칙이 아니라 op:"*" 타일의 특수화 — 표시용 태그일 뿐 연산은 동일
//     - lock: op/operand는 그대로 적용되지만, 진입 자체에 lockMin(현재값 >= lockMin) 조건이
//       하나 더 붙는다. 나눗셈·뺄셈이 이미 만들던 "값 의존 간선"(D-31)을 게임 요소로 드러낸 것
//     - warp: op/operand 적용은 그대로, 추가로 같은 warpId를 가진 짝 칸으로 즉시 이동한다
//       (짝 칸 자체의 op는 적용되지 않는다 — "도착 지점"일 뿐). warpLanding() 참고
//  - "block": 진입 불가. op/operand/gimmick 전부 null
//
// 퍼즐(puzzle) 모양: { size, board, start:{r,c,value}, target, moveLimit }
// 플레이 상태(state) 모양: { r, c, value, visited:Set<string>, movesUsed, history:[] }

export const DIRS = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
];

export function posKey(r, c) {
  return `${r},${c}`;
}

export function inBounds(puzzle, r, c) {
  return r >= 0 && r < puzzle.size && c >= 0 && c < puzzle.size;
}

export function cellAt(puzzle, r, c) {
  return puzzle.board[r][c];
}

export function applyOp(value, op, operand) {
  switch (op) {
    case "+":
      return value + operand;
    case "-":
      return value - operand;
    case "*":
      return value * operand;
    case "/":
      return value / operand;
    default:
      throw new Error(`알 수 없는 연산자: ${op}`);
  }
}

// v1 불변식(기획서 §1 — 값은 항상 양의 정수)을 지키는 칸만 진입을 허용한다. 나눗셈이 정수로
// 안 떨어지거나 뺄셈이 0 이하로 내려가는 칸은, 다른 경로로 값을 먼저 바꿔서 조건을 맞추기
// 전까진 막혀 있다 — Lock 타일의 lockMin도 같은 종류의 조건이라 여기 한 곳에 같이 둔다.
export function isValidEntry(cell, value) {
  if (cell.type === "block") return false;
  if (cell.type === "start") return false;
  if (cell.gimmick === "lock" && value < cell.lockMin) return false;
  const next = applyOp(value, cell.op, cell.operand);
  if (cell.op === "/" && !Number.isInteger(next)) return false;
  if (next <= 0) return false;
  return true;
}

// 워프 칸 하나를 밟았을 때 실제로 서게 되는 칸을 찾는다. 짝(같은 warpId)이 있으면 그 칸,
// 워프가 아니거나(생성 실패로) 짝을 못 찾으면 원래 칸 그대로 — 호출부가 워프 여부를 따로
// 분기하지 않아도 되게 항상 좌표를 돌려준다.
export function warpLanding(puzzle, r, c) {
  const cell = cellAt(puzzle, r, c);
  if (cell.gimmick !== "warp") return { r, c };
  for (let pr = 0; pr < puzzle.size; pr++) {
    for (let pc = 0; pc < puzzle.size; pc++) {
      if (pr === r && pc === c) continue;
      const other = cellAt(puzzle, pr, pc);
      if (other.gimmick === "warp" && other.warpId === cell.warpId) return { r: pr, c: pc };
    }
  }
  return { r, c };
}

function isAdjacent(r1, c1, r2, c2) {
  return DIRS.some(([dr, dc]) => r1 + dr === r2 && c1 + dc === c2);
}

export function canEnter(puzzle, state, r, c) {
  if (!inBounds(puzzle, r, c)) return false;
  if (!isAdjacent(state.r, state.c, r, c)) return false;
  if (state.visited.has(posKey(r, c))) return false;
  return isValidEntry(cellAt(puzzle, r, c), state.value);
}

export function availableMoves(puzzle, state) {
  const moves = [];
  for (const [dr, dc] of DIRS) {
    const r = state.r + dr;
    const c = state.c + dc;
    if (canEnter(puzzle, state, r, c)) moves.push({ r, c });
  }
  return moves;
}

export function initState(puzzle) {
  return {
    r: puzzle.start.r,
    c: puzzle.start.c,
    value: puzzle.start.value,
    visited: new Set([posKey(puzzle.start.r, puzzle.start.c)]),
    movesUsed: 0,
    history: [],
  };
}

// 호출부가 canEnter()로 이미 검증했다고 가정한다(경계 검증은 UI 입력 시점에서 끝났다) —
// 여기서 다시 검사하지 않는다. 밟은 칸이 워프면 착지 칸까지 한 번에 옮기고 둘 다 소멸(visited)
// 처리한다 — 이동 횟수는 1만 쓴다(워프 자체는 공짜 이동이 아니라 "그 칸을 밟는 값"이다).
export function applyMove(puzzle, state, r, c) {
  const cell = cellAt(puzzle, r, c);
  const nextValue = applyOp(state.value, cell.op, cell.operand);
  const { r: landR, c: landC } = warpLanding(puzzle, r, c);
  const visited = new Set(state.visited);
  visited.add(posKey(r, c));
  visited.add(posKey(landR, landC));
  return {
    r: landR,
    c: landC,
    value: nextValue,
    visited,
    movesUsed: state.movesUsed + 1,
    history: [...state.history, { toR: r, toC: c, fromR: state.r, fromC: state.c, prevValue: state.value, landR, landC }],
  };
}

// 되돌릴 이동이 없을 때는 그대로 반환한다 — Undo 버튼은 history가 비면 비활성화되지만,
// 재렌더 전에 두 번 눌리는 경합은 실제로 일어날 수 있어 여기서 조용히 막는다.
export function undo(state) {
  if (state.history.length === 0) return state;
  const last = state.history[state.history.length - 1];
  const visited = new Set(state.visited);
  visited.delete(posKey(last.toR, last.toC));
  visited.delete(posKey(last.landR, last.landC));
  return {
    r: last.fromR,
    c: last.fromC,
    value: last.prevValue,
    visited,
    movesUsed: state.movesUsed - 1,
    history: state.history.slice(0, -1),
  };
}

export function isCleared(puzzle, state) {
  return state.value === puzzle.target;
}

export function isStuck(puzzle, state) {
  return !isCleared(puzzle, state) && availableMoves(puzzle, state).length === 0;
}

export function isOutOfMoves(puzzle, state) {
  return !isCleared(puzzle, state) && state.movesUsed >= puzzle.moveLimit;
}
