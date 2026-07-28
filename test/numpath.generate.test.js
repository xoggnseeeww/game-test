// 생성기 × 솔버 교차 검증 + 시드 재현성 + 별 판정. generate.js/solve.js는 DOM을 몰라서
// 브라우저 없이 여기서 직접 검증한다.
import test from "node:test";
import assert from "node:assert/strict";
import { generatePuzzle, mulberry32 } from "../js/games/numpath/generate.js";
import { solve } from "../js/games/numpath/solve.js";
import { LEVELS, starsFor, levelFor, STAGES_PER_RUN } from "../js/games/numpath/data.js";

test("mulberry32는 같은 시드에서 같은 수열을 낸다", () => {
  const a = mulberry32(12345);
  const b = mulberry32(12345);
  const seqA = Array.from({ length: 20 }, () => a());
  const seqB = Array.from({ length: 20 }, () => b());
  assert.deepEqual(seqA, seqB);
});

test("같은 (seed, stage)는 완전히 같은 보드를 낸다", () => {
  const p1 = generatePuzzle(777, 0);
  const p2 = generatePuzzle(777, 0);
  assert.deepEqual(p1.puzzle, p2.puzzle);
  assert.equal(p1.minMoves, p2.minMoves);
});

test("다른 시드는 (거의 항상) 다른 보드를 낸다", () => {
  const p1 = generatePuzzle(1, 0);
  const p2 = generatePuzzle(2, 0);
  assert.notDeepEqual(p1.puzzle, p2.puzzle);
});

test("STAGES_PER_RUN이 LEVELS.length보다 커서 마지막 레벨 이어쓰기 안전망이 실제로 쓰인다", () => {
  assert.ok(STAGES_PER_RUN > LEVELS.length, "안전망이 검증되려면 스테이지 수가 레벨 표보다 많아야 한다");
  assert.equal(levelFor(LEVELS.length + 3), LEVELS[LEVELS.length - 1]);
  assert.equal(levelFor(0), LEVELS[0]);
});

// 레벨마다 여러 시드로 생성해서: 해가 1개 이상 있고, 목표값이 범위 안이고, 경로 전체가
// 양의 정수를 유지하고(생성기 자체 계약), 최적 이동수가 이동 제한 이하인지 확인한다.
// 나눗셈 정수 조건은 engine.isValidEntry가 이미 강제하므로 solve()가 해를 찾았다는 것
// 자체가 그 조건을 만족하는 경로가 존재한다는 뜻이다 — 별도로 다시 계산하지 않는다.
for (let levelIndex = 0; levelIndex < LEVELS.length; levelIndex++) {
  const level = LEVELS[levelIndex];
  test(`레벨 ${levelIndex}(${level.size}x${level.size}) — 생성된 퍼즐은 항상 풀 수 있다 (시드 10개)`, () => {
    for (let seed = 1; seed <= 10; seed++) {
      const { puzzle, minMoves, solutionCount } = generatePuzzle(seed * 1000 + levelIndex, levelIndex);

      assert.equal(puzzle.size, level.size);
      assert.ok(puzzle.target >= level.targetRange[0] && puzzle.target <= level.targetRange[1], `target ${puzzle.target}이 범위 밖`);
      assert.equal(puzzle.moveLimit, level.pathLen + level.slack);

      const result = solve(puzzle, { maxSolutions: level.maxSolutions + 5 });
      assert.ok(result.count >= 1, `레벨 ${levelIndex} 시드 ${seed}: 해가 0개`);
      assert.ok(result.minMoves <= puzzle.moveLimit, "최적 이동수가 이동 제한을 넘음");
      assert.equal(result.minMoves, minMoves, "generatePuzzle이 보고한 minMoves와 solve() 결과가 달라야 할 이유가 없다");
      assert.ok(solutionCount >= 1);
    }
  });
}

test("생성기가 만든 보드에 시작 칸 값과 모든 타일의 사칙연산자가 유효한 형태다", () => {
  const { puzzle } = generatePuzzle(42, 2);
  let sawStart = false;
  for (const row of puzzle.board) {
    for (const cell of row) {
      if (cell.type === "start") {
        sawStart = true;
        assert.ok(Number.isInteger(cell.value) && cell.value > 0);
      } else if (cell.type === "tile") {
        assert.ok(["+", "-", "*", "/"].includes(cell.op));
        assert.ok(Number.isInteger(cell.operand) && cell.operand > 0);
      } else if (cell.type === "block") {
        assert.equal(cell.op, null);
      } else {
        assert.fail(`알 수 없는 칸 타입: ${cell.type}`);
      }
    }
  }
  assert.ok(sawStart);
});

test("starsFor: 최적 이동수와 같으면 3성", () => {
  assert.equal(starsFor({ movesUsed: 5, moveLimit: 8, minMoves: 5 }), 3);
});

test("starsFor: 최적은 아니지만 이동 제한의 80% 이하면 2성", () => {
  // moveLimit=10 → floor(10*0.8)=8. movesUsed=7이면 minMoves(4)보다 크지만 8 이하라 2성.
  assert.equal(starsFor({ movesUsed: 7, moveLimit: 10, minMoves: 4 }), 2);
});

test("starsFor: 그 외엔 1성", () => {
  assert.equal(starsFor({ movesUsed: 9, moveLimit: 10, minMoves: 4 }), 1);
});

test("starsFor: minMoves를 모르면(null) 최적 비교를 건너뛰고 80% 기준으로만 판정", () => {
  assert.equal(starsFor({ movesUsed: 8, moveLimit: 10, minMoves: null }), 2);
  assert.equal(starsFor({ movesUsed: 9, moveLimit: 10, minMoves: null }), 1);
});
