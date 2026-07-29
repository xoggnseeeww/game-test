// 부부 매칭 연산과 배우자 코드 코덱.
import test from "node:test";
import assert from "node:assert/strict";

import { computeCouple } from "../js/tests/couple/score.js";
import { assembleQuestionnaire } from "../js/tests/couple/assemble.js";
import { ANCHOR_CONCEPTS } from "../js/tests/couple/data.js";
import {
  behaviorDynamics,
  ATTACH_PAIR_TAGS,
  attachPairTag,
  gapScore,
  envCompare,
  ENV_ITEMS,
  roleOverlap,
  combine,
  coupleReportBlock,
  personaName,
  encodePartner,
  decodePartner,
} from "../js/tests/couple/match.js";

const IDENTITY = { shuffleFn: (a) => a };
const ATTACH_KEYS = ["AT1", "AT2", "AT3", "AT4"];

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

// ---------------------------------------------------------------- §7.2 성향 조합

test("단일 궁합 점수를 만들지 않는다", () => {
  // "궁합 87점" 같은 값은 근거가 빈약한데도 확정적으로 들려서, 오분류 위험이 있는
  // 정밀함의 대표 사례다. 점수·등급을 되살리려는 변경은 여기서 걸린다.
  const a = resultOf({ t: "T-H", r: "R-E", k: "K-1" });
  const b = resultOf({ t: "T-W", r: "R-C", k: "K-1" });
  const c = combine(a, b);
  assert.equal(c.score, undefined, "종합 점수가 결합 결과에 들어 있다");
  assert.equal(c.band, undefined, "등급 구간이 결합 결과에 들어 있다");
});

test("행동성향 조합은 원점수 차로 세 구간으로만 갈린다", () => {
  const base = { D: 12, I: 12, S: 12, C: 12 };
  const near = behaviorDynamics(base, { ...base, D: 13 });
  assert.equal(near.find((d) => d.axis === "D").levelKey, "similar");
  assert.equal(behaviorDynamics(base, { ...base, D: 14 }).find((d) => d.axis === "D").levelKey, "complement");
  assert.equal(behaviorDynamics(base, { ...base, D: 15 }).find((d) => d.axis === "D").levelKey, "complement");
  assert.equal(behaviorDynamics(base, { ...base, D: 16 }).find((d) => d.axis === "D").levelKey, "contrast");
  // 요인 이름이 구간 이름에 덮이면 화면에 구간명이 두 번 찍힌다
  assert.equal(near.find((d) => d.axis === "D").label, "주도형");
  assert.equal(near.length, 4);
});

test("애착 조합 태그가 모든 조합에 있고 순서에 무관하다", () => {
  for (const a of ATTACH_KEYS) {
    for (const b of ATTACH_KEYS) {
      assert.ok(attachPairTag(a, b), `${a}×${b} 태그가 없다`);
      assert.equal(attachPairTag(a, b), attachPairTag(b, a), `${a}×${b}가 순서에 따라 달라진다`);
    }
  }
  // 4유형의 순서 없는 조합은 10가지
  assert.equal(Object.keys(ATTACH_PAIR_TAGS).length, 10);
  // 개인 유형명과 부부 조합 태그가 같은 단어를 쓰면 화면에서 구분되지 않는다
  for (const t of Object.values(ATTACH_PAIR_TAGS)) {
    assert.ok(!t.tag.includes("조심스러운 접근형"), `조합 태그가 개인 유형명과 겹친다: ${t.tag}`);
  }
});

// ---------------------------------------------------------------- §7.3 Gap Score

function anchorsOf(scores, consistent = true) {
  const out = {};
  ANCHOR_CONCEPTS.forEach(({ key }, i) => {
    out[key] = { score: scores[i], consistent };
  });
  return out;
}

