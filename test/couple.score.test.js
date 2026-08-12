// 부부 관계 성향 체크의 문항 구조·채점 불변식.
// 채점이 순수 함수라 브라우저 없이 여기서 전부 확인된다 — 대신 라우팅·이벤트는
// scripts/verify.cjs가 아니면 하나도 못 잡는다는 점을 기억할 것.
import test from "node:test";
import assert from "node:assert/strict";

import {
  BEHAVIOR_ITEMS,
  ATTACH_ITEMS,
  CONFLICT_ITEMS,
  ANCHOR_ITEMS,
  ANCHOR_CONCEPTS,
  QC_ITEMS,
  ROLE_ITEMS,
  CHILD_ITEMS,
  ITEM_TOTAL,
  R_AXIS,
  K_AXIS,
  COUPLE_TYPES,
  COUPLE_SLUG_TO_KEY,
  ATTACH_TYPES,
  ATTACH_DEEP,
  BEHAVIOR_AXIS_MEANING,
  BEHAVIOR_DEEP,
  CONFLICT_STYLES,
  ROLE_NARRATIVE,
  CHILD_NARRATIVE,
  DOS_BEHAVIOR,
  DOS_ATTACH,
  DONTS_BEHAVIOR,
  DONTS_ATTACH,
  CONFLICT_SCRIPTS,
  READING_TEXT,
  ROLE_IDENTITY_NOTE,
} from "../js/tests/couple/data.js";
import {
  SELF_READINGS,
  selfReadings,
  readingLevel,
  REVERSE_CODES,
  FACTOR_ITEMS,
  BEHAVIOR_AXES,
  scoreItem,
  normalize,
  stepOf,
  seedFromRaw,
  tieBreakOrder,
  validityCheck,
  reverseMismatchCount,
  anchorScores,
  resolveBehavior,
  resolveAttachment,
  resolveConflict,
  computeCouple,
} from "../js/tests/couple/score.js";
import { assembleQuestionnaire, NOTICE_POSITION } from "../js/tests/couple/assemble.js";

const SETUP = { t: "T-H", r: "R-E", k: "K-1" };
const IDENTITY = { shuffleFn: (a) => a };

// 모든 문항에 같은 값을 채운 응답. 직선 응답 검사에 그대로 걸리므로, 유효성과 무관한
// 검사에는 아래 variedAnswers()를 쓴다.
function answersOf(fill = 3, overrides = {}) {
  const items = assembleQuestionnaire(SETUP, IDENTITY);
  const out = {};
  for (const item of items) out[item.code] = fill;
  return { ...out, ...overrides };
}

// 성실하게 답한 사람에 가까운 응답. 값이 흩어져 있어 직선 응답 검사에 걸리지 않고,
// QC1은 안내대로, QC2는 I1과 같게 맞춘다.
function variedAnswers(overrides = {}) {
  const items = assembleQuestionnaire(SETUP, IDENTITY);
  const pattern = [4, 3, 5, 2, 3, 4, 1, 3];
  const out = {};
  items.forEach((item, i) => {
    out[item.code] = pattern[i % pattern.length];
  });
  out.QC1 = 2;
  out.QC2 = out.I1;
  return { ...out, ...overrides };
}

// ---------------------------------------------------------------- 문항 뱅크 구조

test("문항 수가 모듈 합계와 일치한다", () => {
  assert.equal(BEHAVIOR_ITEMS.length, 16);
  assert.equal(ATTACH_ITEMS.length, 8);
  assert.equal(CONFLICT_ITEMS.length, 6);
  // 앵커는 개념 3개 × 2문항. 서비스 차별점인 인지 격차를 단일 문항에 걸어두지 않는다.
  assert.equal(ANCHOR_ITEMS.length, ANCHOR_CONCEPTS.length * 2);
  assert.equal(QC_ITEMS.length, 2);
  assert.equal(ROLE_ITEMS.length, 6);
  assert.equal(CHILD_ITEMS.length, 5);
  assert.equal(ITEM_TOTAL, 49);
});

test("앵커는 개념마다 정확히 2문항이고 역채점이 섞이지 않는다", () => {
  for (const { key } of ANCHOR_CONCEPTS) {
    const codes = ANCHOR_ITEMS.filter((i) => i.concept === key).map((i) => i.code);
    assert.deepEqual(codes.sort(), [`${key}a`, `${key}b`]);
  }
  // 두 사람의 응답을 직접 빼는 용도라 방향 일관성이 무엇보다 중요하다.
  for (const item of ANCHOR_ITEMS) assert.ok(!REVERSE_CODES.has(item.code), `${item.code}`);
});

test("요인마다 문항 수가 균등하다", () => {
  // 요인별 문항 수가 다르면 100점 환산의 칸 크기가 요인마다 달라져서, 유형 경계 판정이
  // 어떤 요인에서는 촘촘하고 어떤 요인에서는 성기게 된다.
  for (const ax of BEHAVIOR_AXES) assert.equal(FACTOR_ITEMS[ax].length, 4, `${ax} 문항 수`);
  assert.equal(FACTOR_ITEMS.ANX.length, 4);
  assert.equal(FACTOR_ITEMS.AVO.length, 4);
  assert.equal(FACTOR_ITEMS.SC.length, 3);
  assert.equal(FACTOR_ITEMS.OC.length, 3);
});

