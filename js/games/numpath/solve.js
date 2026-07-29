// 백트래킹 DFS 솔버: 해 개수(상한까지)와 최적 이동수를 구한다.
// engine.js의 applyOp/isValidEntry를 그대로 재사용한다 — 이동 가능 판정 규칙(나눗셈 정수·
// 뺄셈 양수 유지)을 여기서 다시 정의하면 engine과 solve가 서로 다른 규칙으로 갈라질 수 있다.
import { DIRS, applyOp, isValidEntry, posKey } from "./engine.js";

// 그리드가 아무리 커도(5×5, 깊이 8, 분기 4) 반드시 끝나도록 노드 예산을 둔다.
// 역산 생성이라 해가 최소 1개 있는 것은 보장되므로, 예산에 걸려도 "그 전까지 찾은 것"으로 충분하다.
const DEFAULT_NODE_BUDGET = 200_000;
const DEFAULT_MAX_SOLUTIONS = 50;

export function solve(puzzle, { maxSolutions = DEFAULT_MAX_SOLUTIONS, nodeBudget = DEFAULT_NODE_BUDGET } = {}) {
  let solutions = 0;
  let minMoves = Infinity;
  let nodes = 0;
  let exhausted = false;

  const visited = new Set([posKey(puzzle.start.r, puzzle.start.c)]);

  function dfs(r, c, value, moves) {
    if (exhausted || solutions >= maxSolutions) return;
    nodes++;
    if (nodes > nodeBudget) {
      exhausted = true;
      return;
    }
    if (value === puzzle.target) {
      solutions++;
      if (moves < minMoves) minMoves = moves;
      // 목표값에 도달하면 그 즉시 퍼즐이 끝난다(engine.isCleared와 같은 규칙) — 여기서 더
      // 진행하지 않는다. 계속 진행하는 것은 "다른 해"가 아니라 게임이라면 있을 수 없는 수다.
      return;
    }
    if (moves >= puzzle.moveLimit) return;
    for (const [dr, dc] of DIRS) {
      const nr = r + dr;
      const nc = c + dc;
      if (nr < 0 || nr >= puzzle.size || nc < 0 || nc >= puzzle.size) continue;
      const key = posKey(nr, nc);
      if (visited.has(key)) continue;
      const cell = puzzle.board[nr][nc];
      if (!isValidEntry(cell, value)) continue;
      const nextValue = applyOp(value, cell.op, cell.operand);
      visited.add(key);
      dfs(nr, nc, nextValue, moves + 1);
      visited.delete(key);
      if (exhausted || solutions >= maxSolutions) return;
    }
  }

  dfs(puzzle.start.r, puzzle.start.c, puzzle.start.value, 0);

  return {
    count: solutions,
    minMoves: Number.isFinite(minMoves) ? minMoves : null,
    exhausted,
  };
}
