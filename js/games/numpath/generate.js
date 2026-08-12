// 역산 생성기(Reverse Engineering Generation): 경로 먼저 → 수식 배치 → 더미/기믹 채우기 →
// solve()로 검증. 이 파일은 DOM을 모른다 — engine.js와 같은 이유로 node --test가 직접 검증한다.
//
// 시드를 넣으면 항상 같은 보드가 나와야 하므로(데일리 모드가 나중에 이 위에 얹힌다),
// Math.random을 쓰지 않는다. core/util.js의 shuffle()은 비시드라 여기서는 쓰지 않고,
// 시드 PRNG·시드 셔플을 이 파일 안에 따로 둔다 — 게임 전용 함수로 core를 오염시키지 않기 위해서다.
import { DIRS, posKey, applyOp } from "./engine.js";
import { solve } from "./solve.js";
import { levelFor } from "./data.js";

const GENERATION_ATTEMPTS = 200;
const MULTIPLIER_PROBABILITY = 0.35;

// 런 시드 하나에서 스테이지별 시드를 파생한다. 예전엔 런 시드를 모든 스테이지가 그대로 써서,
// 레벨 설정이 같은 두 스테이지(난이도 커브는 같은 레벨을 여러 번 반복한다)가 **완전히 같은
// 보드**로 나오는 버그가 있었다 — 시드가 같고 레벨 파라미터도 같으면 생성 과정 전체가 동일하다.
// stageIndex를 정수 해시로 섞어 스테이지마다 독립된 수열을 만든다(여전히 결정적이라
// 뒤로가기 재진입 시 같은 보드가 재현된다는 계약은 그대로다).
export function stageSeed(seed, stageIndex) {
  return Math.imul(seed ^ (stageIndex + 1), 0x9e3779b1) >>> 0;
}

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function rng() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randInt(rng, min, max) {
  return min + Math.floor(rng() * (max - min + 1));
}

function pick(rng, arr) {
  return arr[Math.floor(rng() * arr.length)];
}

function seededShuffle(rng, arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function divisorsOf(n) {
  const out = [];
  for (let d = 2; d <= n; d++) if (n % d === 0) out.push(d);
  return out;
}

function isOpFeasible(op, value) {
  if (op === "-") return value > 1;
  if (op === "/") return divisorsOf(value).length > 0;
  return true;
}

function pickOperand(rng, op, value) {
  if (op === "+") return randInt(rng, 1, 9);
  if (op === "-") return randInt(rng, 1, Math.min(9, value - 1));
  if (op === "*") return randInt(rng, 2, 4);
  return pick(rng, divisorsOf(value));
}

// 더미 타일은 경로 밖이라 특정 값을 전제로 배치할 필요가 없다 — 플레이 중 canEnter()가
// 그때그때 현재값을 기준으로 진입 가능 여부를 판정한다. 그래서 여기 operand는 값 무관 범위다.
function decoyOperand(rng, op) {
  if (op === "*") return randInt(rng, 2, 4);
  if (op === "/") return randInt(rng, 2, 9);
  return randInt(rng, 1, 9);
}

// 무작위 시작 칸에서 백트래킹으로 self-avoiding 경로를 찾는다. 그리드가 작고(3×3~5×5)
// pathLen이 짧아서(4~8) 대부분 즉시 성공하지만, 만약을 대비해 여러 시작점을 시도한다.
function buildPath(rng, size, pathLen) {
  const starts = [];
  for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) starts.push({ r, c });

  for (const start of seededShuffle(rng, starts)) {
    const path = walkFrom(rng, size, pathLen, start);
    if (path) return path;
  }
  return null;
}

function walkFrom(rng, size, pathLen, start) {
  const path = [start];
  const visited = new Set([posKey(start.r, start.c)]);

  function backtrack() {
    if (path.length - 1 === pathLen) return true;
    const { r, c } = path[path.length - 1];
    const candidates = seededShuffle(
      rng,
      DIRS.map(([dr, dc]) => ({ r: r + dr, c: c + dc }))
    ).filter(({ r: nr, c: nc }) => nr >= 0 && nr < size && nc >= 0 && nc < size && !visited.has(posKey(nr, nc)));

    for (const next of candidates) {
      visited.add(posKey(next.r, next.c));
      path.push(next);
      if (backtrack()) return true;
      path.pop();
      visited.delete(posKey(next.r, next.c));
    }
    return false;
  }

  return backtrack() ? path : null;
}

// 경로 칸에 숫자/연산자를 순차 배치하며 목표값을 산출한다. 매 단계 양의 정수를 유지한다
// (÷는 그 시점 값의 약수만, −는 0 이하로 못 내려간다) — 이게 (b)/(c) 설계 결정이다.
function assignPathValues(rng, path, level) {
  const startValue = randInt(rng, 1, 9);
  let value = startValue;
  const assignments = [];
  let multiplierUsed = 0;

  for (let i = 1; i < path.length; i++) {
    const canUseMultiplier = level.gimmicks.multiplier > multiplierUsed && rng() < MULTIPLIER_PROBABILITY;
    let op;
    let operand;
    let gimmick = null;

    if (canUseMultiplier) {
      op = "*";
      operand = pick(rng, [2, 3]);
      gimmick = "multiplier";
      multiplierUsed++;
    } else {
      const feasible = level.ops.filter((o) => isOpFeasible(o, value));
      op = pick(rng, feasible);
      operand = pickOperand(rng, op, value);
    }

    value = applyOp(value, op, operand);
    assignments.push({ op, operand, gimmick });
  }

  return { startValue, assignments, target: value, multiplierUsed };
}