test("역채점 코드가 전부 실제 문항에 있고, 요인마다 최소 하나씩 있다", () => {
  const all = [...BEHAVIOR_ITEMS, ...ATTACH_ITEMS, ...CONFLICT_ITEMS, ...ROLE_ITEMS].map((i) => i.code);
  for (const code of REVERSE_CODES) assert.ok(all.includes(code), `${code}는 문항 뱅크에 없다`);
  for (const [factor, codes] of Object.entries(FACTOR_ITEMS)) {
    assert.ok(codes.some((c) => REVERSE_CODES.has(c)), `${factor}에 역채점 문항이 없다`);
  }
});

test("D 요인과 갈등 자기주장성 문항이 같은 장면을 묻지 않는다", () => {
  // D3와 SC1이 사실상 같은 문장이면 (1)"주도형이라 관철형"이라는 동어반복 리포트가 나오고
  // (2)D 요인이 '갈등 상황에서의 강경함'에 오염되며 (3)한 문항의 오차가 두 축에 함께 반영된다.
  const conflictWords = ["싸움", "갈등", "밀어붙", "설득", "굽히지"];
  for (const item of BEHAVIOR_ITEMS.filter((i) => i.factor === "D")) {
    for (const w of conflictWords) {
      assert.ok(!item.text.includes(w), `${item.code}에 갈등 장면 표현이 있다: "${w}"`);
    }
  }
});

test("일관성 검사 문항은 비교 대상의 근접 패러프레이즈다", () => {
  // 가치 판단("대화 시간을 소중하게 생각한다")과 행동 성향(I1)을 비교하면 성실한 응답자가
  // 플래그를 받는다. 같은 상황·같은 행동을 묻되 표현만 다른 문장이어야 검사가 기능한다.
  const qc2 = QC_ITEMS.find((i) => i.code === "QC2").text;
  const i1 = BEHAVIOR_ITEMS.find((i) => i.code === "I1").text;
  for (const w of ["배우자", "있었던 일", "이야기"]) {
    assert.ok(qc2.includes(w) && i1.includes(w), `QC2·I1이 "${w}"를 공유하지 않는다`);
  }
});

test("가변 문항은 모든 축 버전의 문장을 갖는다", () => {
  for (const item of ROLE_ITEMS) {
    for (const ax of R_AXIS) assert.ok(item.variants[ax.code], `${item.code}에 ${ax.code} 문장이 없다`);
  }
  for (const item of CHILD_ITEMS) {
    for (const ax of K_AXIS) assert.ok(item.variants[ax.code], `${item.code}에 ${ax.code} 문장이 없다`);
  }
});

test("R5·R6은 세 역할 버전의 문장이 같다", () => {
  // 문장이 같아야 부부 간 비교가 성립한다(§5.6). 여기가 깨지면 "역할 배분의 자발성
  // 인식 차이"가 서로 다른 문장의 점수를 빼는 계산이 된다.
  for (const item of ROLE_ITEMS.filter((i) => i.shared)) {
    const texts = new Set(R_AXIS.map((ax) => item.variants[ax.code]));
    assert.equal(texts.size, 1, `${item.code}의 문장이 역할마다 다르다`);
  }
});

test("R1~R4·K1~K5는 축을 바꾸면 실제로 다른 문장을 준다", () => {
  // 위 검사는 "같아야 하는 문항이 같은가"만 본다. 이건 그 반대 — 복사·붙여넣기 실수로
  // 세 버전이 우연히 같은 문장이 되면(=축을 골라도 문항이 안 바뀌면) 위 검사는 못 잡는다.
  for (const item of ROLE_ITEMS.filter((i) => !i.shared)) {
    const texts = new Set(R_AXIS.map((ax) => item.variants[ax.code]));
    assert.equal(texts.size, R_AXIS.length, `${item.code}는 역할마다 문장이 달라야 한다`);
  }
  for (const item of CHILD_ITEMS) {
    const texts = new Set(K_AXIS.map((ax) => item.variants[ax.code]));
    assert.equal(texts.size, K_AXIS.length, `${item.code}는 자녀 단계마다 문장이 달라야 한다`);
  }
});

// ---------------------------------------------------------------- 문항지 조립

test("어떤 축 조합이든 문항 수와 코드 구성이 같다", () => {
  const baseline = assembleQuestionnaire({ t: "T-H", r: "R-E", k: "K-0" }, IDENTITY)
    .map((i) => i.code)
    .sort();
  for (const r of R_AXIS) {
    for (const k of K_AXIS) {
      const codes = assembleQuestionnaire({ t: "T-W", r: r.code, k: k.code }, IDENTITY)
        .map((i) => i.code)
        .sort();
      assert.equal(codes.length, ITEM_TOTAL, `${r.code}×${k.code}의 문항 수`);
      assert.deepEqual(codes, baseline, `${r.code}×${k.code}의 코드 구성이 다르다`);
    }
  }
});

