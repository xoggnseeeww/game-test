// 순차 연산 · 이동 판정 · Undo 왕복 불변식을 검증한다. DOM이 필요 없는 순수 로직이라
// engine.js와 마찬가지로 브라우저 없이 node --test로 확인한다.
import test from "node:test";
import assert from "node:assert/strict";
import {
  applyOp,
  isValidEntry,
  canEnter,
  availableMoves,
  initState,
  applyMove,
  undo,
  isCleared,
  isStuck,
  isOutOfMoves,
} from "../js/games/numpath/engine.js";

test("순차 연산은 우선순위 없이 왼쪽부터 적용된다 (기획서 예시)", () => {
  // 5 --[+3]--> 8 --[x2]--> 16 --[-4]--> 12
  let v = 5;
  v = applyOp(v, "+", 3);
  assert.equal(v, 8);
  v = applyOp(v, "*", 2);
  assert.equal(v, 16);
  v = applyOp(v, "-", 4);
  assert.equal(v, 12);
});

test("applyOp이 사칙연산을 각각 정확히 계산한다", () => {
  assert.equal(applyOp(10, "+", 3), 13);
  assert.equal(applyOp(10, "-", 3), 7);
  assert.equal(applyOp(10, "*", 3), 30);
  assert.equal(applyOp(10, "/", 5), 2);
});

test("isValidEntry: 나눗셈은 정수로 안 나눠지면 무효", () => {
  const tile = { type: "tile", op: "/", operand: 3 };
  assert.equal(isValidEntry(tile, 9), true); // 9/3=3
  assert.equal(isValidEntry(tile, 10), false); // 10/3 비정수
});

test("isValidEntry: 뺄셈은 0 이하로 내려가면 무효", () => {
  const tile = { type: "tile", op: "-", operand: 5 };
  assert.equal(isValidEntry(tile, 6), true); // 6-5=1 > 0
  assert.equal(isValidEntry(tile, 5), false); // 5-5=0
  assert.equal(isValidEntry(tile, 4), false); // 4-5=-1
});

test("isValidEntry: block 타일은 항상 무효", () => {
  const block = { type: "block", op: null, operand: null };
  assert.equal(isValidEntry(block, 100), false);
});

test("canEnter: 인접·범위·소멸·연산 조건을 모두 확인한다", () => {
  const puzzle = {
    size: 2,
    board: [
      [{ type: "start", value: 5 }, { type: "tile", op: "+", operand: 3 }],
      [{ type: "tile", op: "-", operand: 10 }, { type: "block" }],
    ],
    start: { r: 0, c: 0, value: 5 },
    target: 8,
    moveLimit: 4,
  };
  const state = initState(puzzle);

  assert.equal(canEnter(puzzle, state, 0, 1), true); // 인접 + 5+3=8 유효
  assert.equal(canEnter(puzzle, state, 1, 0), false); // 5-10 <= 0 무효
  assert.equal(canEnter(puzzle, state, 1, 1), false); // block
  assert.equal(canEnter(puzzle, state, 0, 0), false); // 이미 방문(시작 칸)
  assert.equal(canEnter(puzzle, state, -1, 0), false); // 범위 밖
});

test("availableMoves가 canEnter를 만족하는 칸만 돌려준다", () => {
  const puzzle = {
    size: 2,
    board: [
      [{ type: "start", value: 5 }, { type: "tile", op: "+", operand: 3 }],
      [{ type: "tile", op: "-", operand: 10 }, { type: "block" }],
    ],
    start: { r: 0, c: 0, value: 5 },
    target: 8,
    moveLimit: 4,
  };
  const state = initState(puzzle);
  const moves = availableMoves(puzzle, state);
  assert.deepEqual(moves, [{ r: 0, c: 1 }]);
});

test("Undo 왕복 불변식: 임의 이동 후 전부 되돌리면 초기 상태와 완전히 같다", () => {
  const puzzle = {
    size: 3,
    board: [
      [{ type: "start", value: 4 }, { type: "tile", op: "+", operand: 2 }, { type: "tile", op: "*", operand: 2 }],
      [{ type: "tile", op: "+", operand: 1 }, { type: "tile", op: "-", operand: 1 }, { type: "tile", op: "+", operand: 5 }],
      [{ type: "tile", op: "+", operand: 9 }, { type: "tile", op: "+", operand: 9 }, { type: "tile", op: "+", operand: 9 }],
    ],
    start: { r: 0, c: 0, value: 4 },
    target: 999, // 클리어되면 이동이 멈추므로, 이 테스트는 절대 클리어 안 되는 목표값을 둔다
    moveLimit: 10,
  };
  const initial = initState(puzzle);

  let state = initial;
  const path = [
    [0, 1],
    [1, 1],
    [1, 0],
    [2, 0],
  ];
  const applied = [];
  for (const [r, c] of path) {
    assert.ok(canEnter(puzzle, state, r, c), `(${r},${c})로 이동할 수 있어야 한다`);
    state = applyMove(puzzle, state, r, c);
    applied.push([r, c]);
  }
  assert.equal(state.movesUsed, applied.length);

  for (let i = 0; i < applied.length; i++) {
    state = undo(state);
  }

  assert.equal(state.r, initial.r);
  assert.equal(state.c, initial.c);
  assert.equal(state.value, initial.value);
  assert.equal(state.movesUsed, initial.movesUsed);
  assert.deepEqual([...state.visited].sort(), [...initial.visited].sort());
  assert.deepEqual(state.history, initial.history);
});

test("history가 비었을 때 undo는 상태를 그대로 둔다", () => {
  const puzzle = {
    size: 1,
    board: [[{ type: "start", value: 1 }]],
    start: { r: 0, c: 0, value: 1 },
    target: 1,
    moveLimit: 1,
  };
  const state = initState(puzzle);
  const same = undo(state);
  assert.deepEqual(same, state);
});

test("isCleared/isStuck/isOutOfMoves가 서로 배타적으로 판정된다", () => {
  const puzzle = {
    size: 2,
    board: [
      [{ type: "start", value: 5 }, { type: "tile", op: "+", operand: 3 }],
      [{ type: "block" }, { type: "block" }],
    ],
    start: { r: 0, c: 0, value: 5 },
    target: 8,
    moveLimit: 4,
  };
  let state = initState(puzzle);
  assert.equal(isCleared(puzzle, state), false);
  assert.equal(isStuck(puzzle, state), false); // (0,1)로 갈 수 있다

  state = applyMove(puzzle, state, 0, 1);
  assert.equal(state.value, 8);
  assert.equal(isCleared(puzzle, state), true);
  assert.equal(isStuck(puzzle, state), false); // 클리어됐으니 stuck 아님
  assert.equal(isOutOfMoves(puzzle, state), false); // 클리어됐으니 out-of-moves 아님
});

test("이동 제한을 다 쓰고 목표값에 못 미치면 isOutOfMoves가 true", () => {
  const puzzle = {
    size: 2,
    board: [
      [{ type: "start", value: 1 }, { type: "tile", op: "+", operand: 1 }],
      [{ type: "block" }, { type: "block" }],
    ],
    start: { r: 0, c: 0, value: 1 },
    target: 999,
    moveLimit: 1,
  };
  let state = initState(puzzle);
  state = applyMove(puzzle, state, 0, 1);
  assert.equal(state.movesUsed, 1);
  assert.equal(isCleared(puzzle, state), false);
  assert.equal(isOutOfMoves(puzzle, state), true);
});
