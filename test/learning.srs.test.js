// 간격 반복(SRS) 스케줄 — `js/learning/srs.js`는 DOM·state를 모르는 순수 함수라 여기서 검증한다.
// 이 로직이 조용히 깨지면 "복습이 영영 안 뜨거나 / 영영 안 졸업하는" 형태로 나타나는데
// 둘 다 화면엔 아무 표시가 안 나므로(며칠을 기다려봐야 안다) 테스트로 묶어둔다.
import test from "node:test";
import assert from "node:assert/strict";
import { INTERVALS_DAYS, markWrong, markCorrect, isDue, collectDue, countPending } from "../js/learning/srs.js";

const DAY = 24 * 60 * 60 * 1000;
const NOW = 1_700_000_000_000;

test("틀리면 항상 처음(오늘 다시)으로 되돌아간다", () => {
  assert.deepEqual(markWrong(undefined, NOW), { due: NOW, step: 0 });
  // 많이 올라가 있던 문장도 한 번 틀리면 처음으로
  assert.deepEqual(markWrong({ due: NOW + 7 * DAY, step: 3 }, NOW), { due: NOW, step: 0 });
});

test("맞히면 다음 칸으로 올라가고 간격이 길어진다", () => {
  const s0 = { due: NOW, step: 0 };
  const s1 = markCorrect(s0, NOW);
  assert.equal(s1.step, 1);
  assert.equal(s1.due, NOW + INTERVALS_DAYS[1] * DAY);

  const s2 = markCorrect(s1, NOW);
  assert.equal(s2.step, 2);
  assert.ok(s2.due > s1.due, "간격은 갈수록 길어져야 한다");
});

test("마지막 칸을 넘기면 null — 호출부가 목록에서 지운다(졸업)", () => {
  let entry = { due: NOW, step: 0 };
  for (let i = 1; i < INTERVALS_DAYS.length; i++) {
    entry = markCorrect(entry, NOW);
    assert.notEqual(entry, null, `${i}번째까지는 아직 졸업이 아니다`);
  }
  assert.equal(markCorrect(entry, NOW), null, "마지막 칸을 넘기면 졸업해야 한다");
});

test("옛 형식(weak: true)이나 값이 없어도 터지지 않는다", () => {
  // weak 값이 불리언이던 시절(D-78~D-91)에 저장된 레코드
  assert.deepEqual(markWrong(true, NOW), { due: NOW, step: 0 });
  const next = markCorrect(true, NOW);
  assert.equal(next.step, 1, "옛 값은 step 0으로 읽혀 한 칸 올라가야 한다");
  assert.equal(isDue(true, NOW), true, "옛 값은 지금 복습 대상으로 본다");

  // 값이 아예 없는 경우가 실제로 터지는 쪽이다 — 불리언은 JS가 프로퍼티 접근을 허용해서
  // 방어가 없어도 우연히 통과하지만, null/undefined는 그 자리에서 TypeError가 난다.
  assert.doesNotThrow(() => markCorrect(undefined, NOW));
  assert.doesNotThrow(() => markCorrect(null, NOW));
  assert.doesNotThrow(() => isDue(undefined, NOW));
  assert.equal(markCorrect(undefined, NOW).step, 1);

  // 깨진 값(문자열·NaN)도 기본값으로 읽는다
  assert.equal(markCorrect({ step: "3", due: NaN }, NOW).step, 1);
});

test("isDue는 예정 시각이 지났을 때만 참", () => {
  assert.equal(isDue({ due: NOW - 1, step: 1 }, NOW), true);
  assert.equal(isDue({ due: NOW, step: 1 }, NOW), true);
  assert.equal(isDue({ due: NOW + 1, step: 1 }, NOW), false);
});

test("collectDue는 때가 된 것만, 오래 밀린 것부터 모은다", () => {
  const learning = {
    "ch-a": { index: 3, weak: { s1: { due: NOW - 100, step: 0 }, s2: { due: NOW + DAY, step: 2 } } },
    "ch-b": { index: 1, weak: { s3: { due: NOW - 5000, step: 1 } } },
    "ch-c": { index: 9 },                       // weak 없는 챕터
    "ch-d": { index: 2, weak: {} },             // 비어 있는 weak
  };
  const due = collectDue(learning, NOW);
  assert.deepEqual(due.map((d) => d.id), ["s3", "s1"], "가장 오래 밀린 것이 먼저");
  assert.deepEqual(due.map((d) => d.key), ["ch-b", "ch-a"]);
  assert.equal(due.some((d) => d.id === "s2"), false, "아직 때가 안 된 건 빠져야 한다");
});

test("collectDue·countPending은 빈 state에서도 안전하다", () => {
  assert.deepEqual(collectDue({}, NOW), []);
  assert.deepEqual(collectDue(null, NOW), []);
  assert.equal(countPending(null), 0);
});

test("countPending은 때와 무관하게 복습 목록 전체를 센다", () => {
  const learning = {
    a: { weak: { s1: { due: NOW - 1, step: 0 }, s2: { due: NOW + DAY, step: 1 } } },
    b: { weak: { s3: { due: NOW + 9 * DAY, step: 3 } } },
  };
  assert.equal(countPending(learning), 3);
  assert.equal(collectDue(learning, NOW).length, 1, "그중 오늘 볼 차례는 1개");
});
