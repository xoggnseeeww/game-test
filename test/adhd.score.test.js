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
import { QUESTIONS, OPTIONS, RESULT_TYPES } from "../js/tests/adhd/data.js";

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

// 이 균형이 깨지면 묵종 방어가 산술적으로 무너진다 → `docs/DECISIONS.md` D-27
test("문항: 축마다 정방향과 역채점이 정확히 반씩이다", () => {
  const byAxis = {};
  for (const q of QUESTIONS) {
    byAxis[q.group] ??= { forward: 0, reverse: 0 };
    byAxis[q.group][q.reverse ? "reverse" : "forward"] += 1;
  }
  for (const [axis, n] of Object.entries(byAxis)) {
    assert.equal(n.forward, n.reverse, `${axis} 축의 정방향(${n.forward})과 역채점(${n.reverse})이 다르다`);
  }
});

// 화면(screens.js)이 역채점을 4-v로 뒤집어 state.answers에 넣는 걸 그대로 재현한다.
const answerAll = (raw) => QUESTIONS.map((q) => ({ group: q.group, value: q.reverse ? 4 - raw : raw }));

test("묵종 방어: 모든 문항에 같은 답을 하면 응답값이 무엇이든 전 축이 정확히 50%다", () => {
  state.lastReaction = null;
  for (const v of OPTIONS.map((o) => o.value)) {
    state.answers = answerAll(v);
    const r = computeResult();
    assert.equal(r.focus, 50, `전 문항 ${v}점 → 집중 ${r.focus}%`);
    assert.equal(r.impulse, 50, `전 문항 ${v}점 → 충동 ${r.impulse}%`);
    assert.equal(r.energy, 50, `전 문항 ${v}점 → 에너지 ${r.energy}%`);
    assert.equal(r.key, "000", `전 문항 ${v}점인데 유형이 ${r.key}`);
  }
});

test("경계선 안내: 임계선 근처 축만 짚고, 뚜렷한 결과엔 붙지 않는다", () => {
  state.lastReaction = null;
  // 전부 같은 답 → 50%, 임계선 60과 10%p 차이라 밴드(7) 밖
  state.answers = answerAll(2);
  assert.deepEqual(computeResult().borderline, []);
  // 전부 최고점(역채점은 0점) → 축당 raw 8이 아니라 16 → 100%, 경계선 아님
  state.answers = QUESTIONS.map((q) => ({ group: q.group, value: 4 }));
  assert.deepEqual(computeResult().borderline, []);
  // 축당 raw 10 → 63%. 임계선 60에서 3%p라 밴드 안 → 세 축 모두 경계선
  state.answers = QUESTIONS.flatMap((q, i) => [{ group: q.group, value: i % 4 < 2 ? 3 : 2 }]);
  const r = computeResult();
  assert.deepEqual(r.borderline, ["집중력", "충동성", "에너지"], `실제 축 퍼센트: ${r.focus}/${r.impulse}/${r.energy}`);
});

// axisIntensityText()는 60~74%를 "약간 높게", 75%+를 "뚜렷하게 높게"/"매우 두드러지게"로
// 나눠 부른다. RESULT_TYPES의 유형 desc가 이 상위 등급 어휘를 재사용하면, 임계선을 막
// 넘긴 60%대 사용자에게도 같은 화면에서 "뚜렷한 특징"이라고 말하게 된다 — 축 문구는
// "약간 높게"인데 유형 문구는 "뚜렷"이라고 우기는 모순이 실제로 있었다.
// 낮은 쪽도 대칭이다: "000"(전 축 미달)은 0~59% 전체를 아우르는데 "낮게 나왔어요"라고
// 단정하면, 59%(axisIntensityText로는 "평범한 수준")인 사람에게도 낮다고 말하게 된다.
// → `docs/DECISIONS.md` D-30
test("유형 설명: axisIntensityText가 상위 등급 전용으로 쓰는 어휘를 재사용하지 않는다", () => {
  const reserved = /뚜렷|두드러지|낮게 나왔|낮게 나타났/;
  for (const [key, type] of Object.entries(RESULT_TYPES)) {
    assert.ok(!reserved.test(type.desc), `${key}(${type.name})의 desc가 상위 등급 전용 어휘를 쓴다: "${type.desc}"`);
  }
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