test("앵커는 후반부에 흩어져 배치된다", () => {
  // 한 덩어리로 붙어 나오면 "여기가 배우자와 비교되는 구간"임을 알아차리고 그 구간에서만
  // 방어적으로 답하게 된다 — 앵커의 존재 이유가 정직한 비교인데 배치가 그걸 방해한다.
  for (let trial = 0; trial < 100; trial++) {
    const items = assembleQuestionnaire(SETUP);
    const at = items.map((it, i) => (it.factor === "AN" ? i + 1 : null)).filter(Boolean);
    assert.equal(at.length, ANCHOR_ITEMS.length);
    // 후반부(35번 이후) 구간 안에 전부 들어간다
    assert.ok(at[0] >= 35, `앵커가 너무 앞(${at[0]}번째)에서 시작한다`);
    assert.ok(at[at.length - 1] <= items.length, `앵커가 문항지를 벗어났다(${at[at.length - 1]})`);
    // 앵커끼리 붙지 않는다(사이에 일반 문항 최소 1개)
    for (let i = 1; i < at.length; i++) {
      assert.ok(at[i] - at[i - 1] >= 2, `앵커 ${at[i - 1]}·${at[i]}가 붙어 있다`);
    }
    // 같은 개념의 a·b는 서로 멀리 — 앞 문항을 기억하고 똑같이 맞추는 응답을 억제한다.
    for (const { key } of ANCHOR_CONCEPTS) {
      const pair = items
        .map((it, i) => (it.concept === key && it.factor === "AN" ? i : null))
        .filter((x) => x !== null);
      assert.equal(pair.length, 2, `${key}의 문항이 2개가 아니다`);
      assert.ok(pair[1] - pair[0] >= 4, `${key}의 두 문항이 ${pair[1] - pair[0]}문항 간격으로 붙어 있다`);
    }
  }
});

test("비공개 재고지 자리는 앵커 문항이 아니다", () => {
  // 특정 문항 바로 앞에 안내를 붙이면 그 문항이 민감하다는 신호가 되어, 그 구간에서만
  // 방어적으로 답하게 만든다(§6.5.2 v3.2).
  for (let trial = 0; trial < 100; trial++) {
    const items = assembleQuestionnaire(SETUP);
    assert.notEqual(items[NOTICE_POSITION - 1].factor, "AN", `${NOTICE_POSITION}번이 앵커다`);
    assert.notEqual(items[NOTICE_POSITION].factor, "AN", `재고지 바로 다음이 앵커다`);
  }
});

test("품질검사 문항은 중반부에 들어간다", () => {
  const items = assembleQuestionnaire(SETUP, IDENTITY);
  for (const qc of QC_ITEMS) {
    const at = items.findIndex((i) => i.code === qc.code);
    assert.ok(at > 5 && at < items.length - 10, `${qc.code}가 중반부 밖(${at})에 있다`);
  }
});

test("같은 요인 문항이 연달아 나오지 않는다", () => {
  // 실제 셔플로 여러 번 돌려본다 — 조립이 특정 순서에서만 규칙을 지키면 의미가 없다.
  // 품질검사(QC)는 요인이 아니라 검사 장치라 뺀다. 앵커는 요인 이격 대상이 아니라
  // 별도 규칙(위 검사)으로 배치된다.
  for (let trial = 0; trial < 200; trial++) {
    const items = assembleQuestionnaire(SETUP);
    const scored = items.filter((i) => i.factor !== "AN" && i.factor !== "QC");
    for (let i = 1; i < scored.length; i++) {
      assert.notEqual(scored[i].factor, scored[i - 1].factor, `연속된 ${scored[i].factor} 문항 (시행 ${trial})`);
    }
  }
});

test("역채점 문항이 연달아 나오지 않는다", () => {
  for (let trial = 0; trial < 200; trial++) {
    const items = assembleQuestionnaire(SETUP);
    for (let i = 1; i < items.length; i++) {
      assert.ok(
        !(REVERSE_CODES.has(items[i].code) && REVERSE_CODES.has(items[i - 1].code)),
        `연속된 역채점 문항: ${items[i - 1].code}·${items[i].code} (시행 ${trial})`
      );
    }
  }
});

// ---------------------------------------------------------------- 채점

test("역채점 문항만 뒤집힌다", () => {
  assert.equal(scoreItem("D1", 5), 5);
  assert.equal(scoreItem("D4", 5), 1);
  assert.equal(scoreItem("D4", 1), 5);
  assert.equal(scoreItem("R6", 3), 3);
  assert.throws(() => scoreItem("D1", 0));
  assert.throws(() => scoreItem("D1", 6));
});

