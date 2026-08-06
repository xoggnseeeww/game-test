import test from "node:test";
import assert from "node:assert/strict";

import { GRADES } from "../js/learning/elementary-conversation/data.js";

test("학년 id가 중복되지 않고, 학년마다 챕터가 최소 1개 이상이다", () => {
  assert.ok(GRADES.length > 0);
  assert.equal(new Set(GRADES.map((g) => g.id)).size, GRADES.length);
  for (const grade of GRADES) {
    assert.ok(grade.chapters.length > 0, `학년 "${grade.id}"에 챕터가 없다`);
  }
});

test("학년 안에서 챕터 id, 챕터 안에서 문장 id가 중복되지 않는다", () => {
  for (const grade of GRADES) {
    const chapterIds = grade.chapters.map((c) => c.id);
    assert.equal(new Set(chapterIds).size, chapterIds.length, `학년 "${grade.id}"의 챕터 id가 중복된다`);
    for (const ch of grade.chapters) {
      assert.ok(ch.sentences.length > 0, `챕터 "${ch.id}"에 문장이 없다`);
      const sentenceIds = ch.sentences.map((s) => s.id);
      assert.equal(
        new Set(sentenceIds).size,
        sentenceIds.length,
        `챕터 "${ch.id}"의 문장 id가 중복된다`
      );
    }
  }
});

// D-78: 모든 문장은 grammarPoints에 실재하는 문법 포인트를 가리켜야 한다(오타·삭제된
// 포인트 방지) — 반대로 등록만 해두고 아무 문장도 안 쓰는 문법 포인트가 있으면 죽은
// 항목이라 같이 잡는다.
test("모든 문장의 grammar 태그가 그 학년의 grammarPoints에 실재하고, 쓰이지 않는 문법 포인트가 없다", () => {
  for (const grade of GRADES) {
    const validIds = new Set(grade.grammarPoints.map((g) => g.id));
    const usedIds = new Set();
    for (const ch of grade.chapters) {
      for (const s of ch.sentences) {
        assert.ok(s.grammar, `문장 "${s.id}"에 grammar 태그가 없다`);
        assert.ok(
          validIds.has(s.grammar),
          `문장 "${s.id}"의 grammar "${s.grammar}"가 학년 "${grade.id}"의 grammarPoints에 없다`
        );
        usedIds.add(s.grammar);
      }
    }
    for (const g of grade.grammarPoints) {
      assert.ok(usedIds.has(g.id), `문법 포인트 "${g.id}"(${g.label})를 쓰는 문장이 없다`);
    }
  }
});

// D-78 핵심 규칙: 챕터를 상황으로만 나누면 문법이 한 번 등장했다 사라진다 — 두 번째
// 챕터부터는 그 챕터에서 처음 쓰는 문법 말고, 이전 챕터에서 이미 나온 문법도 최소
// 하나는 다시 섞어 써야 한다(반복 없이 새 챕터가 새 문법만 도입하고 끝나는 걸 막는다).
test("두 번째 챕터부터는 이전 챕터에서 이미 나온 grammar를 최소 1문장 이상 재사용한다", () => {
  for (const grade of GRADES) {
    const seenBefore = new Set();
    grade.chapters.forEach((ch, i) => {
      const grammarInThisChapter = new Set(ch.sentences.map((s) => s.grammar));
      if (i > 0) {
        const recycled = [...grammarInThisChapter].some((g) => seenBefore.has(g));
        assert.ok(
          recycled,
          `학년 "${grade.id}"의 챕터 "${ch.id}"가 이전 챕터의 grammar를 하나도 재사용하지 않는다`
        );
      }
      grammarInThisChapter.forEach((g) => seenBefore.add(g));
    });
  }
});

// D-78: type이 "produce"인 문장은 정답 하나로 채점하지 않는 대신, 스스로 비교할 예시
// 답안이 최소 1개 있어야 한다 — 없으면 화면에서 빈 목록만 뜬다.
test('type이 "produce"인 문장은 sample 예시 답안이 최소 1개 있다', () => {
  for (const grade of GRADES) {
    for (const ch of grade.chapters) {
      for (const s of ch.sentences) {
        if (s.type !== "produce") continue;
        assert.ok(
          Array.isArray(s.sample) && s.sample.length > 0,
          `produce 문장 "${s.id}"에 sample이 없다`
        );
      }
    }
  }
});

// D-78 후속: 아무 참고 없이 백지에서 답하면 얼어붙는 아이가 있을 수 있어, 시도 전에
// 보여주는 문장 시작 조각(hint)이 필요하다 — 없으면 produce 카드가 사실상 순수 반복
// 카드보다 어려운데 도움은 하나도 없는 화면이 된다.
test('type이 "produce"인 문장은 시도 전에 보여줄 hint가 있다', () => {
  for (const grade of GRADES) {
    for (const ch of grade.chapters) {
      for (const s of ch.sentences) {
        if (s.type !== "produce") continue;
        assert.ok(
          typeof s.hint === "string" && s.hint.length > 0,
          `produce 문장 "${s.id}"에 hint가 없다`
        );
      }
    }
  }
});
