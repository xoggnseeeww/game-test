// 부부 매칭 연산과 배우자 코드 코덱.
import test from "node:test";
import assert from "node:assert/strict";

import { computeCouple } from "../js/tests/couple/score.js";
import { assembleQuestionnaire } from "../js/tests/couple/assemble.js";
import {
  deltaBehavior,
  RISK_MATRIX,
  riskOf,
  itemNorm,
  gapScore,
  matchScore,
  matchBand,
  romanceRatio,
  combine,
  personaName,
  encodePartner,
  decodePartner,
  WEIGHTS,
} from "../js/tests/couple/match.js";

const IDENTITY = { shuffleFn: (a) => a };
const ATTACH_KEYS = ["Se", "An", "Av", "Fe"];

// fill을 주지 않으면 값이 흩어진 "성실한 응답"을 만든다(직선 응답 검사에 안 걸린다).
// 숫자를 주면 전 문항을 그 값으로 채운다 — 코덱의 극단값 처리를 볼 때 쓴다.
function resultOf(setup, fill = null, overrides = {}) {
  const items = assembleQuestionnaire(setup, IDENTITY);
  const pattern = [4, 3, 5, 2, 3, 4, 1, 3];
  const answers = {};
  items.forEach((item, i) => {
    answers[item.code] = fill === null ? pattern[i % pattern.length] : fill;
  });
  answers.QC1 = 2;
  answers.QC2 = answers.I1;
  return computeCouple({ ...answers, ...overrides }, { elapsedMs: 400000, setup });
}

// ---------------------------------------------------------------- §7.1 ΔDISC

test("ΔDISC는 0~100으로 정규화된다", () => {
  const zero = { D: 50, I: 50, S: 50, C: 50 };
  assert.equal(deltaBehavior(zero, zero), 0);
  // 네 축이 모두 정반대인 이론적 최대(거리 200)가 100이 돼야 다른 항목과 스케일이 맞는다.
  assert.equal(deltaBehavior({ D: 0, I: 0, S: 0, C: 0 }, { D: 100, I: 100, S: 100, C: 100 }), 100);
});

// ---------------------------------------------------------------- §7.2 Risk Matrix

test("Risk Matrix가 대칭이고 추격자-도망자 조합이 최고값이다", () => {
  for (const a of ATTACH_KEYS) {
    for (const b of ATTACH_KEYS) {
      assert.equal(riskOf(a, b), riskOf(b, a), `${a}×${b}가 비대칭이다`);
    }
  }
  const values = ATTACH_KEYS.flatMap((a) => ATTACH_KEYS.map((b) => riskOf(a, b)));
  assert.equal(Math.max(...values), 18);
  assert.equal(riskOf("An", "Av"), 18);
  assert.equal(riskOf("Se", "Se"), 0);
  // 표 전체가 채워져 있어야 한다 — 빠진 칸이 있으면 NaN이 점수까지 흘러간다
  assert.ok(values.every((v) => Number.isFinite(v)));
  assert.equal(Object.keys(RISK_MATRIX).length, ATTACH_KEYS.length);
});

// ---------------------------------------------------------------- §7.3 Gap Score

test("Gap Score는 앵커 문항만 쓰고 방향을 보존한다", () => {
  const a = { AN1: 5, AN2: 1, AN3: 3, R5: 3, R6: 3, K2: 3, K4: 3 };
  const b = { AN1: 1, AN2: 5, AN3: 3, R5: 3, R6: 3, K2: 3, K4: 3 };
  const g = gapScore(a, b);
  assert.equal(g.items.length, 3);
  assert.deepEqual(g.items.map((i) => i.code), ["AN1", "AN2", "AN3"]);
  assert.equal(g.items[0].gap, 100);
  // 부호가 살아 있어야 "누가 더 크게 느끼는지"를 서술할 수 있다
  assert.ok(g.items[0].direction > 0);
  assert.ok(g.items[1].direction < 0);
  assert.equal(g.items[2].gap, 0);
  assert.ok(Math.abs(g.total - 200 / 3) < 1e-9);

  // 같은 응답이면 격차가 0
  assert.equal(gapScore(a, a).total, 0);
});

