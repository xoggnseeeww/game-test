// 9급 공무원 영단어(js/learning/civil-vocab) 데이터·로직 검사.
//
// 이 도구는 콘텐츠가 8000단어까지 늘어날 예정이고, 코드는 M1에서 거의 끝나고 **나머지는
// 전부 데이터**다. 그래서 여기 검사들은 "코드가 도는가"보다 **데이터가 규칙을 지키는가**에
// 무게가 있다 — 파일만 추가하다가 조용히 깨질 수 있는 것들(매니페스트와 실제 개수 불일치,
// 표제어 중복, 사전에 없는 어근, 보기 4개를 못 만드는 DAY)을 자동으로 잡는다.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { DAYS, STAGES, TOTAL_WORDS, QUIZ_CHOICES, findDay } from "../js/learning/civil-vocab/manifest.js";
import { ROOTS, ROOT_BY_ID } from "../js/learning/civil-vocab/roots.js";
import { dayIdOf, loadDay } from "../js/learning/civil-vocab/loader.js";
import { makeRng, buildQuiz, makeQuestion, primaryMeaning, accuracy, shuffleWith } from "../js/learning/civil-vocab/session.js";

const ROOT_DIR = path.join(import.meta.dirname, "..");

async function allWords() {
  const out = [];
  for (const day of DAYS) out.push(...(await loadDay(day.id)).map((w) => ({ ...w, day: day.id })));
  return out;
}

test("매니페스트의 DAY 개수와 실제 단어 파일이 일치한다", async () => {
  for (const day of DAYS) {
    const words = await loadDay(day.id);
    assert.equal(words.length, day.count, `${day.id}: 매니페스트 ${day.count} vs 파일 ${words.length}`);
  }
  const words = await allWords();
  assert.equal(words.length, TOTAL_WORDS);
});

test("단어 id는 자기 DAY를 가리키고 중복이 없다", async () => {
  const seen = new Set();
  for (const day of DAYS) {
    const words = await loadDay(day.id);
    words.forEach((w, i) => {
      assert.equal(dayIdOf(w.id), day.id, `${w.id}가 ${day.id}에 있는데 id는 ${dayIdOf(w.id)}를 가리킨다`);
      assert.equal(w.id, `v${day.id.slice(4)}-${String(i + 1).padStart(2, "0")}`, `${w.id}: 순번이 어긋난다`);
      assert.ok(!seen.has(w.id), `id 중복: ${w.id}`);
      seen.add(w.id);
    });
  }
});

test("표제어가 DAY를 가로질러 중복되지 않는다", async () => {
  const words = await allWords();
  const seen = new Map();
  for (const w of words) {
    assert.ok(!seen.has(w.word), `표제어 중복: ${w.word} (${seen.get(w.word)} · ${w.day})`);
    seen.set(w.word, w.day);
  }
});

test("모든 단어가 필수 필드를 갖는다", async () => {
  for (const w of await allWords()) {
    assert.ok(w.word && /^[a-z]+$/.test(w.word), `${w.id}: 표제어가 이상하다 — ${w.word}`);
    assert.ok(w.pos, `${w.id}: 품사가 없다`);
    assert.ok(Array.isArray(w.ko) && w.ko.length > 0, `${w.id}: 뜻이 없다`);
    assert.ok(Number.isInteger(w.freq) && w.freq >= 1 && w.freq <= 5, `${w.id}: 빈출 등급이 이상하다`);
    assert.ok(w.ex && w.ex.en && w.ex.ko, `${w.id}: 예문이 없다`);
    assert.ok(typeof w.hint === "string" && w.hint.length > 0, `${w.id}: 연상 힌트가 없다`);
    assert.ok(Array.isArray(w.roots), `${w.id}: roots가 배열이 아니다`);
  }
});

// 어원이 뚜렷하지 않은 단어에 억지 어원을 붙이지 않는 대신(D-94와 같은 판단), 그런 단어는
// 소리연상이라도 있어야 한다 — 둘 다 없으면 "그냥 외워라"가 되어 이 도구의 이유가 없어진다.
test("어근이 없는 단어에는 소리연상이 있다", async () => {
  for (const w of await allWords()) {
    if (w.roots.length === 0) {
      assert.ok(w.sound, `${w.id}(${w.word}): 어근도 소리연상도 없다`);
    }
  }
});

test("단어가 가리키는 어근이 사전에 실재한다", async () => {
  for (const w of await allWords()) {
    for (const id of w.roots) {
      assert.ok(ROOT_BY_ID.has(id), `${w.id}(${w.word})가 없는 어근 ${id}를 가리킨다`);
    }
  }
});

