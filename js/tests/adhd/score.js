// ADHD 테스트 채점 로직: 게임 보너스 환산 → 축별 퍼센트 → 유형 판정 → 강도 문장.
import { state } from "../../core/state.js";
import { profileKey, RESULT_TYPES } from "./data.js";

export function summarizeGameResults(results) {
  const goResults = results.filter((r) => r.type === "go");
  const noGoResults = results.filter((r) => r.type === "nogo");
  const correctGo = goResults.filter((r) => r.correct);
  const omissionErrors = goResults.length - correctGo.length;
  const commissionErrors = noGoResults.filter((r) => !r.correct).length;
  const rts = correctGo.map((r) => r.rt);
  const avgRt = rts.length ? Math.round(rts.reduce((a, b) => a + b, 0) / rts.length) : null;
  const rtSD = rts.length > 1
    ? Math.round(Math.sqrt(rts.reduce((s, v) => s + (v - avgRt) ** 2, 0) / rts.length))
    : 0;
  const correctCount = correctGo.length + (noGoResults.length - commissionErrors);
  const accuracy = results.length ? Math.round((correctCount / results.length) * 100) : 0;
  return {
    goCount: goResults.length,
    noGoCount: noGoResults.length,
    avgRt,
    rtSD,
    omissionErrors,
    commissionErrors,
    accuracy,
  };
}

// 게임 결과(state.lastReaction)를 충동/집중 보너스로 환산한다.
// 근거: Go/No-Go·CPT(연속수행검사) 계열 과제에서 실제로 쓰이는 두 축을 그대로 옮긴 것.
//  - 억제 실패(commission error, no-go에서 눌러버림) + 성급한 반응(premature response,
//    신호가 뜨기 전에 미리 누름) = 충동성(impulse) 지표. 둘 다 같은 구성개념(충동성)의
//    서로 다른 신호라, 더 높게 나온 쪽을 채택한다(Math.max).
//  - 누락 반응(omission error, go를 놓침) + 반응시간 변산성(RT variability) = 부주의(focus) 지표
// "빨리 누를수록 충동적"이라는 예전 규칙은 반사신경과 충동성을 혼동한 것이라 폐기했다.
// 에너지(과잉행동) 성향은 이 방식으로 측정할 근거가 없어 의도적으로 반영하지 않는다.
export function gameBonuses() {
  const g = state.lastReaction;
  if (!g) return { impulse: 0, focus: 0 };

  let impulse = 0;
  if (g.noGoCount > 0) {
    const rate = g.commissionErrors / g.noGoCount;
    if (rate >= 1) impulse = 4;
    else if (rate >= 0.75) impulse = 3;
    else if (rate >= 0.5) impulse = 2;
    else if (rate > 0) impulse = 1;
  }
  if (g.prematureCount >= 3) impulse = Math.max(impulse, 3);
  else if (g.prematureCount >= 1) impulse = Math.max(impulse, 1);
  impulse = Math.min(4, impulse);

  let focus = 0;
  if (g.goCount > 0) {
    const omissionRate = g.omissionErrors / g.goCount;
    if (omissionRate >= 0.4) focus += 2;
    else if (omissionRate > 0) focus += 1;
  }
  if (g.rtSD > 80) focus += 2;
  else if (g.rtSD > 40) focus += 1;
  focus = Math.min(4, focus);

  return { impulse, focus };
}

export function computeResult() {
  const raw = { focus: 0, impulse: 0, energy: 0 };
  state.answers.forEach((a) => {
    raw[a.group] += a.value;
  });
  const bonus = gameBonuses();
  const toPct = (v) => Math.min(100, Math.round((v / 16) * 100));

  // 게임 보너스를 더하기 전/후 퍼센트를 따로 계산해서, 이미 100%라 더 올라갈 데가
  // 없는 축에는 실제로 반영되지 않은 보너스를 "반영됐다"고 표시하지 않는다.
  const prePct = { focus: toPct(raw.focus), impulse: toPct(raw.impulse), energy: toPct(raw.energy) };
  const pct = {
    focus: toPct(raw.focus + bonus.focus),
    impulse: toPct(raw.impulse + bonus.impulse),
    energy: prePct.energy,
  };
  const visibleBonus = {
    focus: pct.focus > prePct.focus ? bonus.focus : 0,
    impulse: pct.impulse > prePct.impulse ? bonus.impulse : 0,
  };

  const key = profileKey(pct);
  return {
    type: RESULT_TYPES[key],
    key,
    focus: pct.focus,
    impulse: pct.impulse,
    energy: pct.energy,
    bonus: visibleBonus,
  };
}

