// 짧은 코드 형식 검증 · 생성 불변식. KV 발급/조회 자체는 Pages Function이라 여기서 못
// 돈다(functions/api/couple-code/) — 형식이 어긋나면 발급도 조회도 못 하므로, 이 모듈이
// 그 앞단 계약이다.
import test from "node:test";
import assert from "node:assert/strict";

import {
  SHORT_CODE_LENGTH,
  randomShortCode,
  normalizeShortCode,
  isShortCode,
  formatShortCode,
} from "../js/tests/couple/shortcode.js";

test("randomShortCode: 항상 정해진 길이의 대문자 코드를 만든다", () => {
  for (let seed = 0; seed < 50; seed++) {
    const bytes = Uint8Array.from({ length: SHORT_CODE_LENGTH }, (_, i) => (seed * 37 + i * 11) % 256);
    const code = randomShortCode(bytes);
    assert.equal(code.length, SHORT_CODE_LENGTH);
    assert.equal(code, code.toUpperCase());
    assert.ok(isShortCode(code), `${code}가 유효한 형식이어야 한다`);
  }
});

test("randomShortCode: 혼동되는 글자(I·L·O·U)를 쓰지 않는다", () => {
  // 256개 바이트 값 전부를 넣어봐서 알파벳에 절대 안 들어가는 글자를 확인한다.
  const bytes = Uint8Array.from({ length: 256 }, (_, i) => i);
  const code = randomShortCode(bytes.slice(0, SHORT_CODE_LENGTH));
  for (const ch of "ILOU") assert.ok(!code.includes(ch));

  // 256 % 32 === 0이므로 바이트 값 0~255를 32개 알파벳 문자에 고르게 매핑해야 한다 —
  // 나머지 연산에 치우침이 있으면 특정 문자만 두 배로 자주 나온다. 첫 글자만 보되,
  // 나머지 7바이트는 코드 길이를 맞추기 위한 자리값(0)으로 고정한다.
  const firstChars = new Map();
  for (const b of bytes) {
    const padded = Uint8Array.from([b, 0, 0, 0, 0, 0, 0, 0]);
    const first = randomShortCode(padded)[0];
    firstChars.set(first, (firstChars.get(first) || 0) + 1);
  }
  const freq = [...firstChars.values()];
  assert.equal(freq.length, 32, "32개 알파벳 문자가 전부 나와야 한다");
  assert.equal(new Set(freq).size, 1, "바이트 256개가 32개 문자에 정확히 8번씩 고르게 떨어져야 한다");
});

test("normalizeShortCode: 대소문자·공백·대시를 흡수한다", () => {
  assert.equal(normalizeShortCode("k7m2-qx8p"), "K7M2QX8P");
  assert.equal(normalizeShortCode("  K7M2 QX8P  "), "K7M2QX8P");
});

test("isShortCode: 길이·알파벳을 벗어나면 거짓", () => {
  assert.equal(isShortCode("K7M2QX8P"), true);
  assert.equal(isShortCode("k7m2-qx8p"), true);
  assert.equal(isShortCode("K7M2QX8"), false); // 7자
  assert.equal(isShortCode("K7M2QX8PP"), false); // 9자
  assert.equal(isShortCode("K7M2QX8I"), false); // I는 알파벳에 없다
  assert.equal(isShortCode("K7M2QX8O"), false); // O도 없다
  assert.equal(isShortCode(""), false);
  assert.equal(isShortCode("21118ah8fcc88777333544404"), false); // 25자 배우자 코드는 짧은 코드가 아니다
});

test("formatShortCode: 4+4로 끊어 보여준다", () => {
  assert.equal(formatShortCode("K7M2QX8P"), "K7M2-QX8P");
  assert.equal(formatShortCode("k7m2qx8p"), "K7M2-QX8P");
});
