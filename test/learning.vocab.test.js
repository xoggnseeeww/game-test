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

import { DAYS, STAGES, TOTAL_WORDS, QUIZ_CHOICES, findDay,
         NEW_PER_DAY_OPTIONS, MIN_NEW_PER_DAY, MAX_NEW_PER_DAY, DEFAULT_NEW_PER_DAY, normalizeNewPerDay } from "../js/learning/civil-vocab/manifest.js";
import { ROOTS, ROOT_BY_ID } from "../js/learning/civil-vocab/roots.js";
import { dayIdOf, loadDay } from "../js/learning/civil-vocab/loader.js";
import {
  makeRng, buildQuiz, makeQuestion, primaryMeaning, accuracy, shuffleWith,
  makeCloze, checkCloze, buildDailyQueue, retrievalMode, CLOZE_BLANK,
} from "../js/learning/civil-vocab/session.js";
import { newEntry, schedule, isDue, dueIds, summarize, countNewToday, EASE_MIN, MAX_INTERVAL_DAYS } from "../js/learning/civil-vocab/srs.js";
import { mergeVocabCards, rowToEntry, entryToRow, makeSyncHandler as makeVocabSyncHandler } from "../js/learning/civil-vocab/cloud.js";
import { state } from "../js/core/state.js";

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

// 칩(어근 사전)과 힌트가 서로 다른 얘기를 하면 학습자가 뭘 믿어야 할지 알 수 없다. 뜻이
// 어긋나는 것까지는 기계가 못 잡지만, **힌트에 그 어근 표기가 아예 없는 것**은 잡을 수 있다.
test("연상 힌트가 자기 어근 표기를 실제로 담고 있다", async () => {
  for (const w of await allWords()) {
    for (const id of w.roots) {
      const form = ROOT_BY_ID.get(id).form.replace(/-/g, "");
      assert.ok(w.hint.includes(form), `${w.id}(${w.word}): 힌트에 어근 ${id}(${form})가 안 보인다 — ${w.hint}`);
    }
  }
});