test("정규화는 문항 수에서 분모가 파생된다", () => {
  assert.equal(normalize(4, 4), 0);
  assert.equal(normalize(20, 4), 100);
  assert.equal(normalize(12, 4), 50);
  assert.equal(normalize(3, 3), 0);
  assert.equal(normalize(15, 3), 100);
  assert.equal(stepOf(4), 6.25);
  assert.ok(Math.abs(stepOf(3) - 100 / 12) < 1e-9);
});

test("모두 3점으로 답하면 모든 요인이 50점이 된다", () => {
  // 역채점이 한쪽 방향으로만 적용되고 있으면 여기가 50에서 벗어난다.
  const r = computeCouple(answersOf(3), { elapsedMs: 400000, setup: SETUP });
  for (const factor of Object.keys(FACTOR_ITEMS)) {
    assert.equal(r.norm[factor], 50, `${factor}가 50점이 아니다`);
  }
});

test("앵커 개념 점수는 두 문항 평균이고 0.5 단위다", () => {
  const a = anchorScores(answersOf(3, { AN1a: 5, AN1b: 4, AN2a: 1, AN2b: 1, AN3a: 5, AN3b: 1 }));
  assert.equal(a.AN1.score, 4.5);
  assert.equal(a.AN2.score, 1);
  // 두 문항이 4점이나 벌어지면 본인 응답 자체가 흔들린 것으로 본다
  assert.equal(a.AN1.consistent, true);
  assert.equal(a.AN3.consistent, false);
});

// ---------------------------------------------------------------- §5.0 유효성

test("성실한 응답에는 플래그가 서지 않는다", () => {
  assert.equal(validityCheck(variedAnswers(), 400000).count, 0);
  assert.equal(reverseMismatchCount(variedAnswers()), 0);
});

test("지시 이행 문항이 틀리면 플래그가 선다", () => {
  const bad = validityCheck(variedAnswers({ QC1: 5 }), 400000);
  assert.ok(bad.flags.some((f) => f.includes("지시 이행")));
  assert.equal(bad.verdict, "warn");
});

test("정방향 만점 + 역채점 4점(차이 3.0)은 오탐하지 않는다", () => {
  // 임계값이 3이면 이 조합이 걸린다. 자기모순이 있는 응답인 건 맞지만 "안 읽고 찍기"와
  // 겹친다고 단정하기 어려워 3.5로 보수화했다(§5.0 v3.3).
  const borderline = variedAnswers({ D1: 5, D2: 5, D3: 5, D4: 4 });
  assert.equal(reverseMismatchCount(borderline), 0);
});

test("역채점 정합성 검사가 2개 요인 이상에서만 플래그를 준다", () => {
  // 정방향은 전부 5, 역채점도 5로 답하면(=읽지 않고 한쪽으로 찍기) 변환값이 1이 되어
  // 정방향 평균 5와 4점 벌어진다.
  const one = variedAnswers({ D1: 5, D2: 5, D3: 5, D4: 5 });
  assert.equal(reverseMismatchCount(one), 1);
  assert.ok(!validityCheck(one, 400000).flags.some((f) => f.includes("엇갈립니다")));

  const two = variedAnswers({ D1: 5, D2: 5, D3: 5, D4: 5, I1: 5, I2: 5, I3: 5, I4: 5 });
  assert.equal(reverseMismatchCount(two), 2);
  assert.ok(validityCheck(two, 400000).flags.some((f) => f.includes("엇갈립니다")));
});

test("직선응답·속도 검사가 각각 동작한다", () => {
  const straight = validityCheck(answersOf(4), 400000);
  assert.ok(straight.flags.some((f) => f.includes("같은 값")));
  assert.equal(straight.verdict, "blocked");

  // 130초 미만이면 플래그(문항당 2.6초 미만)
  assert.equal(validityCheck(variedAnswers(), 129000).count, 1);
  assert.equal(validityCheck(variedAnswers(), 131000).count, 0);
  // 소요시간을 모르면 속도 검사는 건너뛴다
  assert.equal(validityCheck(variedAnswers(), null).count, 0);
});

// ---------------------------------------------------------------- §5.3 행동성향

test("확신도는 원점수 1점 차이를 경계로 흡수한다", () => {
  // 정규화 점수가 6.25점 단위라 "1칸 이상이면 보통"으로 두면 문항 하나에 4점 대신 5점을
  // 누른 것까지 단정적으로 서술하게 된다. 가장 불안정한 사례를 확신 있게 전달하는 셈이다.
  const step = 6.25;
  assert.equal(resolveBehavior({ D: 50 + step, I: 50, S: 50, C: 50 }).confidence, "edge");
  assert.equal(resolveBehavior({ D: 50 + step * 2, I: 50, S: 50, C: 50 }).confidence, "moderate");
  assert.equal(resolveBehavior({ D: 50 + step * 3, I: 50, S: 50, C: 50 }).confidence, "clear");
  assert.equal(resolveBehavior({ D: 50, I: 50, S: 50, C: 50 }).confidence, "edge");
});

