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
  QC_ITEMS,
  ROLE_ITEMS,
  CHILD_ITEMS,
  ITEM_TOTAL,
  R_AXIS,
  K_AXIS,
  COUPLE_TYPES,
  COUPLE_SLUG_TO_KEY,
  ROLE_NARRATIVE,
  CHILD_NARRATIVE,
  DOS_BEHAVIOR,
  DOS_ATTACH,
  DONTS_BEHAVIOR,
  DONTS_ATTACH,
  CONFLICT_SCRIPTS,
  CONFLICT_LABELS,
} from "../js/tests/couple/data.js";
import {
  REVERSE_CODES,
  FACTOR_ITEMS,
  BEHAVIOR_AXES,
  scoreItem,
  normalize,
  stepOf,
  validityCheck,
  resolveBehavior,
  resolveAttachment,
  resolveConflict,
  computeCouple,
} from "../js/tests/couple/score.js";
import { assembleQuestionnaire, anchorStartIndex } from "../js/tests/couple/assemble.js";

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
  assert.equal(ANCHOR_ITEMS.length, 3);
  assert.equal(QC_ITEMS.length, 2);
  assert.equal(ROLE_ITEMS.length, 6);
  assert.equal(CHILD_ITEMS.length, 5);
  assert.equal(ITEM_TOTAL, 46);
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

test("앵커 문항은 맨 뒤에 연속 배치된다", () => {
  const items = assembleQuestionnaire(SETUP, IDENTITY);
  const start = anchorStartIndex(items);
  assert.equal(start, items.length - ANCHOR_ITEMS.length);
  // 앞 문항들에 답하며 자기 상황을 떠올린 뒤에 답해야 회상 정확도가 올라간다(§3.2).
  assert.ok(start >= 35, `앵커가 너무 앞(${start + 1}번째)에 있다`);
  for (const item of items.slice(start)) assert.equal(item.factor, "AN");
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
  // 앵커(AN)는 일부러 뒤에 몰아넣은 것이고, 품질검사(QC)는 요인이 아니라 검사 장치라 뺀다.
  for (let trial = 0; trial < 200; trial++) {
    const items = assembleQuestionnaire(SETUP);
    for (let i = 1; i < items.length; i++) {
      const [prev, cur] = [items[i - 1].factor, items[i].factor];
      if (prev === "AN" || cur === "AN" || prev === "QC" || cur === "QC") continue;
      assert.notEqual(cur, prev, `연속된 ${cur} 문항 (시행 ${trial})`);
    }
  }
});

