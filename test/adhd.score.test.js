import test from "node:test";
import assert from "node:assert/strict";

import { state } from "../js/core/state.js";
import { gameBonuses, computeResult, reactionComment } from "../js/tests/adhd/score.js";
import { QUESTIONS } from "../js/tests/adhd/data.js";

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
  assert.equal(gameBonuses().impulse, 4);
  state.lastReaction = reactionStats({ noGoCount: 4, commissionErrors: 1 }); // 25%
  assert.equal(gameBonuses().impulse, 1);
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
