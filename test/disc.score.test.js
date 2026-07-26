import test from "node:test";
import assert from "node:assert/strict";

import {
  AXES,
  OPPOSITE,
  PACE,
  PRIORITY,
  scoreTetrads,
  resolveDiscType,
  toPct,
  addBonus,
  dilemmaBonus,
  summarizeDilemma,
} from "../js/tests/disc/score.js";
import { TETRADS, DILEMMAS, DISC_TYPES, DISC_SLUG_TO_KEY, AXIS_LABELS } from "../js/tests/disc/data.js";

const N = TETRADS.length;
const EXCLUDED = ["DS", "SD", "IC", "CI"];

function answersFrom(pairs) {
  return pairs.map(([most, least]) => ({ most, least }));
}

// 12문항을 무작위로 채운 응답 하나
function randomAnswers(rand) {
  const out = [];
  for (let i = 0; i < N; i++) {
    const most = AXES[Math.floor(rand() * 4)];
    const rest = AXES.filter((a) => a !== most);
    out.push({ most, least: rest[Math.floor(rand() * 3)] });
  }
  return out;
}

// 결정론적 난수 (테스트가 매번 같은 입력을 보게)
function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

test("문항 데이터: 상황마다 D·I·S·C 선택지가 정확히 하나씩", () => {
  assert.equal(TETRADS.length, 12);
  for (const [i, t] of TETRADS.entries()) {
    assert.ok(t.scene.trim(), `${i}번 상황 문구가 비어 있다`);
    assert.equal(t.options.length, 4, `${i}번 선택지가 4개가 아니다`);
    const axes = t.options.map((o) => o.axis).sort();
    assert.deepEqual(axes, ["C", "D", "I", "S"], `${i}번 축 구성이 잘못됐다`);
    for (const o of t.options) assert.ok(o.text.trim(), `${i}번 선택지 문구가 비어 있다`);
  }
});

test("채점: 축별 원점수의 합은 항상 0 (ipsative)", () => {
  const rand = mulberry32(1);
  for (let i = 0; i < 500; i++) {
    const { raw } = scoreTetrads(randomAnswers(rand));
    const sum = AXES.reduce((s, a) => s + raw[a], 0);
    assert.equal(sum, 0);
    for (const a of AXES) assert.ok(raw[a] >= -N && raw[a] <= N);
  }
});

test("채점: 같은 선택지를 가장 나 같은 것이자 아닌 것으로 고를 수 없다", () => {
  assert.throws(() => scoreTetrads(answersFrom([["D", "D"]])));
  assert.throws(() => scoreTetrads(answersFrom([["D", "X"]])));
});

test("채점: 응답 순서가 바뀌어도 결과가 같다", () => {
  const rand = mulberry32(7);
  const answers = randomAnswers(rand);
  const shuffled = answers.slice().reverse();
  const a = scoreTetrads(answers);
  const b = scoreTetrads(shuffled);
  assert.deepEqual(a.raw, b.raw);
  assert.deepEqual(resolveDiscType(a.raw, a.mostCount), resolveDiscType(b.raw, b.mostCount));
});

test("유형 판정: 한쪽으로만 몰아 답하면 조합형이 아니라 순수형", () => {
  // 12문항 전부 D가 가장 나 같고 S가 가장 아닌 것 → D 12, S -12, I·C 0
  const { raw, mostCount } = scoreTetrads(answersFrom(Array(N).fill(["D", "S"])));
  assert.deepEqual(raw, { D: N, I: 0, S: -N, C: 0 });
  const r = resolveDiscType(raw, mostCount);
  // 2위(I 또는 C)가 0점이라 기준(2점)에 못 미치므로 조합형이 되면 안 된다
  assert.equal(r.key, "D");
  assert.equal(r.secondary, null);
});

test("유형 판정: 전부 0점이어도 터지지 않고 실재하는 유형을 준다", () => {
  const r = resolveDiscType({ D: 0, I: 0, S: 0, C: 0 });
  assert.ok(r.key in DISC_TYPES);
  assert.equal(r.flat, true);
  assert.equal(r.nearTie, true);
});

test("유형 판정: 동점이면 항상 같은 답 (결정론)", () => {
  const raw = { D: 5, I: 5, S: -5, C: -5 };
  const first = resolveDiscType(raw, { D: 0, I: 0, S: 0, C: 0 }).key;
  for (let i = 0; i < 20; i++) {
    assert.equal(resolveDiscType(raw, { D: 0, I: 0, S: 0, C: 0 }).key, first);
  }
  // 원점수가 같으면 "가장 나 같다"를 더 많이 받은 축이 앞선다
  assert.equal(resolveDiscType(raw, { D: 3, I: 7, S: 0, C: 0 }).primary, "I");
  assert.equal(resolveDiscType(raw, { D: 7, I: 3, S: 0, C: 0 }).primary, "D");
});