test("동점은 시드에 따라 갈리되 같은 시드면 항상 같다", () => {
  // 고정 순서(D>C>S>I)를 쓰면 동점 사례 전원이 D로 코드화돼 집계에서 D형 비중이
  // 실제보다 부풀려진다. 사용자 간에는 흩어지되 같은 응답이면 재현돼야 한다.
  const tied = { D: 60, I: 60, S: 60, C: 60 };
  for (const seed of [0, 1, 12345, 987654321]) {
    assert.equal(resolveBehavior(tied, seed).primary, resolveBehavior(tied, seed).primary);
  }
  const winners = new Set();
  for (let seed = 0; seed < 400; seed++) winners.add(resolveBehavior(tied, seed).primary);
  assert.deepEqual([...winners].sort(), ["C", "D", "I", "S"], "동점이 특정 요인으로만 쏠린다");

  // 동점이 아니면 시드와 무관하게 점수가 이긴다
  for (let seed = 0; seed < 50; seed++) {
    assert.equal(resolveBehavior({ D: 10, I: 60, S: 10, C: 10 }, seed).primary, "I");
  }
});

test("타이브레이크 시드는 원점수에서 나온다", () => {
  // 배우자 코드에는 응답 원본이 아니라 원점수가 실린다. 시드를 원점수에서 뽑아야
  // 상대 기기에서 다시 채점해도 같은 유형이 나온다.
  const raw = { D: 12, I: 12, S: 12, C: 12, ANX: 10, AVO: 10, SC: 9, OC: 9 };
  assert.equal(seedFromRaw(raw), seedFromRaw({ ...raw }));
  assert.notEqual(seedFromRaw(raw), seedFromRaw({ ...raw, D: 13 }));
  assert.deepEqual(tieBreakOrder(7).sort(), ["C", "D", "I", "S"], "네 요인이 모두 들어 있어야 한다");
});

// ---------------------------------------------------------------- §5.4 애착

test("애착 4분류는 중앙값 기준 2×2로 갈린다", () => {
  assert.equal(resolveAttachment(4, 4).key, "AT1");
  assert.equal(resolveAttachment(20, 4).key, "AT2");
  assert.equal(resolveAttachment(4, 20).key, "AT3");
  assert.equal(resolveAttachment(20, 20).key, "AT4");
  // 라벨은 중앙값(12점)을 포함해 "높음"으로 확정한다 — 16유형 체계가 라벨을 반드시
  // 하나 요구하므로, 이 규칙이 없으면 경계 구간이 구현자 임의 판단에 맡겨진다.
  assert.equal(resolveAttachment(12, 4).key, "AT2");
});

test("중앙값 ±1점은 라벨을 주되 확신도를 경계로 표시한다", () => {
  for (const raw of [11, 12, 13]) {
    const r = resolveAttachment(raw, 4);
    assert.equal(r.anx.edge, true, `원점수 ${raw}`);
    assert.equal(r.confidence, "edge", `원점수 ${raw}`);
    assert.ok(r.key, "경계 구간에서도 라벨은 항상 하나 결정된다");
  }
  assert.equal(resolveAttachment(10, 4).anx.edge, false);
  assert.equal(resolveAttachment(14, 4).anx.edge, false);
  // 유형 전체의 확신도는 두 축 중 더 낮은 쪽을 따른다
  assert.equal(resolveAttachment(4, 12).confidence, "edge");
  assert.equal(resolveAttachment(4, 20).confidence, "clear");
  // 혼합 구간의 정규화 점수는 43.75~56.25
  assert.equal(resolveAttachment(11, 4).anx.norm, 43.75);
  assert.equal(resolveAttachment(13, 4).anx.norm, 56.25);
});

// ---------------------------------------------------------------- §5.5 갈등

test("갈등 5스타일이 원점수 절단점에서 갈린다", () => {
  // 정규화 점수 40/60은 3문항 척도에서 어떤 응답 조합으로도 도달할 수 없는 값이라,
  // 절단점을 원점수(≤7 낮음 / 8~10 중간 / ≥11 높음)로 정의한다.
  assert.equal(resolveConflict(15, 3).style, "CS1"); // 관철형
  assert.equal(resolveConflict(3, 15).style, "CS2"); // 맞춰주기형
  assert.equal(resolveConflict(3, 3).style, "CS3"); // 보류형
  assert.equal(resolveConflict(15, 15).style, "CS4"); // 조율형
  assert.equal(resolveConflict(9, 9).style, "CS5"); // 절충형
  // 한 축만 중간이어도 절충형이다 — "양축이 모두 중간"이 아니다
  assert.equal(resolveConflict(15, 9).style, "CS5");
  // 절단점 경계값 자체
  assert.equal(resolveConflict(7, 3).style, "CS3");
  assert.equal(resolveConflict(11, 3).style, "CS1");
});

test("절단점 바로 옆 원점수는 경계로 표시된다", () => {
  // 원점수 1점 차이로 스타일이 뒤집히는 자리는 전부 경계로 잡혀야 한다.
  for (const raw of [7, 8, 10, 11]) {
    assert.equal(resolveConflict(raw, 9).confidence, "edge", `SC 원점수 ${raw}`);
    assert.equal(resolveConflict(9, raw).confidence, "edge", `OC 원점수 ${raw}`);
  }
  for (const raw of [3, 6, 12, 15]) {
    assert.equal(resolveConflict(raw, 9).confidence, "clear", `SC 원점수 ${raw}`);
  }
});