// 경로 밖 칸을 정해진 순서(block → multiplier → lock → warp → 순수 더미)로 채운다. lock/warp
// 배치 자리가 모자라면(레벨 설정 실수 등) 조용히 순수 더미로 남는다 — 기믹은 "있으면 더
// 재미있는" 장식이라 필수 조건이 아니다(경로 자체는 항상 풀리게 보장돼 있다).
function buildBoard(rng, level, path, assignment) {
  const size = level.size;
  const board = Array.from({ length: size }, () => Array(size).fill(null));
  const pathKeys = new Set(path.map(({ r, c }) => posKey(r, c)));

  board[path[0].r][path[0].c] = { type: "start", op: null, operand: null, gimmick: null, value: assignment.startValue };
  for (let i = 1; i < path.length; i++) {
    const { r, c } = path[i];
    const a = assignment.assignments[i - 1];
    board[r][c] = { type: "tile", op: a.op, operand: a.operand, gimmick: a.gimmick, value: null };
  }

  const rest = [];
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (!pathKeys.has(posKey(r, c))) rest.push({ r, c });
    }
  }
  const shuffledRest = seededShuffle(rng, rest);
  let cursor = 0;
  const take = (n) => {
    const slice = shuffledRest.slice(cursor, cursor + n);
    cursor += slice.length;
    return slice;
  };

  for (const { r, c } of take(level.gimmicks.block)) {
    board[r][c] = { type: "block", op: null, operand: null, gimmick: null, value: null };
  }

  const multiplierRemaining = Math.max(0, level.gimmicks.multiplier - assignment.multiplierUsed);
  for (const { r, c } of take(multiplierRemaining)) {
    board[r][c] = { type: "tile", op: "*", operand: pick(rng, [2, 3]), gimmick: "multiplier", value: null };
  }

  // Lock 더미의 lockMin은 경로값과 무관하게 초반~중반에 흔히 보이는 값 범위(6~16)에서 뽑는다 —
  // 정확한 튜닝보다 "지금 값으론 아직 못 지나간다"는 감각을 주는 게 목적이라 느슨해도 된다.
  for (const { r, c } of take(level.gimmicks.lock)) {
    const op = pick(rng, level.ops);
    board[r][c] = { type: "tile", op, operand: decoyOperand(rng, op), gimmick: "lock", lockMin: randInt(rng, 6, 16), value: null };
  }

  for (let p = 0; p < level.gimmicks.warp; p++) {
    const warpId = `w${p}`;
    for (const { r, c } of take(2)) {
      const op = pick(rng, level.ops);
      board[r][c] = { type: "tile", op, operand: decoyOperand(rng, op), gimmick: "warp", warpId, value: null };
    }
  }

  for (const { r, c } of shuffledRest.slice(cursor)) {
    const op = pick(rng, level.ops);
    board[r][c] = { type: "tile", op, operand: decoyOperand(rng, op), gimmick: null, value: null };
  }

  return board;
}

// 스테이지 하나의 퍼즐을 만든다. 같은 (seed, stageIndex, difficultyId)는 항상 같은 보드를 낸다.
// 시도 예산 안에서 해 개수가 레벨 상한을 넘지 않는 후보를 찾으면 그걸 쓰고, 예산을 다
// 썼으면 그때까지 찾은 마지막 후보를 그대로 채택한다(역산이라 해가 최소 1개는 있다).
export function generatePuzzle(seed, stageIndex, difficultyId) {
  const level = levelFor(difficultyId, stageIndex);
  const rng = mulberry32(stageSeed(seed, stageIndex));
  let candidate = null;

  for (let attempt = 0; attempt < GENERATION_ATTEMPTS; attempt++) {
    const path = buildPath(rng, level.size, level.pathLen);
    if (!path) continue;

    const assignment = assignPathValues(rng, path, level);
    if (assignment.target < level.targetRange[0] || assignment.target > level.targetRange[1]) continue;

    const board = buildBoard(rng, level, path, assignment);
    const puzzle = {
      size: level.size,
      board,
      start: { r: path[0].r, c: path[0].c, value: assignment.startValue },
      target: assignment.target,
      moveLimit: level.pathLen + level.slack,
    };

    const result = solve(puzzle, { maxSolutions: level.maxSolutions + 1 });
    if (result.count === 0) continue; // 역산 경로 자체가 해이므로 이론상 도달하지 않는다

    candidate = { puzzle, minMoves: result.minMoves, solutionCount: result.count };
    if (result.count <= level.maxSolutions) return candidate;
  }

  if (!candidate) {
    throw new Error(`NumPath 퍼즐 생성 실패: stage=${stageIndex} seed=${seed} — LEVELS 설정을 확인할 것`);
  }
  return candidate;
}