test("유형 판정: 대척점 조합(DS·SD·IC·CI)은 어떤 입력에도 나오지 않는다", () => {
  // 실제로 나올 수 있는 원점수 벡터를 전수로 훑는다.
  // (합이 0이고, 양수 부분의 합이 문항 수를 넘지 않는 벡터)
  let checked = 0;
  for (let d = -N; d <= N; d++) {
    for (let i = -N; i <= N; i++) {
      for (let s = -N; s <= N; s++) {
        const c = -(d + i + s);
        if (c < -N || c > N) continue;
        const pos = [d, i, s, c].filter((v) => v > 0).reduce((a, b) => a + b, 0);
        if (pos > N) continue;
        const { key, primary, secondary } = resolveDiscType({ D: d, I: i, S: s, C: c });
        assert.ok(!EXCLUDED.includes(key), `대척점 조합이 나왔다: ${key} (${d},${i},${s},${c})`);
        if (secondary) assert.notEqual(secondary, OPPOSITE[primary]);
        assert.ok(key in DISC_TYPES, `정의되지 않은 유형: ${key}`);
        checked++;
      }
    }
  }
  assert.ok(checked > 6000, `검사한 조합이 너무 적다: ${checked}`);
});

test("유형 판정: 실제 응답으로 12가지 유형에 모두 도달한다", () => {
  const rand = mulberry32(42);
  const seen = new Set();
  for (let i = 0; i < 60000 && seen.size < 12; i++) {
    const { raw, mostCount } = scoreTetrads(randomAnswers(rand));
    seen.add(resolveDiscType(raw, mostCount).key);
  }
  assert.deepEqual([...seen].sort(), Object.keys(DISC_TYPES).sort());
});

test("퍼센트 변환: 보너스를 더해도 0~100을 벗어나지 않는다", () => {
  assert.equal(toPct(-N, N), 0);
  assert.equal(toPct(0, N), 50);
  assert.equal(toPct(N, N), 100);
  // 클램프가 없으면 104%가 나오던 자리
  assert.equal(toPct(N + 1, N), 100);
  assert.equal(toPct(-N - 3, N), 0);
});

test("보너스 합산: 원점수 범위를 넘지 않게 잘린다", () => {
  const raw = { D: N, I: 0, S: -N, C: 0 };
  const out = addBonus(raw, { D: 1, S: -1 }, N);
  assert.equal(out.D, N);
  assert.equal(out.S, -N);
});

test("딜레마 게임: 축당 보너스는 +1을 넘지 않는다", () => {
  const bands = [null, "fast", "slow"];
  for (const paceBand of bands) {
    for (let task = 0; task <= 8; task++) {
      const summary = { taskCount: task, peopleCount: 8 - task, paceBand, timeouts: 0 };
      const b = dilemmaBonus(summary);
      for (const a of AXES) assert.ok(b[a] >= 0 && b[a] <= 1, `보너스가 범위를 벗어남: ${a}=${b[a]}`);
    }
  }
});

test("딜레마 게임: 선택이 갈리면 아무 보너스도 주지 않는다", () => {
  assert.deepEqual(dilemmaBonus({ taskCount: 4, peopleCount: 4, paceBand: "fast", timeouts: 0 }), {
    D: 0, I: 0, S: 0, C: 0,
  });
  assert.deepEqual(dilemmaBonus(null), { D: 0, I: 0, S: 0, C: 0 });
});

test("딜레마 게임: 속도 신호가 없으면 우선순위 축만 올린다", () => {
  const b = dilemmaBonus({ taskCount: 8, peopleCount: 0, paceBand: null, timeouts: 0 });
  // 과제 지향 두 축(D·C)에만 +1
  assert.deepEqual(b, { D: 1, I: 0, S: 0, C: 1 });
  const p = dilemmaBonus({ taskCount: 0, peopleCount: 8, paceBand: null, timeouts: 0 });
  assert.deepEqual(p, { D: 0, I: 1, S: 1, C: 0 });
});

test("딜레마 게임: 속도와 우선순위가 만나는 한 축에만 +1", () => {
  const cases = [
    [{ taskCount: 8, peopleCount: 0, paceBand: "fast" }, "D"],
    [{ taskCount: 0, peopleCount: 8, paceBand: "fast" }, "I"],
    [{ taskCount: 0, peopleCount: 8, paceBand: "slow" }, "S"],
    [{ taskCount: 8, peopleCount: 0, paceBand: "slow" }, "C"],
  ];
  for (const [summary, axis] of cases) {
    const b = dilemmaBonus({ ...summary, timeouts: 0 });
    assert.equal(b[axis], 1, `${axis}에 보너스가 안 붙었다`);
    assert.equal(AXES.reduce((s, a) => s + b[a], 0), 1, "보너스가 한 축에만 붙어야 한다");
    assert.equal(PACE[axis], summary.paceBand);
    assert.equal(PRIORITY[axis], summary.taskCount > summary.peopleCount ? "task" : "people");
  }
});

test("딜레마 요약: 시간초과가 잦으면 속도 신호를 버린다", () => {
  const rounds = Array.from({ length: 8 }, (_, i) =>
    i < 3 ? { timedOut: true, choice: "task", length: 20 } : { timedOut: false, ms: 300, choice: "task", length: 20 }
  );
  assert.equal(summarizeDilemma(rounds).paceBand, null);
});