// 유형은 "고/저" 2단계 조합 8가지로 고정하되(문항이 축당 4개뿐이라 3단계로
// 쪼개면 오히려 경계가 얇아져 근거가 약해진다), 유형 안에서도 퍼센트가 정확히
// 몇인지에 따라 다른 문장이 나오도록 축별 강도 설명을 별도로 붙인다.
// 예: 같은 "충동 우세" 유형이어도 63%와 97%는 다른 문장을 받는다.
export function axisIntensityText(pct) {
  if (pct >= 90) return "매우 두드러지게 나타났어요";
  if (pct >= 75) return "뚜렷하게 높게 나타났어요";
  if (pct >= 60) return "약간 높게 나타났어요";
  if (pct >= 40) return "평범한 수준이에요";
  if (pct >= 20) return "낮은 편이에요";
  return "거의 나타나지 않았어요";
}

export function axisBreakdown(r) {
  return [
    { label: "집중력", pct: r.focus },
    { label: "충동성", pct: r.impulse },
    { label: "에너지", pct: r.energy },
  ].map((a) => ({ ...a, text: axisIntensityText(a.pct) }));
}

// 억제 실패(commissionErrors)와 누락(omissionErrors)을 각각 따로만 보지 않고
// 두 축의 조합으로 코멘트를 골라서, 단순 반응속도 하나보다 더 구체적인 피드백을 준다.
// 두 축을 각각 "없음/약간/심함" 3단계로 나눠 3×3 조합을 전부 커버한다 — 예전엔
// if를 순서대로 훑다가 한쪽이 심하면 다른 쪽에 "약간"이 있어도 그 정보를 그냥
// 버렸다(예: 억제 실패가 심하면서 누락도 한 번 있었던 경우, 누락 얘기가 통째로 빠졌다).
export function reactionComment(r) {
  const commissionLevel =
    r.commissionErrors >= 2 || r.prematureCount >= 3 ? "high" :
    r.commissionErrors === 1 || r.prematureCount >= 1 ? "some" : "none";
  const omissionLevel =
    r.omissionErrors >= 2 ? "high" :
    r.omissionErrors === 1 ? "some" : "none";

  if (commissionLevel === "none" && omissionLevel === "none") {
    return "완벽한 집중력과 충동 조절! 참을 때 참고, 반응할 때 반응했어요 🎯";
  }
  if (commissionLevel === "high" && omissionLevel === "high") {
    return "참아야 할 때 못 참고, 반응해야 할 땐 놓치고… 오늘따라 컨디션이 안 맞았나봐요 😅";
  }
  if (commissionLevel === "high" && omissionLevel === "some") {
    return "멈춰야 할 때 브레이크가 잘 안 걸리는 편이고, 놓친 순간도 한 번 있었어요 ⚡";
  }
  if (commissionLevel === "high") {
    return "반응은 빠른 편인데, 멈춰야 할 때 브레이크가 잘 안 걸리는 편이에요 ⚡";
  }
  if (commissionLevel === "some" && omissionLevel === "high") {
    return "신중한 편이지만 놓치는 순간이 많았고, 성급했던 순간도 한두 번 있었어요 💭";
  }
  if (omissionLevel === "high") {
    return "신중한 편이지만, 그만큼 놓치는 순간도 좀 있었어요 💭";
  }
  if (commissionLevel === "some" && omissionLevel === "some") {
    return "대체로 안정적인데, 성급하게 반응한 순간과 놓친 순간이 한 번씩 있었어요";
  }
  if (commissionLevel === "some") {
    return "대체로 안정적인데, 성급하게 반응한 순간이 한두 번 있었어요";
  }
  if (omissionLevel === "some") {
    return "대체로 안정적인데, 딱 한 번 반응을 놓쳤어요";
  }
  return "전반적으로 안정적인 반응이었어요 👍";
}
