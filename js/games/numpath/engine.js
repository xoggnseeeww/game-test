// 순수 게임 로직: 순차 연산 · 이동 가능 판정 · 이동/Undo · 클리어/막힘 판정.
// DOM을 모른다 — score.js와 같은 이유로 node --test가 브라우저 없이 이 파일을 검증한다.
//
// 보드 칸(cell) 모양: { type: "start"|"tile"|"block", op, operand, gimmick, value }
//  - "start": op/operand/gimmick는 null, value가 시작 숫자
//  - "tile": op("+"|"-"|"*"|"/")와 operand(양의 정수)가 항상 세트. gimmick은 "multiplier"|null
//            (Multiplier Tile은 새 규칙이 아니라 op:"*" 타일의 특수화 — 표시용 태그일 뿐 연산은 동일)
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

// v1 불변식(기획서 §1 — 값은 항상 양의 정수)을 지키는 칸만 진입을 허용한다. 이게 Lock Tile
// 없이도 "진행 순서 강제"를 만든다: 나눗셈이 정수로 안 떨어지거나 뺄셈이 0 이하로 내려가는
// 칸은, 다른 경로로 값을 먼저 바꿔서 조건을 맞추기 전까진 막혀 있다.
export function isValidEntry(cell, value) {
  if (cell.type === "block") return false;
  if (cell.type === "start") return false;
  const next = applyOp(value, cell.op, cell.operand);
  if (cell.op === "/" && !Number.isInteger(next)) return false;
  if (next <= 0) return false;
  return true;
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
// 여기서 다시 검사하지 않는다.
export function applyMove(puzzle, state, r, c) {
  const cell = cellAt(puzzle, r, c);
  const nextValue = applyOp(state.value, cell.op, cell.operand);
  const visited = new Set(state.visited);
  visited.add(posKey(r, c));
  return {
    r,
    c,
    value: nextValue,
    visited,
    movesUsed: state.movesUsed + 1,
    history: [...state.history, { toR: r, toC: c, fromR: state.r, fromC: state.c, prevValue: state.value }],
  };
}

// 되돌릴 이동이 없을 때는 그대로 반환한다 — Undo 버튼은 history가 비면 비활성화되지만,
// 재렌더 전에 두 번 눌리는 경합은 실제로 일어날 수 있어 여기서 조용히 막는다.
export function undo(state) {
  if (state.history.length === 0) return state;
  const last = state.history[state.history.length - 1];
  const visited = new Set(state.visited);
  visited.delete(posKey(last.toR, last.toC));
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
