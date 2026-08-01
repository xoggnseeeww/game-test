// 생성기 × 솔버 교차 검증 + 시드 재현성 + 난이도 커브 + 별 판정. generate.js/solve.js는 DOM을
// 몰라서 브라우저 없이 여기서 직접 검증한다.
import test from "node:test";
import assert from "node:assert/strict";
import { generatePuzzle, mulberry32, stageSeed } from "../js/games/numpath/generate.js";
import { solve } from "../js/games/numpath/solve.js";
import { LEVELS, DIFFICULTIES, DEFAULT_DIFFICULTY, starsFor, levelFor, difficultyById, stageCountFor, formatTime } from "../js/games/numpath/data.js";

test("mulberry32는 같은 시드에서 같은 수열을 낸다", () => {
  const a = mulberry32(12345);
  const b = mulberry32(12345);
  const seqA = Array.from({ length: 20 }, () => a());
  const seqB = Array.from({ length: 20 }, () => b());
  assert.deepEqual(seqA, seqB);
});

test("같은 (seed, stage, 난이도)는 완전히 같은 보드를 낸다", () => {
  const p1 = generatePuzzle(777, 0, "normal");
  const p2 = generatePuzzle(777, 0, "normal");
  assert.deepEqual(p1.puzzle, p2.puzzle);
  assert.equal(p1.minMoves, p2.minMoves);
});

test("다른 시드는 (거의 항상) 다른 보드를 낸다", () => {
  const p1 = generatePuzzle(1, 0, "normal");
  const p2 = generatePuzzle(2, 0, "normal");
  assert.notDeepEqual(p1.puzzle, p2.puzzle);
});

// 회귀 방지: 예전엔 런 시드가 모든 스테이지에 그대로 쓰여서, 레벨 설정이 같은 두 스테이지가
// 완전히 같은 보드로 나왔다(예: 옛 커브의 마지막 두 스테이지). 난이도 커브가 같은 레벨을
// 여러 번 반복하는 지금은 치명적이라, 같은 레벨을 쓰는 인접 스테이지가 다른 보드를 내는지
// 실제 커브에서 찾아 확인한다.
test("같은 런에서 레벨 설정이 같은 두 스테이지도 서로 다른 보드를 낸다", () => {
  for (const diff of DIFFICULTIES) {
    for (let i = 1; i < diff.stages.length; i++) {
      if (diff.stages[i] !== diff.stages[i - 1]) continue; // 레벨이 다르면 당연히 다르다 — 같은 레벨만 본다
      const a = generatePuzzle(777, i - 1, diff.id);
      const b = generatePuzzle(777, i, diff.id);
      assert.notDeepEqual(a.puzzle, b.puzzle, `${diff.id} 스테이지 ${i - 1}·${i}가 같은 보드다`);
    }
  }
});

test("stageSeed는 스테이지마다 다른 시드를 파생하고 같은 입력엔 같은 값을 낸다", () => {
  const seeds = new Set(Array.from({ length: 10 }, (_, i) => stageSeed(777, i)));
  assert.equal(seeds.size, 10, "파생 시드가 충돌한다");
  assert.equal(stageSeed(777, 3), stageSeed(777, 3));
});

test("난이도 표가 유효하다: 스테이지 수가 서로 다르게 확충됐고 커브가 LEVELS 범위 안이다", () => {
  const ids = DIFFICULTIES.map((d) => d.id);
  assert.equal(new Set(ids).size, ids.length, "난이도 id가 겹친다");
  assert.ok(DIFFICULTIES.some((d) => d.id === DEFAULT_DIFFICULTY), "기본 난이도가 표에 없다");
  const counts = DIFFICULTIES.map((d) => d.stages.length);
  assert.equal(new Set(counts).size, counts.length, "난이도별 스테이지 수가 구분되지 않는다");
  for (const d of DIFFICULTIES) {
    assert.ok(d.stages.length > 0);
    for (const idx of d.stages) {
      assert.ok(Number.isInteger(idx) && idx >= 0 && idx < LEVELS.length, `${d.id} 커브의 레벨 인덱스 ${idx}가 LEVELS 밖`);
    }
    assert.equal(stageCountFor(d.id), d.stages.length);
  }
});