test("Gap Score는 앵커 개념 점수 차로 세 구간을 낸다", () => {
  const a = anchorsOf([5, 3, 2]);
  const b = anchorsOf([5, 4.5, 4.5]);
  const g = gapScore(a, b);
  assert.equal(g.items.length, ANCHOR_CONCEPTS.length);
  assert.equal(g.items[0].diff, 0);
  assert.equal(g.items[0].levelKey, "low");
  assert.equal(g.items[1].diff, 1.5);
  assert.equal(g.items[1].levelKey, "mid"); // 2문항 평균이라 1.5라는 중간 값이 생긴다
  assert.equal(g.items[2].diff, 2.5);
  assert.equal(g.items[2].levelKey, "high");
  // 개념명이 구간명에 덮이지 않는다
  assert.equal(g.items[0].label, ANCHOR_CONCEPTS[0].label);
});

test("격차는 크기와 개념명만 내보내고 방향은 내보내지 않는다", () => {
  // 누가 더 낮게 답했는지는 §6.5.1 원칙에 따라 끝까지 비공개다. direction 같은 필드가
  // 되살아나면 화면이 다시 한쪽을 지목하게 된다.
  const g = gapScore(anchorsOf([5, 1, 3]), anchorsOf([1, 5, 3]));
  for (const item of g.items) {
    assert.equal(item.direction, undefined, `${item.key}에 방향 정보가 있다`);
    assert.ok(item.diff >= 0);
  }
});

test("개념 내부 일관성이 깨지면 그 개념을 격차 항목에서 뺀다", () => {
  // 본인 응답 자체가 흔들리는 개념을 부부 간 격차로 제시하면 근거 없는 갈등을 만든다.
  const a = anchorsOf([5, 3, 2]);
  a.AN2.consistent = false;
  const g = gapScore(a, anchorsOf([1, 1, 2]));
  assert.equal(g.items.find((i) => i.key === "AN1").shown, true);
  assert.equal(g.items.find((i) => i.key === "AN2").shown, false);
});

test("격차가 작은 항목이 먼저 배치된다", () => {
  // 부정적인 내용으로 리포트를 시작하지 않는다(§8.2 긍정 항목 우선 배치).
  const a = resultOf({ t: "T-H", r: "R-E", k: "K-1" }, null, { AN1a: 5, AN1b: 5, AN3a: 1, AN3b: 1 });
  const b = resultOf({ t: "T-W", r: "R-C", k: "K-1" }, null, { AN1a: 5, AN1b: 5, AN3a: 5, AN3b: 5 });
  const c = combine(a, b);
  for (let i = 1; i < c.gapOrdered.length; i++) {
    assert.ok(c.gapOrdered[i].diff >= c.gapOrdered[i - 1].diff, "격차가 큰 항목이 앞에 왔다");
  }
});

// ---------------------------------------------------------------- §7.4 환경축 · 역할 인식

test("환경축은 양쪽 문장이 같은 문항만 비교한다", () => {
  // R1~R4는 역할마다 문장이 달라 비교하면 안 된다.
  const codes = ENV_ITEMS.map((i) => i.code);
  for (const banned of ["R1", "R2", "R3", "R4"]) {
    assert.ok(!codes.includes(banned), `${banned}가 부부 비교에 들어갔다`);
  }
  assert.deepEqual(codes.sort(), ["K1", "K2", "K3", "K4", "K5", "R5", "R6"]);

  const same = { R5: 3, R6: 3, K1: 3, K2: 3, K3: 3, K4: 3, K5: 3 };
  assert.ok(envCompare(same, same).every((i) => i.levelKey === "low"));
  const far = envCompare(same, { ...same, K2: 5 }).find((i) => i.code === "K2");
  assert.equal(far.diff, 2);
  assert.equal(far.levelKey, "mid");
});

test("두 사람이 같은 역할을 고르면 인식 불일치 인사이트가 된다", () => {
  // R축은 자기 인식이라 겹칠 수 있고, 겹치는 것 자체가 의미 있는 신호다 — 오류로 막지 않는다.
  assert.ok(roleOverlap({ r: "R-E" }, { r: "R-E" }));
  assert.ok(roleOverlap({ r: "R-C" }, { r: "R-C" }));
  // 둘 다 동등 분담이면 인식이 일치한 정상 상태
  assert.equal(roleOverlap({ r: "R-S" }, { r: "R-S" }), null);
  assert.equal(roleOverlap({ r: "R-E" }, { r: "R-C" }), null);
});