test("개별 문항 100점 환산이 1~5점을 0~100으로 편다", () => {
  assert.equal(itemNorm(1), 0);
  assert.equal(itemNorm(3), 50);
  assert.equal(itemNorm(5), 100);
});

// ---------------------------------------------------------------- §7.4·§7.5 종합 점수

test("Match_Score는 이론적 최저에서도 0 아래로 내려가지 않는다", () => {
  assert.equal(matchScore({ delta: 0, risk: 0, gap: 0 }), 100);
  // 기획서 §7.4 예시: ΔDISC 20 · Risk 4 · Gap 30 → 81점
  assert.equal(matchScore({ delta: 20, risk: 4, gap: 30 }), 81);
  const worst = matchScore({ delta: 100, risk: 18, gap: 100 });
  assert.ok(worst >= 0);
  assert.equal(worst, 100 - (WEIGHTS.delta * 100 + WEIGHTS.risk * 18 + WEIGHTS.gap * 100));
});

test("등급 구간은 경계 ±3점을 높은 쪽으로 완충한다", () => {
  assert.equal(matchBand(90).lead, "strength");
  assert.equal(matchBand(75).lead, "balanced");
  assert.equal(matchBand(60).lead, "growth");
  assert.equal(matchBand(30).lead, "support");
  // 오차 범위 안이면 낙담시키지 않고 위 구간 문구를 쓴다
  assert.equal(matchBand(82).lead, "strength");
  assert.equal(matchBand(67).lead, "balanced");
  assert.equal(matchBand(47).lead, "growth");
  assert.equal(matchBand(46).lead, "support");
});

test("사용자에게 나가는 것은 숫자가 아니라 구간 서술이다", () => {
  for (const score of [0, 25, 55, 75, 95]) {
    const band = matchBand(score);
    assert.ok(band.tone.length > 0);
    assert.ok(!/\d/.test(band.tone), `구간 문구에 숫자가 들어 있다: ${band.tone}`);
  }
});

// ---------------------------------------------------------------- §8.2 게이지

test("단둘 시간이 늘면 연인 비중이 오르고, 양육 스트레스가 늘면 내려간다", () => {
  // v1 산식은 K2를 100에서 빼는 방향 오류가 있었다. 여기가 뒤집히면 그 버그의 재발이다.
  const base = { K2: 3, K4: 3 };
  const flat = romanceRatio(base, base);
  assert.equal(flat.romance, 50);
  assert.equal(flat.parenting, 50);

  assert.ok(romanceRatio({ K2: 5, K4: 3 }, base).romance > flat.romance);
  assert.ok(romanceRatio({ K2: 1, K4: 3 }, base).romance < flat.romance);
  assert.ok(romanceRatio({ K2: 3, K4: 5 }, base).romance < flat.romance);
  assert.ok(romanceRatio({ K2: 3, K4: 1 }, base).romance > flat.romance);

  const r = romanceRatio({ K2: 5, K4: 1 }, { K2: 5, K4: 1 });
  assert.equal(r.romance, 100);
  assert.equal(r.parenting, 0);
});

// ---------------------------------------------------------------- 결합

test("결합 결과가 구성 요소와 방향까지 담는다", () => {
  const a = resultOf({ t: "T-H", r: "R-E", k: "K-1" });
  const b = resultOf({ t: "T-W", r: "R-C", k: "K-1" });
  const c = combine(a, b);

  assert.ok(c.score >= 0 && c.score <= 100);
  assert.ok(c.band.tone);
  for (const key of ["delta", "risk", "gap"]) {
    assert.ok(c.components[key].weighted <= c.components[key].max + 1e-9, `${key} 비중이 최대를 넘는다`);
  }
  assert.equal(c.gap.items.length, 3);
  assert.ok(c.romance, "같은 자녀 단계면 게이지가 나와야 한다");
  assert.equal(c.lowConfidence, false);
});

test("자녀 단계가 다르면 게이지를 계산하지 않는다", () => {
  // K문항은 단계마다 문장이 달라진다. 다른 문장의 점수를 평균 내면 비교 근거가 없다.
  const a = resultOf({ t: "T-H", r: "R-E", k: "K-0" });
  const b = resultOf({ t: "T-W", r: "R-C", k: "K-2" });
  assert.equal(combine(a, b).romance, null);
});