test("levelFor: 커브 밖 인덱스는 마지막 레벨을 이어 쓰고, 모르는 난이도는 기본 난이도로 폴백한다", () => {
  for (const d of DIFFICULTIES) {
    assert.equal(levelFor(d.id, 0), LEVELS[d.stages[0]]);
    assert.equal(levelFor(d.id, d.stages.length + 5), LEVELS[d.stages[d.stages.length - 1]]);
  }
  assert.equal(difficultyById("없는-난이도").id, DEFAULT_DIFFICULTY);
});

// 난이도 × 스테이지마다 여러 시드로 생성해서: 해가 1개 이상 있고, 목표값이 범위 안이고,
// 최적 이동수가 이동 제한 이하인지 확인한다. 나눗셈 정수 조건은 engine.isValidEntry가 이미
// 강제하므로 solve()가 해를 찾았다는 것 자체가 그 조건을 만족하는 경로가 존재한다는 뜻이다.
// 모든 난이도 커브를 실제 인덱스로 돌기 때문에 LEVELS의 전 레벨(신설된 최고 레벨 포함)이
// 실사용 조합 그대로 검증된다.
for (const diff of DIFFICULTIES) {
  test(`난이도 ${diff.id} — 커브의 모든 스테이지가 항상 풀 수 있다 (시드 5개)`, () => {
    for (let stage = 0; stage < diff.stages.length; stage++) {
      const level = LEVELS[diff.stages[stage]];
      for (let seed = 1; seed <= 5; seed++) {
        const { puzzle, minMoves, solutionCount } = generatePuzzle(seed * 1000 + stage, stage, diff.id);

        assert.equal(puzzle.size, level.size);
        assert.ok(puzzle.target >= level.targetRange[0] && puzzle.target <= level.targetRange[1], `target ${puzzle.target}이 범위 밖`);
        assert.equal(puzzle.moveLimit, level.pathLen + level.slack);

        const result = solve(puzzle, { maxSolutions: level.maxSolutions + 5 });
        assert.ok(result.count >= 1, `난이도 ${diff.id} 스테이지 ${stage} 시드 ${seed}: 해가 0개`);
        assert.ok(result.minMoves <= puzzle.moveLimit, "최적 이동수가 이동 제한을 넘음");
        assert.equal(result.minMoves, minMoves, "generatePuzzle이 보고한 minMoves와 solve() 결과가 달라야 할 이유가 없다");
        assert.ok(solutionCount >= 1);
      }
    }
  });
}

test("생성기가 만든 보드에 시작 칸 값과 모든 타일의 사칙연산자가 유효한 형태다", () => {
  const { puzzle } = generatePuzzle(42, 2, "normal");
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

// 회귀 방지: LEVELS의 실제 slack(2~3)은 pathLen 대비 작아서, "이동 제한의 80%" 같은 moveLimit
// 기준 고정 비율로 2성 임계값을 정하면 그 값이 minMoves 이하로 떨어져 2성 구간이 통째로
// 사라진다(3성 아니면 바로 1성). 실제 레벨 파라미터로 3단계가 전부 실재하는지 직접 확인한다.
for (let levelIndex = 0; levelIndex < LEVELS.length; levelIndex++) {
  const level = LEVELS[levelIndex];
  test(`starsFor: 레벨 ${levelIndex}(pathLen=${level.pathLen}, slack=${level.slack})에서 1·2·3성이 모두 실재한다`, () => {
    const minMoves = level.pathLen;
    const moveLimit = level.pathLen + level.slack;
    const achieved = new Set();
    for (let movesUsed = minMoves; movesUsed <= moveLimit; movesUsed++) {
      achieved.add(starsFor({ movesUsed, moveLimit, minMoves }));
    }
    assert.deepEqual([...achieved].sort(), [1, 2, 3], `나온 등급: ${[...achieved].sort().join(",")}`);
  });
}

test("formatTime: m:ss로 표시하고 초는 항상 2자리", () => {
  assert.equal(formatTime(0), "0:00");
  assert.equal(formatTime(5000), "0:05");
  assert.equal(formatTime(65000), "1:05");
  assert.equal(formatTime(600000), "10:00");
});
