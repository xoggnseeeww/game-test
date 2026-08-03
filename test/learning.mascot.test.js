import test from "node:test";
import assert from "node:assert/strict";

import { MASCOTS, mascotFor } from "../js/learning/mascot.js";
import { SENTENCES } from "../js/learning/greeting/data.js";

test("모든 등록된 마스코트가 실제 svg 마크업이다", () => {
  for (const [mood, markup] of Object.entries(MASCOTS)) {
    assert.ok(markup.startsWith("<svg"), `${mood} 마스코트가 svg로 시작하지 않는다`);
    assert.ok(markup.endsWith("</svg>"), `${mood} 마스코트가 svg로 끝나지 않는다`);
  }
});

test("모르는 mood는 조용히 죽지 않고 기본 마스코트로 대체된다", () => {
  assert.equal(mascotFor("no-such-mood"), MASCOTS.wave);
  assert.equal(mascotFor(undefined), MASCOTS.wave);
});

test("문장 데이터의 mood는 전부 실제 마스코트를 가리킨다 (오타 방지)", () => {
  for (const s of SENTENCES) {
    assert.ok(MASCOTS[s.mood], `문장 "${s.id}"의 mood "${s.mood}"에 대응하는 마스코트가 없다`);
  }
});