// elementary-conversation의 "죽은 grammarPoint 금지"와 같은 규칙 — 사전에만 있고 아무 단어도
// 안 쓰는 항목은 지운다. 어원 사전이 "언젠가 쓸 목록"이 되면 관리가 안 된다.
test("아무 단어도 쓰지 않는 어근이 없다", async () => {
  const used = new Set((await allWords()).flatMap((w) => w.roots));
  for (const root of ROOTS) {
    assert.ok(used.has(root.id), `죽은 어근: ${root.id}`);
  }
  const ids = ROOTS.map((r) => r.id);
  assert.equal(new Set(ids).size, ids.length, "어근 id가 겹친다");
});

test("예문에 표제어가 (굴절형 포함) 들어 있다", async () => {
  for (const w of await allWords()) {
    const stem = w.word.replace(/(y|e)$/, "").toLowerCase();
    assert.ok(w.ex.en.toLowerCase().includes(stem), `${w.id}(${w.word}): 예문에 표제어가 없다 — ${w.ex.en}`);
  }
});

test("모든 DAY가 4지선다를 만들 수 있다", async () => {
  for (const day of DAYS) {
    const words = await loadDay(day.id);
    assert.ok(words.length >= QUIZ_CHOICES, `${day.id}: 단어가 보기 수보다 적다`);
    const rng = makeRng(1);
    for (const w of words) {
      const q = makeQuestion(w, words, rng);
      assert.equal(q.options.length, QUIZ_CHOICES, `${w.id}: 보기를 ${QUIZ_CHOICES}개 못 만든다(같은 뜻이 너무 많다)`);
      assert.equal(new Set(q.options).size, q.options.length, `${w.id}: 보기에 같은 뜻이 두 번 나온다`);
      assert.equal(q.options[q.answerIndex], primaryMeaning(w));
    }
  }
});

test("문제지는 시드가 같으면 그대로 재현된다", async () => {
  const words = await loadDay(DAYS[0].id);
  const a = buildQuiz(words, makeRng(42));
  const b = buildQuiz(words, makeRng(42));
  assert.deepEqual(a, b);
  const c = buildQuiz(words, makeRng(43));
  assert.notDeepEqual(a, c);
  assert.equal(a.length, words.length);
});

test("shuffleWith는 원본을 건드리지 않고 같은 원소를 돌려준다", () => {
  const src = [1, 2, 3, 4, 5];
  const out = shuffleWith(src, makeRng(3));
  assert.deepEqual(src, [1, 2, 3, 4, 5]);
  assert.deepEqual([...out].sort(), [...src].sort());
});

test("accuracy는 0으로 나누지 않는다", () => {
  assert.equal(accuracy(0, 0), 0);
  assert.equal(accuracy(3, 4), 75);
});

test("로더는 매니페스트에 없는 DAY를 거부한다", async () => {
  assert.equal(findDay("day-999"), null);
  await assert.rejects(() => loadDay("day-999"));
  await assert.rejects(() => loadDay("../../../core/state"));
  assert.equal(dayIdOf("이상한값"), null);
});

// 이 도구의 전제 자체를 지키는 검사 — 단어 파일이 정적 import되는 순간 8000단어가 부팅에
// 실린다. 규칙은 주석으로만 두면 다음 사람이 무심코 깬다.
test("단어 파일(words/day-*.js)을 정적 import하는 곳이 없다", () => {
  const jsDir = path.join(ROOT_DIR, "js");
  const walk = (dir) =>
    fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
      const p = path.join(dir, e.name);
      return e.isDirectory() ? walk(p) : p.endsWith(".js") ? [p] : [];
    });
  for (const file of walk(jsDir)) {
    // 주석에 파일 이름을 언급한 것까지 잡으면 오탐이라, 주석을 걷어내고 본다
    // (modules.test.js가 같은 이유로 쓰는 방식).
    const src = fs
      .readFileSync(file, "utf8")
      .replace(/\/\/[^\n]*/g, "")
      .replace(/\/\*[\s\S]*?\*\//g, "");
    const statik = /^\s*import\s[^\n]*["'][^"'\n]*words\/day-/m.test(src);
    assert.ok(!statik, `${path.relative(ROOT_DIR, file)}이 단어 파일을 정적 import한다`);
  }
});

test("스테이지·DAY 메타데이터가 화면에 필요한 값을 갖는다", () => {
  assert.ok(STAGES.length > 0);
  for (const stage of STAGES) {
    assert.ok(stage.id && stage.label && stage.emoji && stage.days.length > 0);
  }
  for (const day of DAYS) {
    assert.ok(day.label && day.theme && day.stage, `${day.id}: 메타데이터가 비었다`);
    assert.equal(findDay(day.id), day);
  }
});