// ---------------------------------------------------------------- §7.6 발급 조건

test("자녀 단계 불일치를 응답 품질보다 먼저 알린다", () => {
  // 둘 다 걸린 경우 "다시 천천히 답해 주세요"를 먼저 안내하면, 문항을 다시 다 풀고 나서도
  // 축이 어긋나 또 막힌다. 재응답으로 풀리지 않는 문제를 먼저 알려줘야 한다.
  const a = resultOf({ t: "T-H", r: "R-E", k: "K-0" });
  const bad = resultOf({ t: "T-W", r: "R-C", k: "K-2" }, 5, { QC1: 5 });
  assert.equal(bad.validity.verdict, "blocked");
  assert.equal(coupleReportBlock(a, bad), "childStage");
});

test("자녀 단계가 다르면 결합 리포트를 발급하지 않는다", () => {
  // 자녀 단계는 객관적 사실이라 갈릴 수 없다. 갈리면 K문항의 문장 자체가 달라져
  // 비교 근거가 사라진다.
  const a = resultOf({ t: "T-H", r: "R-E", k: "K-0" });
  const b = resultOf({ t: "T-W", r: "R-C", k: "K-2" });
  assert.equal(coupleReportBlock(a, b), "childStage");

  const same = resultOf({ t: "T-W", r: "R-C", k: "K-0" });
  assert.equal(coupleReportBlock(a, same), null);
});

test("한쪽이라도 플래그 2개 이상이면 결합 리포트를 발급하지 않는다", () => {
  const ok = resultOf({ t: "T-H", r: "R-E", k: "K-1" });
  // 전 문항에 5점만 찍은 응답: 직선 응답 + 지시 미이행 + 역채점 정합성 세 가지가 함께 걸린다
  const bad = resultOf({ t: "T-W", r: "R-C", k: "K-1" }, 5, { QC1: 5 });
  assert.equal(bad.validity.verdict, "blocked");
  assert.equal(coupleReportBlock(ok, bad), "validity");
  assert.equal(coupleReportBlock(bad, ok), "validity");
});

test("결합 결과가 필요한 블록을 모두 담는다", () => {
  const a = resultOf({ t: "T-H", r: "R-E", k: "K-1" });
  const b = resultOf({ t: "T-W", r: "R-C", k: "K-1" });
  const c = combine(a, b);
  assert.equal(c.dynamics.length, 4);
  assert.ok(c.attachTag.tag);
  assert.equal(c.gap.items.length, ANCHOR_CONCEPTS.length);
  assert.equal(c.env.length, ENV_ITEMS.length);
  assert.equal(c.lowConfidence, false);
});

test("페르소나 이름은 같은 호칭을 골라도 깨지지 않는다", () => {
  // 동성 부부 등 두 사람이 같은 호칭을 고르는 것은 오류가 아니다(§9.2).
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
  const mine = resultOf(setup, null, { D1: 5, D2: 4, A1: 5, SC1: 5, AN1a: 5, AN1b: 4, K2: 4, R5: 2 });
  const back = decodePartner(encodePartner(mine));

  assert.deepEqual(back.setup, setup);
  assert.deepEqual(back.raw, mine.raw);
  assert.deepEqual(back.comparable, mine.comparable);
  assert.deepEqual(back.anchors, mine.anchors);
  assert.deepEqual(back.norm, mine.norm);
  assert.equal(back.typeKey, mine.typeKey);
  assert.equal(back.behavior.confidence, mine.behavior.confidence);
  assert.equal(back.conflict.style, mine.conflict.style);
  assert.equal(back.validity.count, mine.validity.count);
});

