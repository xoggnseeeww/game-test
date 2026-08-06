// 학습 진행률 병합 규칙 — `js/learning/cloud.js`의 mergeProgress만 순수 함수라 여기서 검증한다.
// 나머지(saveLearningProgress/initLearningSync)는 Supabase 클라이언트에 묶여 브라우저에서만 돈다.
import test from "node:test";
import assert from "node:assert/strict";
import { mergeProgress } from "../js/learning/cloud.js";

test("진도(index)는 더 나간 쪽을 남긴다", () => {
  const merged = mergeProgress({ a: { index: 2, weak: {} } }, { a: { index: 5, weak: {} } });
  assert.equal(merged.a.index, 5);
  const merged2 = mergeProgress({ a: { index: 7, weak: {} } }, { a: { index: 3, weak: {} } });
  assert.equal(merged2.a.index, 7);
});

test("weak은 진도와 무관하게 합집합으로 남는다 (A-5: 복습 목록 유실 방지)", () => {
  // 원격이 진도가 앞서지만, 로컬에만 있던 weak 표시가 사라지면 안 된다.
  const merged = mergeProgress(
    { a: { index: 2, weak: { s1: true } } },
    { a: { index: 9, weak: { s2: true } } }
  );
  assert.equal(merged.a.index, 9);
  assert.deepEqual(merged.a.weak, { s1: true, s2: true });

  // 반대 방향(로컬이 앞설 때)도 같다.
  const merged2 = mergeProgress(
    { a: { index: 9, weak: { s1: true } } },
    { a: { index: 2, weak: { s2: true } } }
  );
  assert.equal(merged2.a.index, 9);
  assert.deepEqual(merged2.a.weak, { s1: true, s2: true });
});

test("weak 필드가 없는 옛 레코드도 항상 객체로 채워진다 (A-5: markWeak 크래시 방지)", () => {
  const merged = mergeProgress({ a: { index: 1 } }, { a: { index: 4 } });
  assert.deepEqual(merged.a.weak, {}, "weak이 undefined면 화면에서 st.weak[id] 대입이 터진다");
});

test("원격에만 있는 챕터는 그대로 들어오고, 로컬 전용 챕터는 보존된다", () => {
  const merged = mergeProgress({ mine: { index: 3, weak: {} } }, { theirs: { index: 1, weak: {} } });
  assert.equal(merged.mine.index, 3);
  assert.equal(merged.theirs.index, 1);
});

test("remote가 비어 있어도(null/undefined) 로컬을 그대로 돌려준다", () => {
  const local = { a: { index: 3, weak: { s1: true } } };
  assert.deepEqual(mergeProgress(local, null), local);
  assert.deepEqual(mergeProgress(local, undefined), local);
});