// ---------------------------------------------------------------- 결과 콘텐츠

// 사용자에게 그대로 렌더되는 문구 전부. 금지어 검사 두 개가 같은 목록을 봐야 한다 —
// 목록을 검사마다 따로 두면 새 문구 뱅크를 한쪽에만 추가하는 실수가 난다.
function userFacingCopy() {
  return [
    ...Object.values(COUPLE_TYPES).flatMap((t) => [t.name, t.desc]),
    ...Object.values(ATTACH_TYPES).flatMap((t) => [t.name, t.desc]),
    ...Object.values(CONFLICT_STYLES).flatMap((t) => [t.name, t.desc, t.crisis, t.repair, t.avoid]),
    ...Object.values(BEHAVIOR_AXIS_MEANING),
    ...Object.values(BEHAVIOR_DEEP).flatMap((d) => [d.short, ...DEEP_PARTS.map((p) => d[p])]),
    ...Object.values(ATTACH_DEEP).flatMap((d) => DEEP_PARTS.map((p) => d[p])),
    ...Object.values(READING_TEXT).flatMap((t) => [t.label, t.desc, t.low, t.mid, t.high, t.script]),
    ...Object.values(ROLE_IDENTITY_NOTE),
  ];
}

test("16유형 표와 슬러그가 서로 빠짐없이 대응한다", () => {
  const keys = Object.keys(COUPLE_TYPES);
  assert.equal(keys.length, 16);
  assert.equal(Object.keys(COUPLE_SLUG_TO_KEY).length, 16, "슬러그가 겹친다");
  for (const [key, t] of Object.entries(COUPLE_TYPES)) {
    assert.equal(COUPLE_SLUG_TO_KEY[t.slug], key);
    assert.match(t.slug, /^[a-z0-9-]+$/, `${key}의 슬러그가 주소 규칙에 안 맞는다`);
    // 유형 코드에 원 척도 약어를 쓰지 않는다(§2.1 B등급 — 유형 코드 전면 재작성)
    assert.match(key, /^[DISC]-AT[1-4]$/, `${key}가 자사 코드 체계를 따르지 않는다`);
  }
});

test("사용자에게 보이는 문구에 원 척도 유형명이 없다", () => {
  // §2.1 B등급 방침("유형 코드 전면 재작성")과 §8.5(자기비난 유발 표현 금지)를 함께 지킨다.
  // 원 척도의 표준 번역어를 그대로 쓰면 명칭만 바꾼 껍데기가 된다.
  const banned = ["집착형", "두려움형", "회피형", "안정형 애착", "경쟁형", "순응형", "협력형", "타협형"];
  for (const text of userFacingCopy()) {
    for (const w of banned) assert.ok(!text.includes(w), `"${w}"가 노출 문구에 있다: ${text}`);
  }
});

// 심화 서술(2026-08-11) — 점수 막대 밑 설명이 부실하다는 지적으로 추가한 문구 뱅크.
// `avoid`(피해야 할 대화법)는 같은 날 후속 질문에 답해 추가했다. 조각이 하나라도 비면
// 화면에 undefined가 그대로 찍히거나 섹션이 빈 채로 남는다.
const DEEP_PARTS = ["nature", "thought", "crisis", "talk", "avoid"];

test("네 성향·애착 유형에 심화 서술 다섯 조각이 빠짐없이 있다", () => {
  for (const ax of BEHAVIOR_AXES) {
    assert.ok(BEHAVIOR_AXIS_MEANING[ax]?.length > 5, `${ax} 축 설명`);
    const deep = BEHAVIOR_DEEP[ax];
    assert.ok(deep, `${ax} 심화 서술`);
    // 두 성향이 가깝게 나온 경우 2위 몫으로 한 줄 붙는다 — 없으면 그 문장이 반쯤 빈다.
    assert.ok(deep.short?.length > 10, `${ax} 요약 한 줄`);
    for (const part of DEEP_PARTS) {
      // 길이 하한이 있는 이유: 자리만 채운 한 문장짜리 값은 있으나 마나라, 있음 검사만
      // 하면 이번에 지적받은 상태(설명이 부실함)로 조용히 되돌아갈 수 있다.
      assert.ok(deep[part]?.length >= 60, `${ax}의 ${part}가 너무 짧다: ${deep[part]}`);
    }
  }
  for (const key of Object.keys(ATTACH_TYPES)) {
    const deep = ATTACH_DEEP[key];
    assert.ok(deep, `${key} 심화 서술`);
    for (const part of DEEP_PARTS) {
      assert.ok(deep[part]?.length >= 60, `${key}의 ${part}가 너무 짧다: ${deep[part]}`);
    }
  }
  for (const [key, style] of Object.entries(CONFLICT_STYLES)) {
    assert.ok(style.crisis?.length >= 60, `${key}의 다툼이 커질 때 서술`);
    assert.ok(style.repair?.length >= 60, `${key}의 다투고 난 뒤 서술`);
    assert.ok(style.avoid?.length >= 60, `${key}의 피해야 할 대화법 서술`);
  }
});