test("코드에 앵커 문항별 응답값이 실리지 않는다", () => {
  // 개념 점수(2문항 합)만 실으므로 원 문항값을 되돌릴 수 없다 — 합이 6이면 1+5인지
  // 3+3인지 구분되지 않는다. 같은 개념 점수를 만드는 서로 다른 응답은 같은 코드를 낸다.
  const setup = { t: "T-H", r: "R-E", k: "K-1" };
  const one = resultOf(setup, null, { AN1a: 1, AN1b: 5 });
  const two = resultOf(setup, null, { AN1a: 3, AN1b: 3 });
  assert.equal(decodePartner(encodePartner(one)).anchors.AN1.score, 3);
  assert.equal(decodePartner(encodePartner(two)).anchors.AN1.score, 3);

  const back = decodePartner(encodePartner(one));
  assert.equal(back.answers, undefined);
  for (const code of ["AN1a", "AN1b", "AN2a", "AN2b", "AN3a", "AN3b"]) {
    assert.equal(back.comparable[code], undefined, `${code}가 코드에 실렸다`);
  }
});

test("앵커 내부 일관성 플래그가 코드에 함께 실린다", () => {
  // 받는 쪽이 격차 항목을 노출할지 판단하려면 이 정보가 필요하다.
  const setup = { t: "T-H", r: "R-E", k: "K-1" };
  const shaky = resultOf(setup, null, { AN2a: 1, AN2b: 5 });
  const back = decodePartner(encodePartner(shaky));
  assert.equal(back.anchors.AN2.consistent, false);
  assert.equal(back.anchors.AN1.consistent, true);
});

test("깨진 코드는 null로 떨어진다", () => {
  const code = encodePartner(resultOf({ t: "T-H", r: "R-E", k: "K-1" }));
  assert.equal(decodePartner(""), null);
  assert.equal(decodePartner(null), null);
  assert.equal(decodePartner(code.slice(0, -1)), null, "끝이 잘린 코드");
  assert.equal(decodePartner(code + "a"), null, "뒤에 붙은 코드");
  assert.equal(decodePartner("9" + code.slice(1)), null, "다른 버전");
  // v1 코드(기획서 v3.0 기준)는 필드 구성이 달라 더 이상 읽히면 안 된다
  assert.equal(decodePartner("1001ggbcga5d31414151c"), null, "예전 버전 코드");
  // 한 글자만 바뀌어도 체크섬이 잡는다
  const flipped = code.slice(0, 5) + (code[5] === "a" ? "b" : "a") + code.slice(6);
  assert.equal(decodePartner(flipped), null, "값이 변조된 코드");
});

test("코드의 전송 형식이 고정돼 있다 (골든 샘플)", () => {
  // encode/decode는 같이 움직이므로, 필드 순서나 VERSION을 바꿔도 왕복 검사는 그대로
  // 통과한다. 이미 공유된 링크가 조용히 다른 값으로 읽히는 사고를 잡으려면 바깥에서
  // 고정한 샘플이 하나 필요하다. 이 검사가 깨졌다면 형식이 바뀐 것이므로, 값을 고치기
  // 전에 VERSION을 올리고 예전 버전을 어떻게 처리할지부터 정할 것.
  const golden = "21118ah8fcc88777333544404";
  const back = decodePartner(golden);
  assert.ok(back, "골든 샘플이 더 이상 읽히지 않는다 — 코드 형식이 바뀌었다");
  assert.deepEqual(back.setup, { t: "T-W", r: "R-C", k: "K-1" });
  assert.deepEqual(back.raw, { D: 8, I: 10, S: 17, C: 8, ANX: 15, AVO: 12, SC: 12, OC: 8 });
  assert.deepEqual(back.comparable, { R5: 3, R6: 3, K1: 3, K2: 5, K3: 4, K4: 4, K5: 4 });
  assert.equal(back.anchors.AN1.score, 4);
  assert.equal(back.anchors.AN2.score, 3.5);
  assert.equal(back.typeKey, "S-AT4");
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
          assert.deepEqual(back.anchors, mine.anchors);
        }
      }
    }
  }
});