test("어근 사전 항목이 표시에 필요한 값을 갖는다", () => {
  for (const root of ROOTS) {
    assert.ok(root.id && root.form && root.ko, `${root.id}: form·ko가 비었다`);
    assert.ok(root.kind === "prefix" || root.kind === "stem", `${root.id}: kind가 이상하다`);
  }
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

// ── 간격 반복(D-99) ─────────────────────────────────────────────────────────
test("연속 정답이면 간격이 길어지고, 졸업(삭제)은 없다", () => {
  let e = newEntry(0);
  const seen = [];
  for (let i = 0; i < 6; i++) {
    e = schedule(e, "good", 0);
    seen.push(e.ivl);
  }
  assert.deepEqual(seen.slice(0, 2), [1, 3], "처음 두 번은 고정 간격(1일 → 3일)이어야 한다");
  for (let i = 1; i < seen.length; i++) assert.ok(seen[i] > seen[i - 1], `간격이 안 늘어난다: ${seen.join(",")}`);
  assert.ok(seen.every((d) => d <= MAX_INTERVAL_DAYS));
  // js/learning/srs.js와 결정적으로 다른 점: 아무리 잘 맞혀도 엔트리가 사라지지 않는다
  assert.ok(e && Number.isFinite(e.due), "잘 맞힌 단어가 일정에서 사라졌다");
});

test("틀리면 간격이 처음으로 돌아가고 ease가 깎인다", () => {
  let e = newEntry(0);
  for (let i = 0; i < 4; i++) e = schedule(e, "good", 0);
  const before = e.ease;
  const after = schedule(e, "again", 0);
  assert.equal(after.ivl, 0, "틀렸는데 간격이 남아 있다");
  assert.equal(after.due, 0, "틀린 단어는 오늘 다시 나와야 한다");
  assert.ok(after.ease < before);
  assert.equal(after.lapses, 1);
  assert.ok(after.ease >= EASE_MIN);
});

test("ease는 하한 아래로 내려가지 않는다", () => {
  let e = newEntry(0);
  for (let i = 0; i < 20; i++) e = schedule(e, "again", 0);
  assert.equal(e.ease, EASE_MIN);
});

test("hard는 good보다 간격이 짧다", () => {
  let base = newEntry(0);
  for (let i = 0; i < 3; i++) base = schedule(base, "good", 0);
  assert.ok(schedule(base, "hard", 0).ivl < schedule(base, "good", 0).ivl);
});

test("깨진 엔트리가 들어와도 정상 일정으로 읽는다", () => {
  for (const broken of [null, undefined, true, {}, { due: "x", ivl: -3, ease: 0.1, reps: "2" }]) {
    const next = schedule(broken, "good", 0);
    assert.ok(Number.isFinite(next.due) && next.ivl >= 1 && next.ease >= EASE_MIN, JSON.stringify(broken));
  }
  assert.equal(isDue(null, 0), true);
});

test("오늘 볼 목록은 밀린 순서대로 나온다", () => {
  const now = 1000000;
  const cards = {
    "v001-01": { due: now - 500, ivl: 1, ease: 2.5, reps: 1, lapses: 0 },
    "v001-02": { due: now + 5000, ivl: 3, ease: 2.5, reps: 2, lapses: 0 },
    "v001-03": { due: now - 9000, ivl: 1, ease: 2.5, reps: 1, lapses: 0 },
  };
  assert.deepEqual(dueIds(cards, now), ["v001-03", "v001-01"]);
  const s = summarize(cards, now);
  assert.equal(s.seen, 3);
  assert.equal(s.due, 2);
  assert.equal(s.learned, 3);
});

// ── 빈칸 채우기(D-99) ───────────────────────────────────────────────────────
test("모든 단어가 예문에서 빈칸 문제를 만들 수 있다", async () => {
  for (const w of await allWords()) {
    const cloze = makeCloze(w);
    assert.ok(cloze, `${w.id}(${w.word}): 예문에서 표제어를 못 찾았다`);
    assert.ok(cloze.sentence.includes(CLOZE_BLANK), `${w.id}: 빈칸이 안 뚫렸다`);
    // 빈칸 문장에 답이 그대로 남아 있으면 문제가 성립하지 않는다(같은 단어가 두 번 나오는 예문)
    assert.ok(
      !cloze.sentence.toLowerCase().includes(cloze.answer.toLowerCase()),
      `${w.id}: 빈칸 문장에 답이 남아 있다 — ${cloze.sentence}`
    );
    assert.equal(cloze.shape[0], cloze.answer[0]);
    assert.equal(cloze.shape.length, cloze.answer.length);
  }
});

// 지금 예문에는 같은 단어가 두 번 나오는 경우가 없어서, 실제 데이터로는 이 규칙이 검증되지
// 않는다(전역 치환을 없애도 초록불이었다). 콘텐츠가 8000개로 늘면 반드시 생기는 경우라
// 합성 데이터로 규칙 자체를 잠근다.
test("같은 단어가 두 번 나오는 예문은 두 자리 모두 빈칸이 된다", () => {
  const word = { id: "v999-01", word: "test", pos: "n.", ko: ["시험"], roots: [], hint: "",
                 ex: { en: "A test is only a test.", ko: "시험은 시험일 뿐이다." } };
  const cloze = makeCloze(word);
  assert.ok(!cloze.sentence.includes("test"), `답이 남아 있다 — ${cloze.sentence}`);
  assert.equal(cloze.sentence.match(new RegExp(CLOZE_BLANK, "g")).length, 2);
});

test("빈칸 채점은 굴절형·대소문자·구두점을 받아준다", async () => {
  const words = await loadDay(DAYS[0].id);
  const apply = words.find((w) => w.word === "apply");     // 예문은 applies
  const cloze = makeCloze(apply);
  assert.equal(cloze.answer, "applies");
  assert.ok(checkCloze(cloze, "applies", apply));
  assert.ok(checkCloze(cloze, " Apply. ", apply), "표제어 형태도 받아줘야 한다");
  assert.ok(!checkCloze(cloze, "", apply));
  assert.ok(!checkCloze(cloze, "appeal", apply));
});

// ── 오늘 큐(D-99) ───────────────────────────────────────────────────────────
test("오늘 큐는 복습 사이에 새 단어를 끼운다", async () => {
  const words = await loadDay(DAYS[0].id);
  const due = words.slice(0, 6);
  const fresh = words.slice(10, 12);
  const queue = buildDailyQueue(due, fresh, makeRng(5));
  assert.equal(queue.length, 8);
  assert.equal(queue.filter((i) => i.kind === "new").length, 2);
  // 새 단어가 전부 뒤에 몰려 있으면 안 된다(복습만 연속으로 나오는 구간을 만들지 않는다)
  assert.ok(queue.slice(0, 4).some((i) => i.kind === "new"), JSON.stringify(queue.map((i) => i.kind)));
  assert.deepEqual(buildDailyQueue([], [], makeRng(1)), []);
});

test("인출 강도는 익숙해질수록 올라간다(고르기 → 빈칸)", () => {
  assert.equal(retrievalMode(undefined), "choice");
  assert.equal(retrievalMode({ reps: 1 }), "choice");
  assert.equal(retrievalMode({ reps: 2 }), "cloze");
});

// ── 계정별 저장(D-100) ──────────────────────────────────────────────────────
// 병합이 조용히 틀리면 화면엔 아무 표시가 없고 공부한 일정만 사라진다 — js/learning/cloud.js의
// mergeProgress를 테스트로 묶어둔 것과 같은 이유로 여기만이라도 잠근다.
test("기기 간 병합은 마지막 응답이 이긴다", () => {
  const local = {
    "v001-01": { due: 100, ivl: 1, ease: 2.5, reps: 1, lapses: 0, at: 100 },
    "v001-02": { due: 900, ivl: 3, ease: 2.5, reps: 2, lapses: 0, at: 900 },
  };
  const remote = {
    "v001-01": { due: 500, ivl: 3, ease: 2.5, reps: 2, lapses: 0, at: 500 },  // 서버가 더 최신
    "v001-03": { due: 700, ivl: 1, ease: 2.5, reps: 1, lapses: 0, at: 700 },  // 이 기기엔 없음
  };
  const merged = mergeVocabCards(local, remote);
  assert.equal(merged["v001-01"].at, 500, "더 최신 응답(서버)이 이겨야 한다");
  assert.equal(merged["v001-02"].at, 900, "서버에 없는 로컬 진행이 사라지면 안 된다");
  assert.ok(merged["v001-03"], "서버에만 있는 단어가 들어와야 한다");
  // 멱등: 같은 병합을 두 번 해도 결과가 같아야 한다(재로그인·다른 탭)
  assert.deepEqual(mergeVocabCards(merged, remote), merged);
});

test("병합 시각이 같으면 더 많이 진행된 쪽을 남긴다", () => {
  const local = { "v001-01": { due: 1, ivl: 1, ease: 2.5, reps: 1, lapses: 0, at: 100 } };
  const remote = { "v001-01": { due: 2, ivl: 8, ease: 2.5, reps: 4, lapses: 0, at: 100 } };
  assert.equal(mergeVocabCards(local, remote)["v001-01"].reps, 4);
  // at이 아예 없는 옛 레코드도 터지지 않는다
  assert.ok(mergeVocabCards({ "v001-01": { reps: 0 } }, { "v001-01": { reps: 1 } })["v001-01"]);
  assert.deepEqual(mergeVocabCards(undefined, undefined), {});
});

test("행 ↔ 엔트리 변환이 왕복해도 값이 유지된다", () => {
  const entry = { due: Date.UTC(2026, 7, 20), ivl: 8, ease: 2.35, reps: 3, lapses: 1,
                  at: Date.UTC(2026, 7, 12), first: Date.UTC(2026, 7, 1) };
  const row = entryToRow("user-1", "v002-13", entry);
  assert.equal(row.user_id, "user-1");
  assert.equal(row.word_id, "v002-13");
  assert.equal(row.first_seen, new Date(Date.UTC(2026, 7, 1)).toISOString());
  assert.deepEqual(rowToEntry(row), entry);
});

test("하루 신규 상한은 '오늘 처음 만난 단어'로 센다", () => {
  const now = new Date(2026, 7, 19, 14, 0, 0).getTime();      // 로컬 오후 2시
  const todayMorning = new Date(2026, 7, 19, 7, 0, 0).getTime();
  const yesterday = new Date(2026, 7, 18, 23, 0, 0).getTime();
  const cards = {
    "v001-01": { ...newEntry(todayMorning), first: todayMorning },
    "v001-02": { ...newEntry(todayMorning), first: todayMorning },
    "v001-03": { ...newEntry(yesterday), first: yesterday },     // 어제 시작 → 안 센다
  };
  assert.equal(countNewToday(cards, now), 2);
  // 어제 시작한 단어를 오늘 여러 번 복습해도 "오늘의 새 단어"는 늘지 않는다
  cards["v001-03"] = schedule(cards["v001-03"], "good", now);
  assert.equal(countNewToday(cards, now), 2);
  assert.equal(countNewToday({}, now), 0);
});

test("first(첫 학습 시각)는 응답이 쌓여도 그대로 유지된다", () => {
  const first = 1000;
  let e = newEntry(first);
  for (const g of ["good", "again", "good", "hard"]) e = schedule(e, g, first + 999999);
  assert.equal(e.first, first);
});

test("응답 시각(at)이 일정에 기록된다 — 병합의 기준값", () => {
  const now = 1234567890;
  assert.equal(newEntry(now).at, now);
  assert.equal(schedule(newEntry(0), "good", now).at, now);
  assert.equal(schedule(newEntry(0), "again", now).at, now);
});

// 개인정보처리방침은 **실제로 저장하는 것만** 적는다는 게 이 저장소의 규칙인데, 반대로
// 저장을 늘려놓고 방침을 안 고치는 실수는 화면에 아무 표시가 안 난다. 서버 저장이 붙은
// 이번 변경(D-100)에서 그 짝을 테스트로 묶는다.
test("서버에 저장하는 항목이 개인정보처리방침에 적혀 있다", () => {
  const home = fs.readFileSync(path.join(ROOT_DIR, "js", "screens", "home.js"), "utf8");
  const cloud = fs.readFileSync(path.join(ROOT_DIR, "js", "learning", "civil-vocab", "cloud.js"), "utf8");
  const table = /from\("([a-z_]+)"\)/.exec(cloud);
  assert.ok(table, "cloud.js가 어느 테이블을 쓰는지 못 찾았다");
  assert.ok(
    /영단어 학습 일정/.test(home),
    `${table[1]}에 저장하는데 개인정보처리방침(renderPrivacy)에 해당 항목이 없다`
  );
});

// ── 하루 목표 설정(D-102) ───────────────────────────────────────────────────
test("하루 목표는 최소 20 아래로 내려가지 않는다", () => {
  assert.equal(MIN_NEW_PER_DAY, 20, "사용자가 정한 최소값이다 — 바꾸려면 먼저 합의할 것");
  assert.equal(normalizeNewPerDay(1), MIN_NEW_PER_DAY);
  assert.equal(normalizeNewPerDay(19), MIN_NEW_PER_DAY);
  assert.equal(normalizeNewPerDay(0), MIN_NEW_PER_DAY);
  assert.equal(normalizeNewPerDay(-5), MIN_NEW_PER_DAY);
});

test("하루 목표는 상한과 형식도 지킨다", () => {
  assert.equal(normalizeNewPerDay(9999), MAX_NEW_PER_DAY);
  assert.equal(normalizeNewPerDay("30"), 30);
  assert.equal(normalizeNewPerDay(37.4), 37);
  assert.equal(normalizeNewPerDay("이상한값"), DEFAULT_NEW_PER_DAY);
  assert.equal(normalizeNewPerDay(undefined), DEFAULT_NEW_PER_DAY);
  assert.equal(normalizeNewPerDay(null), DEFAULT_NEW_PER_DAY);   // Number(null)은 0이라 하한으로 눌린다
});

test("화면에 내놓는 선택지가 전부 허용 범위 안이다", () => {
  assert.ok(NEW_PER_DAY_OPTIONS.includes(DEFAULT_NEW_PER_DAY));
  for (const n of NEW_PER_DAY_OPTIONS) {
    assert.equal(normalizeNewPerDay(n), n, `${n}은 허용 범위 밖이라 눌린다`);
  }
  assert.deepEqual([...NEW_PER_DAY_OPTIONS].sort((a, b) => a - b), NEW_PER_DAY_OPTIONS);
});


// ── 로그아웃 시 로컬 일정 초기화(D-104) ──────────────────────────────────────
// js/learning/cloud.js와 같은 문제, 같은 수정 — 로그아웃 후 로컬(state.vocab)에 남은 게
// 방금 나간 계정의 단어 일정이라, 지우지 않으면 다음 계정으로 로그인할 때 섞여 버린다.
function fakeVocabCloud({ progressByUser = {}, settingsByUser = {} } = {}) {
  let currentUser = null;
  const listeners = new Set();
  return {
    getCachedUser: () => currentUser,
    onAuthChange(cb) {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    _login(id) {
      currentUser = { id };
      for (const cb of listeners) cb();
    },
    _logout() {
      currentUser = null;
      for (const cb of listeners) cb();
    },
    supabase: {
      from(table) {
        if (table === "vocab_progress") {
          const query = {
            select: () => query,
            eq: () => query,
            order: () => query,
            range: () => Promise.resolve({ data: progressByUser[currentUser.id] || [], error: null }),
            upsert: () => Promise.resolve({ error: null }),
          };
          return query;
        }
        if (table === "vocab_settings") {
          const query = {
            select: () => query,
            eq: () => query,
            maybeSingle: () => Promise.resolve({ data: settingsByUser[currentUser.id] || null, error: null }),
            upsert: () => Promise.resolve({ error: null }),
          };
          return query;
        }
        throw new Error(`가짜 cloud가 모르는 테이블: ${table}`);
      },
    },
  };
}

const flushTicks = () => new Promise((r) => setTimeout(r, 0));

test("어휘 로그아웃 시 로컬 일정·목표가 지워져 다음 계정에 안 섞인다", async () => {
  const remoteB = [
    { word_id: "v001-01", due: new Date(2026, 0, 1).toISOString(), ivl: 1, ease: 2.5,
      reps: 1, lapses: 0, updated_at: new Date(2026, 0, 1).toISOString(), first_seen: new Date(2026, 0, 1).toISOString() },
  ];
  const cloud = fakeVocabCloud({ progressByUser: { userB: remoteB } });
  const sync = makeVocabSyncHandler(cloud);
  sync();
  cloud.onAuthChange(sync);
  assert.deepEqual(state.vocab.cards, {}, "로그인 전인데 뭔가 채워졌다");

  cloud._login("userA");
  await flushTicks();
  // A 계정으로 이 기기에서 많이 공부했다고 하자(서버보다 훨씬 앞선 진행)
  state.vocab.cards["v001-01"] = { due: Date.now(), ivl: 50, ease: 2.5, reps: 6, lapses: 0, at: Date.now(), first: Date.now() };
  state.vocab.days["day-001"] = { index: 40, best: 90, wrong: {} };
  state.vocab.newPerDay = 100;

  cloud._logout();
  await flushTicks();
  assert.deepEqual(state.vocab.cards, {}, "로그아웃했는데 A의 단어 일정이 그대로 남아 있다(D-104)");
  assert.deepEqual(state.vocab.days, {}, "로그아웃했는데 A의 DAY 진행이 그대로 남아 있다(D-104)");
  assert.equal(state.vocab.newPerDay, DEFAULT_NEW_PER_DAY, "로그아웃했는데 A가 고른 하루 목표가 남아 있다(D-104)");

  cloud._login("userB");
  await flushTicks();
  assert.equal(
    state.vocab.cards["v001-01"].reps, 1,
    "B의 서버 값(reps=1)이 아니라 A의 로컬 값이 섞여 들어왔다 — 계정 간 데이터 누출(D-104)"
  );

  state.vocab.cards = {};
  state.vocab.days = {};
  state.vocab.newPerDay = DEFAULT_NEW_PER_DAY;
});

test("어휘 도구: 로그인한 적 없는 세션은 로그아웃 처리에서 아무것도 안 지운다", async () => {
  const cloud = fakeVocabCloud({});
  const sync = makeVocabSyncHandler(cloud);
  cloud.onAuthChange(sync);
  state.vocab.cards["v001-02"] = { due: Date.now(), ivl: 1, ease: 2.5, reps: 1, lapses: 0, at: Date.now(), first: Date.now() };
  sync();
  await flushTicks();
  assert.ok(state.vocab.cards["v001-02"], "로그인 전에 공부한 게 지워지면 '나중에 로그인해서 이어 올리기'가 깨진다");
  state.vocab.cards = {};
});
