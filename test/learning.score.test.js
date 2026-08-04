import test from "node:test";
import assert from "node:assert/strict";

import { similarity, feedbackTier, TIER_TEXT } from "../js/learning/basic-conversation/score.js";
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