test("피해야 할 대화법은 구체적인 말을 인용부호로 짚는다", () => {
  // "짜증 내지 마세요" 식의 막연한 금지는 자기비난만 유발하고 뭘 조심해야 할지 모른다 —
  // 실제로 조심할 문장을 인용부호로 짚어야 쓸모가 있다는 서술 규칙을 코드로도 확인한다.
  for (const [ax, deep] of Object.entries(BEHAVIOR_DEEP)) {
    assert.ok(deep.avoid.includes("\""), `${ax}의 avoid에 인용된 말이 없다`);
  }
  for (const [key, deep] of Object.entries(ATTACH_DEEP)) {
    assert.ok(deep.avoid.includes("\""), `${key}의 avoid에 인용된 말이 없다`);
  }
  for (const [key, style] of Object.entries(CONFLICT_STYLES)) {
    assert.ok(style.avoid.includes("\""), `${key}의 avoid에 인용된 말이 없다`);
  }
});

test("심화 서술에 진단처럼 읽히는 표현이 없다 (§2.2 · D-3)", () => {
  // "성향 체크"까지만 간다. 임상 용어가 한 번 섞이면 결과 전체가 진단서처럼 읽힌다.
  const banned = ["진단", "장애", "증상", "치료", "환자", "정상", "비정상"];
  for (const text of userFacingCopy()) {
    for (const w of banned) assert.ok(!text.includes(w), `"${w}"가 노출 문구에 있다: ${text}`);
  }
});

test("가능한 모든 유형 조합에 리포트 문구가 있다", () => {
  // 문구 뱅크가 비면 화면에 undefined가 그대로 찍힌다 — 에러가 안 나서 못 알아챈다.
  for (const key of Object.keys(COUPLE_TYPES)) {
    const [primary, attach] = key.split("-");
    assert.ok(ATTACH_TYPES[attach], `${key}의 애착 유형 정의`);
    assert.ok(DOS_BEHAVIOR[primary] && DOS_BEHAVIOR[primary].length, `${key} Do 문구`);
    assert.ok(DONTS_BEHAVIOR[primary] && DONTS_BEHAVIOR[primary].length, `${key} Don't 문구`);
    assert.ok(DOS_ATTACH[attach], `${key} 애착 Do 문구`);
    assert.ok(DONTS_ATTACH[attach], `${key} 애착 Don't 문구`);
    for (const r of R_AXIS) assert.ok(ROLE_NARRATIVE[primary][r.code], `${key} × ${r.code} 서사`);
  }
  for (const k of K_AXIS) assert.ok(CHILD_NARRATIVE[k.code], `${k.code} 서사`);
  for (const style of Object.keys(CONFLICT_STYLES)) assert.ok(CONFLICT_SCRIPTS[style], `${style} 스크립트`);
});

test("결과가 유형 라벨·연속 프로필·확신도를 항상 함께 낸다", () => {
  const r = computeCouple(variedAnswers({ D1: 5, D2: 5, D3: 5 }), {
    elapsedMs: 400000,
    setup: SETUP,
  });
  assert.ok(COUPLE_TYPES[r.typeKey], `${r.typeKey}가 16유형 표에 없다`);
  for (const factor of Object.keys(FACTOR_ITEMS)) assert.equal(typeof r.norm[factor], "number");
  assert.ok(["clear", "moderate", "edge"].includes(r.behavior.confidence));
  assert.ok(["clear", "edge"].includes(r.attachment.confidence));
  assert.equal(r.validity.verdict, "ok");
  assert.deepEqual(Object.keys(r.anchors).sort(), ["AN1", "AN2", "AN3"]);
  // 부부 비교용 문항값 묶음(comparable)은 결합 리포트와 함께 사라졌다(D-99).
  // 내보낼 곳이 없는 값이 결과 객체에 남으면 다음 사람이 매번 용도를 다시 추적한다.
  assert.equal(r.comparable, undefined, "결합 리포트용 값이 결과에 남아 있다");
  // 대신 같은 문항들이 개인용 구간 값으로 나온다.
  assert.equal(r.readings.length, SELF_READINGS.length);
});

// 진행 상태를 "답이 다 찼는가"로 세면, 마지막 문항에서 뒤로 간 순간에도 답은 전부 차 있어서
// 결과 화면 guard가 통과해버린다. 예전에는 그걸 막으려고 뒤로 갈 때 답을 지웠는데,
// 그러면 직전에 뭘 골랐는지 못 보고 다시 답하게 된다. 그래서 완료 여부를 별도 플래그로 든다.
test("결과 화면 guard는 답 개수가 아니라 완료 플래그를 본다", async () => {
  const { state } = await import("../js/core/state.js");
  const { coupleReady } = await import("../js/tests/couple/screens.js");

  const items = ANCHOR_ITEMS.map((it) => ({ code: it.code }));
  const answers = {};
  for (const it of items) answers[it.code] = 3;

  state.couple.items = items;
  state.couple.answers = answers;

  state.couple.completed = false;
  assert.equal(coupleReady(), false, "답만 다 차면 통과하면 안 된다");

  state.couple.completed = true;
  assert.equal(coupleReady(), true);

  // 완료했더라도 문항지가 없으면(=새로고침으로 state가 날아간 뒤) 결과를 그릴 수 없다.
  state.couple.items = null;
  assert.equal(coupleReady(), false);
});

