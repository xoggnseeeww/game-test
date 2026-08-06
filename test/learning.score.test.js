import test from "node:test";
import assert from "node:assert/strict";

import { similarity, feedbackTier, scoreSpeech, TIER_TEXT } from "../js/learning/score.js";
import { CHAPTERS } from "../js/learning/basic-conversation/data.js";

test("정확히 맞히면 100%, 완전히 다르면 낮은 점수", () => {
  assert.equal(similarity("Hello!", "Hello!"), 100);
  assert.equal(similarity("xyz completely different", "Hello!") < 60, true);
});

test("대소문자·문장부호·공백 차이는 무시한다", () => {
  assert.equal(similarity("hello", "Hello!"), 100);
  assert.equal(similarity("  I'm   happy  ", "I'm happy."), 100);
});

test("피드백 3단계 경계(85%·60%)가 기획서 그대로다", () => {
  assert.equal(feedbackTier(100), "perfect");
  assert.equal(feedbackTier(85), "perfect");
  assert.equal(feedbackTier(84), "good");
  assert.equal(feedbackTier(60), "good");
  assert.equal(feedbackTier(59), "retry");
  assert.equal(feedbackTier(0), "retry");
});

test("모든 등급에 대응하는 피드백 문구가 있다", () => {
  for (const tier of ["perfect", "good", "retry"]) {
    assert.ok(TIER_TEXT[tier] && TIER_TEXT[tier].length > 0);
  }
});

test("목차는 챕터가 최소 1개 이상이고, 챕터 id가 중복되지 않는다", () => {
  assert.ok(CHAPTERS.length > 0);
  assert.equal(new Set(CHAPTERS.map((c) => c.id)).size, CHAPTERS.length);
});

test("각 챕터의 문장은 최소 1개 이상이고, 챕터 안에서 문장 id가 중복되지 않는다", () => {
  for (const ch of CHAPTERS) {
    assert.ok(ch.sentences.length > 0, `챕터 "${ch.id}"에 문장이 없다`);
    assert.equal(
      new Set(ch.sentences.map((s) => s.id)).size,
      ch.sentences.length,
      `챕터 "${ch.id}"의 문장 id가 중복된다`
    );
  }
});

// ── A-1(D-91): 정규화 확장 + 단어 단위 채점 + 오답 단어 표시 ──────────────────

test("축약형과 풀어쓴 형태를 같은 것으로 본다 (STT가 둘 중 아무거나 돌려준다)", () => {
  assert.equal(similarity("I am happy", "I'm happy."), 100);
  assert.equal(similarity("I'm happy", "I am happy."), 100);
  assert.equal(similarity("do not run", "Don't run."), 100);
  assert.equal(similarity("Let us play", "Let's play!"), 100);
  assert.equal(similarity("it is time for school", "It's time for school."), 100);
});

test("숫자를 아라비아 숫자로 인식해도 정답으로 본다", () => {
  assert.equal(similarity("School starts at 9", "School starts at nine."), 100);
  assert.equal(similarity("There are 20 students in my class", "There are twenty students in my class."), 100);
  assert.equal(similarity("I need 2 please", "I need two, please."), 100);
});

test("단어 단위라 길이에 따른 점수 왜곡이 줄어든다", () => {
  // 4단어 중 1개를 완전히 다른 단어로 → 75%
  assert.equal(similarity("I like red apples", "I like green apples"), 75);
  // 정답을 다 말하고 딴말을 덧붙이면(삽입) 깎인다 — 그냥 포함 여부로 재면 안 된다
  assert.ok(similarity("Hello there my friend", "Hello") < 60);
});

test("단어 하나의 사소한 오인식은 오답으로 세지 않는다 (발음 연습이라 인식기 흠은 봐준다)", () => {
  assert.equal(similarity("helo", "Hello!"), 100);
  assert.equal(similarity("I like drawwing", "I like drawing"), 100);
});

test("scoreSpeech가 정답 문장의 어느 단어를 놓쳤는지 짚어준다", () => {
  const r = scoreSpeech("I like green apples", "I like red apples");
  assert.deepEqual(r.tokens.map((t) => t.text), ["I", "like", "red", "apples"]);
  assert.deepEqual(r.tokens.map((t) => t.ok), [true, true, false, true]);
  assert.equal(r.pct, 75);
});

test("scoreSpeech: 다 맞히면 전부 ok이고 perfect다", () => {
  const r = scoreSpeech("It's time for school", "It's time for school.");
  assert.equal(r.tokens.every((t) => t.ok), true);
  assert.equal(r.pct, 100);
  assert.equal(r.tier, "perfect");
});

test("놓친 단어가 있으면 점수가 높아도 perfect로 올리지 않는다 (화면이 모순되지 않게)", () => {
  // 긴 문장에서 한 단어만 틀리면 단어 비율로는 85%를 넘길 수 있다
  const r = scoreSpeech(
    "My favorite subject is art because I like painting",
    "My favorite subject is art because I like drawing"
  );
  assert.ok(r.pct >= 85, `점수는 85 이상이어야 이 검사가 의미 있다 (실제: ${r.pct})`);
  assert.equal(r.tokens.some((t) => !t.ok), true, "틀린 단어가 있어야 한다");
  assert.equal(r.tier, "good", "틀린 단어가 있으면 perfect가 아니라 good이어야 한다");
});

test("scoreSpeech의 tokens는 원문 그대로라 화면에 바로 그릴 수 있다", () => {
  const r = scoreSpeech("", "Can I have more?");
  assert.deepEqual(r.tokens.map((t) => t.text), ["Can", "I", "have", "more?"]);
  assert.equal(r.tokens.every((t) => !t.ok), true, "아무 말도 안 했으면 전부 오답");
});
