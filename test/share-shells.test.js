// share/ 아래 정적 셸과 _redirects는 손으로 쓴 게 아니라 scripts/generate-share-shells.mjs가
// data.js에서 만들어낸 산출물이다. 유형을 추가/변경/삭제하고 이 스크립트를 다시 안 돌리면
// 커밋된 셸이 조용히 낡는다 — 카카오톡 미리보기가 옛 유형 이름을 계속 보여주는 식으로.
// 여기서는 지금 data.js로 다시 만들면 나올 내용과 커밋된 파일이 바이트 단위로 같은지
// 검사한다. 로직을 다시 베끼지 않고 생성 스크립트와 같은 함수(scripts/lib/share-shell.mjs)를
// 그대로 불러 쓴다 — 검사가 로직을 다시 베끼면 그 사본도 똑같이 낡을 수 있다.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { RESULT_TYPES, PROFILE_TO_SLUG } from "../js/tests/adhd/data.js";
import { DISC_TYPES } from "../js/tests/disc/data.js";
import { buildShareShell, buildRedirects, adhdEntry, discEntry } from "../scripts/lib/share-shell.mjs";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const indexHtml = readFileSync(path.join(root, "index.html"), "utf8");

const entries = [
  ...Object.entries(PROFILE_TO_SLUG).map(([key, slug]) => adhdEntry(RESULT_TYPES[key], slug)),
  ...Object.values(DISC_TYPES).map((type) => discEntry(type)),
];

test("공유 셸: ADHD 8종 + DISC 12종 = 20개가 전부 있다", () => {
  assert.equal(entries.length, 20, `유형이 늘거나 줄었으면 이 숫자도 같이 바뀌어야 정상이다 (실제: ${entries.length})`);
});

test("공유 셸: 커밋된 파일이 지금 data.js로 다시 만든 내용과 바이트 단위로 같다", () => {
  for (const entry of entries) {
    const filePath = path.join(root, "share", entry.testId, `${entry.slug}.html`);
    assert.ok(
      existsSync(filePath),
      `share/${entry.testId}/${entry.slug}.html이 없다 — node scripts/generate-share-shells.mjs를 실행하고 커밋할 것`
    );
    const committed = readFileSync(filePath, "utf8");
    const fresh = buildShareShell(indexHtml, entry);
    assert.equal(
      committed,
      fresh,
      `share/${entry.testId}/${entry.slug}.html이 낡았다 — node scripts/generate-share-shells.mjs를 다시 실행하고 커밋할 것`
    );
  }
});

test("공유 셸: _redirects가 커밋된 내용과 바이트 단위로 같다", () => {
  const committed = readFileSync(path.join(root, "_redirects"), "utf8");
  const fresh = buildRedirects(entries);
  assert.equal(committed, fresh, "_redirects가 낡았다 — node scripts/generate-share-shells.mjs를 다시 실행하고 커밋할 것");
});

test("공유 셸: 모든 슬러그의 og:url이 실제 공유 주소(js/core/share.js가 만드는 것)와 일치한다", () => {
  // wireShare()가 실제로 만드는 URL 패턴: `${origin}/test/<testId>/result/<slug>`.
  // 이 패턴이 바뀌면 셸의 og:url이 실제 공유 링크와 어긋난다.
  for (const entry of entries) {
    assert.match(entry.url, new RegExp(`^https://fun\\.data-pantry\\.com/test/${entry.testId}/result/${entry.slug}$`));
  }
});
