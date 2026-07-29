// 화면 문구에 개수를 숫자로 박아두면, 데이터를 늘려도 문구가 따라오지 않는다.
// 에러가 나지 않고 잘못된 숫자를 그대로 보여주기 때문에 아무도 눈치채지 못한다.
//
// 실제로 세 번 났다:
//  1) ADHD 목록 카드가 "12문항"을 리터럴로 들고 있었다 (인트로는 QUESTIONS.length를 썼다)
//  2) Go/No-Go 주석이 "10라운드"라고 적혀 있었다 (CPT_ROUNDS는 14)
//  3) DISC 인트로 본문이 "상황 12개"를 리터럴로 들고 있었다 (같은 화면의 칩은 TETRADS.length를 썼다)
//
// 세 번째에서 문서 규칙(docs/ERRORS.md E-1)을 테스트로 승격시켰다.
// 규칙을 "지켜달라"가 아니라 "어기면 빨간불"로 바꾼 것이다.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const JS_DIR = path.join(import.meta.dirname, "..", "js");

// 데이터에서 파생돼야 하는 세는 단위. 이 단위 앞에 리터럴 숫자가 오면 실패한다.
// "개"가 필요한 이유: 실제로 놓친 형태가 "상황 12개"였다 — 단위가 숫자 뒤에 오는 조사형이라
// "문항/가지/라운드"만 보던 초판 정규식이 그대로 통과시켰다.
// 시간 단위(분·초)는 데이터에서 파생되지 않는 어림값이라 일부러 뺀다("약 1분").
// "칸"·"스테이지"는 NumPath에서 새로 등장한 단위(그리드 칸 수·런당 스테이지 수).
const UNITS = ["문항", "가지", "라운드", "상황", "개", "종", "번", "칸", "스테이지"];

// HTML 텍스트 노드 안(`>` 다음, 다음 태그나 `${` 전)의 숫자만 본다.
// 주석이나 설계 메모의 "축당 4문항" 같은 서술은 걸리지 않는다.
const RENDERED_COUNT = new RegExp(`>[^<{]*?(\\d+)\\s*(${UNITS.join("|")})`, "g");

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? walk(p) : p.endsWith(".js") ? [p] : [];
  });
}

test("화면 문구의 개수는 리터럴이 아니라 데이터에서 나온다", () => {
  const offenders = [];
  for (const file of walk(JS_DIR)) {
    const source = fs.readFileSync(file, "utf8");
    source.split("\n").forEach((line, i) => {
      for (const m of line.matchAll(RENDERED_COUNT)) {
        offenders.push(`${path.relative(JS_DIR, file)}:${i + 1}  "${m[1]}${m[2]}"  → ${line.trim()}`);
      }
    });
  }

  assert.deepEqual(
    offenders,
    [],
    "화면 문구에 개수가 하드코딩됐다. 데이터 길이(QUESTIONS.length, TETRADS.length, CPT_ROUNDS 등)를\n" +
      "참조하도록 고칠 것 — docs/ERRORS.md E-1:\n  " + offenders.join("\n  ")
  );
});

test("등록된 테스트의 목록 카드 문구도 같은 규칙을 따른다", async () => {
  // 카드 desc는 템플릿 문자열이라 위 정적 검사에 안 걸린다. 실제 값으로 확인한다.
  const { adhdTest } = await import("../js/tests/adhd/index.js");
  const { discTest } = await import("../js/tests/disc/index.js");
  const { coupleTest } = await import("../js/tests/couple/index.js");
  const { QUESTIONS } = await import("../js/tests/adhd/data.js");
  const { TETRADS } = await import("../js/tests/disc/data.js");
  const { ITEM_TOTAL } = await import("../js/tests/couple/data.js");

  assert.match(
    adhdTest.card.desc,
    new RegExp(`${QUESTIONS.length}문항`),
    "ADHD 카드 문구의 문항 수가 QUESTIONS 길이와 다르다"
  );
  assert.match(
    discTest.card.desc,
    new RegExp(`${TETRADS.length}`),
    "DISC 카드 문구의 상황 수가 TETRADS 길이와 다르다"
  );
  assert.match(
    coupleTest.card.desc,
    new RegExp(`${ITEM_TOTAL}문항`),
    "부부 체크 카드 문구의 문항 수가 ITEM_TOTAL과 다르다"
  );
});
