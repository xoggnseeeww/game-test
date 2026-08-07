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

// ── B-4/B-5(D-94): 문법 항목의 아이용 표현 + 형태 자동 확인 ────────────────────

test("모든 문법 항목에 학습자용 표현(kidLabel)이 있다", () => {
  for (const grade of GRADES) {
    for (const gp of grade.grammarPoints) {
      assert.ok(
        typeof gp.kidLabel === "string" && gp.kidLabel.length > 0,
        `${grade.id}/${gp.id}에 kidLabel이 없다 — 카드에 "조동사"·"관계대명사" 같은 용어가 그대로 뜬다`
      );
      // 학습자 화면에 문법 용어를 그대로 띄우지 않는 게 kidLabel의 존재 이유다.
      for (const jargon of ["조동사", "관계대명사", "수동태", "현재진행형", "과거진행형", "비교급", "최상급", "be동사"]) {
        assert.ok(!gp.kidLabel.includes(jargon), `${grade.id}/${gp.id}의 kidLabel에 문법 용어 "${jargon}"가 남아 있다`);
      }
    }
  }
});

test("check가 있는 문법 항목은 그 문법 문장에 실제로 걸린다 (정규식 오타 방지)", () => {
  for (const grade of GRADES) {
    for (const gp of grade.grammarPoints) {
      if (!gp.check) continue;
      assert.ok(gp.check instanceof RegExp, `${grade.id}/${gp.id}의 check는 정규식이어야 한다`);
      const tagged = grade.chapters
        .flatMap((c) => c.sentences)
        .filter((s) => s.grammar === gp.id && s.type !== "produce");
      const hits = tagged.filter((s) => gp.check.test(s.text));
      assert.ok(
        hits.length > 0,
        `${grade.id}/${gp.id}의 check가 그 문법으로 태그된 문장 ${tagged.length}개 중 하나도 못 잡는다 — 정규식이 틀렸다`
      );
    }
  }
});

test("check는 엉뚱한 문장을 잡지 않는다 (오탐으로 '안 썼다'고 하면 없느니만 못하다)", () => {
  const cases = [
    ["G18", "I want to eat more rice.", true],
    ["G18", "I like rice.", false],
    ["G17", "I used to be shy in groups.", true],
    ["G17", "I use my phone every day.", false],
    ["G14", "If I study hard, I will become a scientist.", true],
    ["G14", "I will become a scientist.", false],
    ["G19", "I always brush my teeth.", true],
    ["G19", "I brush my teeth.", false],
    ["G16", "I was watching the race.", true],
    ["G16", "I watched the race.", false],
  ];
  const all = GRADES.flatMap((g) => g.grammarPoints);
  for (const [id, sentence, expected] of cases) {
    const gp = all.find((g) => g.id === id);
    assert.ok(gp && gp.check, `${id}에 check가 있어야 한다`);
    assert.equal(gp.check.test(sentence), expected, `${id} check가 "${sentence}"를 ${expected ? "잡아야" : "안 잡아야"} 한다`);
  }
});

test("모든 문법 항목에 설명(explain)이 있다 — 이름만으로는 어떻게 쓰였는지 알 수 없다(D-96)", () => {
  for (const grade of GRADES) {
    for (const gp of grade.grammarPoints) {
      assert.ok(
        typeof gp.explain === "string" && gp.explain.length > 10,
        `${grade.id}/${gp.id}에 explain이 없다 — 카드에 문법 이름만 뜨고 설명이 안 나온다`
      );
    }
  }
});
