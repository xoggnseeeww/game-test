import test from "node:test";
import assert from "node:assert/strict";

import { state } from "../js/core/state.js";
import {
  gameBonuses,
  computeResult,
  reactionComment,
  GAME_BONUS_MAX,
  RT_SD_UNSTABLE,
  RT_SD_VERY_UNSTABLE,
} from "../js/tests/adhd/score.js";
import { QUESTIONS, OPTIONS } from "../js/tests/adhd/data.js";

function reactionStats(overrides) {
  return {
    goCount: 10, noGoCount: 4, avgRt: 400, rtSD: 30,
    omissionErrors: 0, commissionErrors: 0, prematureCount: 0, accuracy: 100,
    ...overrides,
  };
}

test("반응 코멘트: 억제 실패와 누락 축을 각각 없음/약간/심함 3단계로 조합해 9가지 모두 서로 다른 문장을 준다", () => {
  const levels = {
    none: { commissionErrors: 0, prematureCount: 0 },
    some: { commissionErrors: 1, prematureCount: 0 },
    high: { commissionErrors: 2, prematureCount: 0 },
  };
  const omissionLevels = {
    none: { omissionErrors: 0 },
    some: { omissionErrors: 1 },
    high: { omissionErrors: 2 },
  };

  const seen = new Map();
  for (const [cKey, cVal] of Object.entries(levels)) {
    for (const [oKey, oVal] of Object.entries(omissionLevels)) {
      const r = reactionStats({ ...cVal, ...oVal });
      const comment = reactionComment(r);
      assert.ok(comment && comment.length > 0, `commission=${cKey} omission=${oKey}에 코멘트가 비어있다`);
      const dupKey = seen.get(comment);
      assert.ok(
        !dupKey,
        `commission=${cKey}/omission=${oKey} 조합이 commission=${dupKey}와 같은 문장을 받아 정보가 뭉개졌다`
      );
      seen.set(comment, `${cKey}/${oKey}`);
    }
  }
  assert.equal(seen.size, 9);
});

test("반응 코멘트: 성급한 반응(prematureCount)도 억제 실패와 같은 충동성 신호로 취급한다", () => {
  const viaCommission = reactionComment(reactionStats({ commissionErrors: 2 }));
  const viaPremature = reactionComment(reactionStats({ prematureCount: 3 }));
  assert.equal(viaCommission, viaPremature);
});

test("게임 보너스: 게임을 안 했으면 보너스가 없다", () => {
  state.lastReaction = null;
  assert.deepEqual(gameBonuses(), { impulse: 0, focus: 0 });
});

test("게임 보너스: no-go 억제 실패율이 높을수록 충동 보너스가 커진다", () => {
  state.lastReaction = reactionStats({ noGoCount: 4, commissionErrors: 4 }); // 100%
  assert.equal(gameBonuses().impulse, GAME_BONUS_MAX);
  state.lastReaction = reactionStats({ noGoCount: 4, commissionErrors: 1 }); // 25%
  assert.equal(gameBonuses().impulse, 1);
});

// 상한이 곧 게임의 발언권이다. no-go 시행이 CPT_NOGO_COUNT회뿐인 미니게임이
// 문항 하나보다 무거워지면 안 된다 — 상한을 다시 올리면 여기서 걸린다.
// → `docs/DECISIONS.md` D-25
test("게임 보너스: 게임 한 판의 무게가 설문 문항 하나보다 가볍다", () => {
  const maxPerQuestion = Math.max(...OPTIONS.map((o) => o.value));
  assert.ok(
    GAME_BONUS_MAX < maxPerQuestion,
    `게임 보너스 상한(${GAME_BONUS_MAX})이 문항 하나 만점(${maxPerQuestion}) 이상이다`
  );
});

// 이 검사가 없으면 구간을 손보다가 상한이 조용히 새어나가도 아무도 모른다
test("게임 보너스: 무엇을 어떻게 틀려도 축당 상한을 넘지 않는다", () => {
  for (const commissionErrors of [0, 1, 2, 3, 4]) {
    for (const omissionErrors of [0, 1, 5, 10]) {
      for (const prematureCount of [0, 1, 3, 9]) {
        for (const rtSD of [0, 50, 95, 140, 900]) {
          state.lastReaction = reactionStats({ commissionErrors, omissionErrors, prematureCount, rtSD });
          const b = gameBonuses();
          assert.ok(b.impulse >= 0 && b.impulse <= GAME_BONUS_MAX, `충동 보너스 범위 이탈: ${b.impulse}`);
          assert.ok(b.focus >= 0 && b.focus <= GAME_BONUS_MAX, `집중 보너스 범위 이탈: ${b.focus}`);
        }
      }
    }
  }
});

// 사람의 단순반응 표준편차는 대체로 60~120ms다. 이 구간에서 보너스가 붙으면
// 부주의가 아니라 기기 지연과 "사람이라는 사실"을 재게 된다 → `docs/DECISIONS.md` D-26
test("게임 보너스: 사람의 정상 반응 편차 범위에서는 집중 보너스가 붙지 않는다", () => {
  for (const rtSD of [40, 60, 80, RT_SD_UNSTABLE]) {
    state.lastReaction = reactionStats({ rtSD });
    assert.equal(gameBonuses().focus, 0, `rtSD ${rtSD}ms에 집중 보너스가 붙었다`);
  }
  state.lastReaction = reactionStats({ rtSD: RT_SD_UNSTABLE + 1 });
  assert.equal(gameBonuses().focus, 1);
  state.lastReaction = reactionStats({ rtSD: RT_SD_VERY_UNSTABLE + 1 });
  assert.equal(gameBonuses().focus, 2);
});

test("최종 결과: 설문 축이 이미 100%면 게임 보너스가 눈에 보이는 반영으로 잡히지 않는다", () => {
  // state.answers엔 화면 쪽에서 역채점을 이미 반영한 값이 들어오므로(reverse 문항도
  // "가장 산만함"이면 value:4), reverse 여부와 상관없이 전부 4로 채우면 만점이 된다.
  state.answers = QUESTIONS.map((q) => ({ group: q.group, value: 4 })); // 모든 축 만점
  state.lastReaction = reactionStats({ noGoCount: 4, commissionErrors: 4, omissionErrors: 4, rtSD: 200 });
  const r = computeResult();
  assert.equal(r.focus, 100);
  assert.equal(r.impulse, 100);
  assert.equal(r.bonus.focus, 0, "이미 100%인 축에 보너스가 반영됐다고 잘못 표시됐다");
  assert.equal(r.bonus.impulse, 0, "이미 100%인 축에 보너스가 반영됐다고 잘못 표시됐다");
});