// ---------------------------------------------------------------- 개인 읽을거리 (D-99)

test("답한 문항은 전부 결과 어딘가에서 쓰인다", () => {
  // D-99로 결합 리포트를 없애면서 앵커·역할·자녀 문항이 통째로 죽은 문항이 될 뻔했다.
  // "답은 했는데 결과엔 안 나오는 문항"이 늘어나는 것이 결과가 부실해지는 가장 큰 원인이라,
  // 그 상태로 되돌아가는 변경을 여기서 막는다.
  const used = new Set(SELF_READINGS.flatMap((r) => r.codes));
  used.add("R3"); // 막대가 아니라 덧말(ROLE_IDENTITY_NOTE)로 쓰인다
  for (const code of Object.keys(FACTOR_ITEMS).flatMap((f) => FACTOR_ITEMS[f])) used.add(code);
  const scored = [...ANCHOR_ITEMS, ...ROLE_ITEMS, ...CHILD_ITEMS].map((i) => i.code);
  for (const code of scored) assert.ok(used.has(code), `${code}가 결과 어디에도 안 쓰인다`);
  // QC 문항만 예외 — 응답 품질 검사에만 쓰이고 결과에 나오지 않는 게 설계다.
});

test("자기보고 항목마다 구간 서술 세 개와 대화 문장이 있다", () => {
  for (const r of SELF_READINGS) {
    const t = READING_TEXT[r.key];
    assert.ok(t, `${r.key} 문구`);
    assert.ok(t.label?.length > 2 && t.desc?.length > 10, `${r.key} 라벨·설명`);
    for (const level of ["low", "mid", "high"]) {
      assert.ok(t[level]?.length >= 60, `${r.key}의 ${level} 서술이 너무 짧다: ${t[level]}`);
    }
    // watch 방향으로 나왔을 때만 붙지만, 없으면 그 순간 화면이 비어버린다.
    assert.ok(t.script?.includes("\""), `${r.key}의 대화 문장`);
    assert.ok(["low", "high"].includes(r.watch), `${r.key}의 watch 방향`);
  }
});

test("구간 경계는 3.0을 어느 쪽으로도 읽지 않는다", () => {
  assert.equal(readingLevel(1), "low");
  assert.equal(readingLevel(2.5), "low");
  assert.equal(readingLevel(2.6), "mid");
  assert.equal(readingLevel(3), "mid");
  assert.equal(readingLevel(3.4), "mid");
  assert.equal(readingLevel(3.5), "high");
  assert.equal(readingLevel(5), "high");
});

test("역채점 문항(R6)은 방향을 뒤집어 읽는다", () => {
  // R6 문장은 "바꾸는 것은 어렵다"이다. 뒤집지 않으면 "바꿀 여지가 크다"는 라벨에
  // 정반대 값이 실려, 화면 문구와 점수가 서로 반대말을 하게 된다.
  const rigid = selfReadings(variedAnswers({ R6: 5 })).find((x) => x.key === "ROLE_FLEX");
  const flexible = selfReadings(variedAnswers({ R6: 1 })).find((x) => x.key === "ROLE_FLEX");
  assert.equal(rigid.level, "low");
  assert.equal(flexible.level, "high");
});

test("눈여겨볼 방향으로 나온 항목만 watched로 표시된다", () => {
  // 부담(AN2)은 높을 때, 알아줌(AN1)은 낮을 때가 눈여겨볼 방향이다. 전부 붙이면
  // 대화 문장이 배경음이 되어 정작 지금 필요한 한 줄이 묻힌다.
  const heavy = selfReadings(variedAnswers({ AN2a: 5, AN2b: 5, AN1a: 5, AN1b: 5 }));
  assert.equal(heavy.find((x) => x.key === "AN2").watched, true);
  assert.equal(heavy.find((x) => x.key === "AN1").watched, false);
  const unseen = selfReadings(variedAnswers({ AN1a: 1, AN1b: 1 }));
  assert.equal(unseen.find((x) => x.key === "AN1").watched, true);
});

test("같은 개념 두 문항이 크게 엇갈리면 단정하지 않는다", () => {
  const shaky = selfReadings(variedAnswers({ AN3a: 1, AN3b: 5 })).find((x) => x.key === "AN3");
  assert.equal(shaky.consistent, false);
  const steady = selfReadings(variedAnswers({ AN3a: 4, AN3b: 4 })).find((x) => x.key === "AN3");
  assert.equal(steady.consistent, true);
});