test("딜레마 요약: 응답이 기준선 양쪽으로 갈리면 속도 신호를 만들지 않는다", () => {
  const rounds = Array.from({ length: 8 }, (_, i) => ({
    timedOut: false,
    ms: i < 4 ? 800 : 3000, // 글자당 40ms(빠름) 4개 / 150ms(느림) 4개
    choice: "task",
    length: 20,
  }));
  assert.equal(summarizeDilemma(rounds).paceBand, null);
});

test("딜레마 요약: 6라운드 이상 한쪽으로 몰리면 속도 신호를 인정한다", () => {
  const fast = Array.from({ length: 8 }, (_, i) => ({
    timedOut: false,
    ms: i < 6 ? 800 : 3000,
    choice: "people",
    length: 20,
  }));
  const s = summarizeDilemma(fast);
  assert.equal(s.paceBand, "fast");
  assert.equal(s.taskCount, 0);
  assert.equal(s.peopleCount, 8);

  const slow = fast.map((r) => ({ ...r, ms: 3000 }));
  assert.equal(summarizeDilemma(slow).paceBand, "slow");
});

test("딜레마 요약: 지연시간은 글자 수로 나눠 비교한다", () => {
  // 글자 수가 두 배면 시간도 두 배여야 같은 속도. 밀리초를 그대로 썼다면
  // 2000ms짜리 절반이 '느림'으로 분류돼 신호가 사라졌을 입력이다.
  const rounds = Array.from({ length: 8 }, (_, i) => ({
    timedOut: false,
    length: i % 2 === 0 ? 20 : 40,
    ms: i % 2 === 0 ? 800 : 1600, // 둘 다 글자당 40ms
    choice: "task",
  }));
  assert.equal(summarizeDilemma(rounds).paceBand, "fast");
});

test("딜레마 데이터: 상황마다 과제/사람 선택지가 다 있다", () => {
  assert.equal(DILEMMAS.length, 8);
  for (const [i, d] of DILEMMAS.entries()) {
    assert.ok(d.scene.trim(), `${i}번 상황 문구 누락`);
    assert.ok(d.task.trim(), `${i}번 과제 선택지 누락`);
    assert.ok(d.people.trim(), `${i}번 사람 선택지 누락`);
  }
});

test("유형 데이터: 12개 유형에 필요한 내용이 전부 있다", () => {
  const keys = Object.keys(DISC_TYPES);
  assert.equal(keys.length, 12);
  for (const key of keys) {
    const t = DISC_TYPES[key];
    for (const field of ["slug", "emoji", "name", "subtitle", "desc", "tip"]) {
      assert.ok(t[field] && t[field].trim(), `${key}.${field} 누락`);
    }
    assert.equal(t.tags.length, 3, `${key} 태그가 3개가 아니다`);
    for (const tag of t.tags) assert.ok(tag.startsWith("#"), `${key} 태그 형식: ${tag}`);
    for (const field of ["love", "work", "stress", "manual"]) {
      assert.ok(t.life[field] && t.life[field].trim(), `${key}.life.${field} 누락`);
    }
    // 궁합이 실재하지 않는 유형을 가리키면 결과 화면에서 undefined를 참조하게 된다
    assert.ok(t.match.best in DISC_TYPES, `${key}.match.best가 없는 유형: ${t.match.best}`);
    assert.ok(t.match.worst in DISC_TYPES, `${key}.match.worst가 없는 유형: ${t.match.worst}`);
    assert.notEqual(t.match.best, key, `${key}의 궁합이 자기 자신`);
    assert.notEqual(t.match.best, t.match.worst, `${key}의 잘 맞음/부딪힘이 같다`);
  }
});

test("유형 데이터: 궁합이 두 기저 축의 규칙과 맞는다", () => {
  for (const [key, t] of Object.entries(DISC_TYPES)) {
    const primary = key[0];
    // 잘 맞음 = 속도·우선순위 둘 다 반대 (대척점)
    assert.equal(t.match.best, OPPOSITE[primary], `${key}의 잘 맞는 유형이 규칙과 다르다`);
    // 부딪힘 = 우선순위는 같고 속도가 다름
    assert.equal(PRIORITY[t.match.worst], PRIORITY[primary], `${key}의 부딪히는 유형 우선순위 불일치`);
    assert.notEqual(PACE[t.match.worst], PACE[primary], `${key}의 부딪히는 유형 속도 불일치`);
  }
});

test("슬러그: 12개가 겹치지 않고 주소에 쓸 수 있는 형태이며 왕복한다", () => {
  const slugs = Object.values(DISC_TYPES).map((t) => t.slug);
  assert.equal(new Set(slugs).size, 12, "슬러그가 겹친다");
  for (const slug of slugs) assert.match(slug, /^[a-z0-9-]+$/);
  for (const [key, t] of Object.entries(DISC_TYPES)) {
    assert.equal(DISC_SLUG_TO_KEY[t.slug], key);
  }
  assert.equal(Object.keys(DISC_SLUG_TO_KEY).length, 12);
});

test("축 이름표가 네 축 모두 있다", () => {
  for (const a of AXES) assert.ok(AXIS_LABELS[a], `${a} 이름표 누락`);
});