test("역채점 문항이 연달아 나오지 않는다", () => {
  // 역채점이 붙어 나오면 "이번엔 반대로"라는 감각이 이어져서, 잡으려던 묵종 편향을
  // 오히려 못 잡는다.
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

// ---------------------------------------------------------------- §5.0 유효성

test("성실한 응답에는 플래그가 서지 않는다", () => {
  assert.equal(validityCheck(variedAnswers(), 400000).count, 0);
});

test("지시 이행 문항이 틀리면 플래그가 선다", () => {
  const bad = validityCheck(variedAnswers({ QC1: 5 }), 400000);
  assert.ok(bad.flags.some((f) => f.includes("지시 이행")));
  assert.equal(bad.verdict, "warn");
});

test("일관성·직선응답·속도 검사가 각각 동작한다", () => {
  assert.equal(validityCheck(variedAnswers({ QC2: 5, I1: 1 }), 400000).count, 1);

  // 전부 같은 값으로 찍으면 직선 응답 + QC1 불일치가 겹쳐 결과가 나오지 않는다.
  const straight = validityCheck(answersOf(4), 400000);
  assert.ok(straight.flags.some((f) => f.includes("같은 값")));
  assert.ok(straight.count >= 2);
  assert.equal(straight.verdict, "blocked");

  const fast = validityCheck(variedAnswers(), 60000);
  assert.equal(fast.count, 1);
  assert.equal(fast.verdict, "warn");

  // 소요시간을 모르면 속도 검사는 건너뛴다
  assert.equal(validityCheck(variedAnswers(), null).count, 0);
});

// ---------------------------------------------------------------- §5.3 행동성향

test("유형 라벨은 1위 요인 하나로만 정해지고 확신도가 따로 나온다", () => {
  const clear = resolveBehavior({ D: 75, I: 50, S: 50, C: 50 });
  assert.equal(clear.primary, "D");
  assert.equal(clear.confidence, "clear");

  // 원점수 1점 차이 = 6.25점
  const moderate = resolveBehavior({ D: 56.25, I: 50, S: 50, C: 50 });
  assert.equal(moderate.confidence, "moderate");

  const edge = resolveBehavior({ D: 50, I: 50, S: 50, C: 43.75 });
  assert.equal(edge.confidence, "edge");
});

test("동점은 D > C > S > I 순서로 갈린다", () => {
  assert.equal(resolveBehavior({ D: 60, I: 60, S: 60, C: 60 }).primary, "D");
  assert.equal(resolveBehavior({ D: 10, I: 60, S: 60, C: 60 }).primary, "C");
  assert.equal(resolveBehavior({ D: 10, I: 60, S: 60, C: 10 }).primary, "S");
  assert.equal(resolveBehavior({ D: 10, I: 60, S: 10, C: 10 }).primary, "I");
});

// ---------------------------------------------------------------- §5.4 애착

test("애착 4분류는 중앙값 기준 2×2로 갈린다", () => {
  assert.equal(resolveAttachment(4, 4).key, "Se");
  assert.equal(resolveAttachment(20, 4).key, "An");
  assert.equal(resolveAttachment(4, 20).key, "Av");
  assert.equal(resolveAttachment(20, 20).key, "Fe");
  // 원점수 12점(=50.0점)은 "높음" 쪽에 붙는다
  assert.equal(resolveAttachment(12, 4).key, "An");
});

test("중앙값 ±1점은 혼합으로 표시된다", () => {
  for (const raw of [11, 12, 13]) {
    assert.equal(resolveAttachment(raw, 4).anx.mixed, true, `원점수 ${raw}`);
  }
  assert.equal(resolveAttachment(10, 4).anx.mixed, false);
  assert.equal(resolveAttachment(14, 4).anx.mixed, false);
  // 혼합 구간의 정규화 점수는 43.75~56.25
  assert.equal(resolveAttachment(11, 4).anx.norm, 43.75);
  assert.equal(resolveAttachment(13, 4).anx.norm, 56.25);
});

// ---------------------------------------------------------------- §5.5 갈등

test("갈등 5스타일이 2축 좌표에서 나온다", () => {
  assert.equal(resolveConflict(100, 0).style, "compete");
  assert.equal(resolveConflict(0, 100).style, "accommodate");
  assert.equal(resolveConflict(0, 0).style, "avoid");
  assert.equal(resolveConflict(100, 100).style, "collaborate");
  assert.equal(resolveConflict(50, 50).style, "compromise");
});

test("절단점에서 한 칸 이내면 경계로 표시된다", () => {
  // 3문항 척도의 한 칸은 8.33점이다. 원점수 1점 차이로 스타일이 뒤집히는 값들은
  // 전부 경계로 잡혀야 한다 — 기획서에 적힌 6.25(4문항 척도의 칸)를 쓰면 절반이 샌다.
  const step = 100 / 12;
  for (const raw of [7, 8, 10, 11]) {
    const v = normalize(raw, 3);
    assert.equal(resolveConflict(v, 50).confidence, "edge", `SC 원점수 ${raw}`);
  }
  assert.equal(resolveConflict(100, 100).confidence, "clear");
  assert.ok(step > 6.25);
});

// ---------------------------------------------------------------- 결과 콘텐츠

test("16유형 표와 슬러그가 서로 빠짐없이 대응한다", () => {
  const keys = Object.keys(COUPLE_TYPES);
  assert.equal(keys.length, 16);
  assert.equal(Object.keys(COUPLE_SLUG_TO_KEY).length, 16, "슬러그가 겹친다");
  for (const [key, t] of Object.entries(COUPLE_TYPES)) {
    assert.equal(COUPLE_SLUG_TO_KEY[t.slug], key);
    assert.match(t.slug, /^[a-z0-9-]+$/, `${key}의 슬러그가 주소 규칙에 안 맞는다`);
  }
});

test("가능한 모든 유형 조합에 리포트 문구가 있다", () => {
  // 문구 뱅크가 비면 화면에 undefined가 그대로 찍힌다 — 에러가 안 나서 못 알아챈다.
  for (const key of Object.keys(COUPLE_TYPES)) {
    const [primary, attach] = key.split("-");
    assert.ok(DOS_BEHAVIOR[primary] && DOS_BEHAVIOR[primary].length, `${key} Do 문구`);
    assert.ok(DONTS_BEHAVIOR[primary] && DONTS_BEHAVIOR[primary].length, `${key} Don't 문구`);
    assert.ok(DOS_ATTACH[attach], `${key} 애착 Do 문구`);
    assert.ok(DONTS_ATTACH[attach], `${key} 애착 Don't 문구`);
    for (const r of R_AXIS) assert.ok(ROLE_NARRATIVE[primary][r.code], `${key} × ${r.code} 서사`);
  }
  for (const k of K_AXIS) assert.ok(CHILD_NARRATIVE[k.code], `${k.code} 서사`);
  for (const style of Object.keys(CONFLICT_LABELS)) assert.ok(CONFLICT_SCRIPTS[style], `${style} 스크립트`);
});

test("결과가 유형 라벨·연속 프로필·확신도를 항상 함께 낸다", () => {
  const r = computeCouple(variedAnswers({ D1: 5, D2: 5, D3: 5 }), {
    elapsedMs: 400000,
    setup: SETUP,
  });
  assert.ok(COUPLE_TYPES[r.typeKey], `${r.typeKey}가 16유형 표에 없다`);
  for (const factor of Object.keys(FACTOR_ITEMS)) assert.equal(typeof r.norm[factor], "number");
  assert.ok(["clear", "moderate", "edge"].includes(r.behavior.confidence));
  assert.equal(r.validity.verdict, "ok");
  // 부부 비교에 쓰는 값은 양쪽 문장이 같은 것만 담는다 — R1~R4가 새면 안 된다
  assert.deepEqual(Object.keys(r.comparable).sort(), ["AN1", "AN2", "AN3", "K2", "K4", "R5", "R6"]);
});