test("페르소나 이름은 같은 호칭을 골라도 깨지지 않는다", () => {
  const a = resultOf({ t: "T-H", r: "R-E", k: "K-1" });
  const b = resultOf({ t: "T-H", r: "R-C", k: "K-1" });
  const name = personaName(a, b);
  assert.ok(name.includes("×"));
  assert.ok(!name.includes("undefined"));
  assert.ok(personaName(a, resultOf({ t: "T-W", r: "R-C", k: "K-1" })).includes("아내"));
});

// ---------------------------------------------------------------- 배우자 코드

test("배우자 코드는 왕복해도 결과가 같다", () => {
  const setup = { t: "T-W", r: "R-S", k: "K-2" };
  const mine = resultOf(setup, null, { D1: 5, D2: 4, A1: 5, A2: 4, SC1: 5, AN1: 5, AN2: 2, K2: 4, R5: 2 });
  const code = encodePartner(mine);
  const back = decodePartner(code);

  assert.deepEqual(back.setup, setup);
  assert.deepEqual(back.raw, mine.raw);
  assert.deepEqual(back.comparable, mine.comparable);
  assert.deepEqual(back.norm, mine.norm);
  assert.equal(back.typeKey, mine.typeKey);
  assert.equal(back.behavior.confidence, mine.behavior.confidence);
  assert.equal(back.conflict.style, mine.conflict.style);
  assert.equal(back.validity.count, mine.validity.count);
});

test("코드는 문항별 응답을 통째로 싣지 않는다", () => {
  // 링크에 담기는 값은 부부 비교에 실제로 쓰이는 것만이어야 한다. 46문항 응답이
  // 그대로 실리면 배우자 쪽에서 원문항 단위로 복원할 수 있게 된다.
  const mine = resultOf({ t: "T-H", r: "R-E", k: "K-1" });
  const code = encodePartner(mine);
  assert.ok(code.length < 30, `코드가 너무 길다(${code.length})`);
  const back = decodePartner(code);
  assert.deepEqual(Object.keys(back.comparable).sort(), ["AN1", "AN2", "AN3", "K2", "K4", "R5", "R6"]);
  assert.equal(back.answers, undefined);
});

test("깨진 코드는 null로 떨어진다", () => {
  const code = encodePartner(resultOf({ t: "T-H", r: "R-E", k: "K-1" }));
  assert.equal(decodePartner(""), null);
  assert.equal(decodePartner(null), null);
  assert.equal(decodePartner(code.slice(0, -1)), null, "끝이 잘린 코드");
  assert.equal(decodePartner(code + "a"), null, "뒤에 붙은 코드");
  assert.equal(decodePartner("9" + code.slice(1)), null, "다른 버전");
  // 한 글자만 바뀌어도 체크섬이 잡는다
  const flipped = code.slice(0, 5) + (code[5] === "a" ? "b" : "a") + code.slice(6);
  assert.equal(decodePartner(flipped), null, "값이 변조된 코드");
});

test("코드가 대소문자·공백에 흔들리지 않는다", () => {
  const code = encodePartner(resultOf({ t: "T-H", r: "R-E", k: "K-1" }));
  assert.ok(decodePartner(`  ${code.toUpperCase()}  `));
});

test("모든 축 조합과 극단 응답에서 코드가 만들어진다", () => {
  for (const t of ["T-H", "T-W"]) {
    for (const r of ["R-E", "R-C", "R-S"]) {
      for (const k of ["K-0", "K-1", "K-2"]) {
        for (const fill of [1, 5]) {
          const setup = { t, r, k };
          // fill=1/5는 직선응답이라 플래그가 서지만, 코덱 자체는 그 상태도 실어 나를 수 있어야 한다
          const mine = resultOf(setup, fill);
          const back = decodePartner(encodePartner(mine));
          assert.ok(back, `${t}/${r}/${k} fill=${fill}에서 코드가 깨졌다`);
          assert.deepEqual(back.raw, mine.raw);
        }
      }
    }
  }
});
