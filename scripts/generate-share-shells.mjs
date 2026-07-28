#!/usr/bin/env node
// share/ 아래 결과 공유 정적 셸 + _redirects를 data.js에서 다시 생성한다.
// 빌드 파이프라인이 아니라 scripts/verify.cjs 같은 개발자 도구다 — 실행 결과를
// 커밋해야 배포에 반영된다(이 사이트에 빌드 단계는 없다).
//
// 결과 유형을 추가/변경/삭제했으면 이 스크립트를 다시 실행하고 출력을 커밋할 것.
// 잊으면 test/share-shells.test.js가 빨간불을 낸다 — 그 검사가 실행하는 것도 같은
// 로직(scripts/lib/share-shell.mjs)이라 "재생성을 깜빡함"과 "로직 자체가 잘못됨"이
// 구분된다.
import { writeFileSync, mkdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { RESULT_TYPES, PROFILE_TO_SLUG } from "../js/tests/adhd/data.js";
import { DISC_TYPES } from "../js/tests/disc/data.js";
import { buildShareShell, buildRedirects, adhdEntry, discEntry } from "./lib/share-shell.mjs";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const indexHtml = readFileSync(path.join(root, "index.html"), "utf8");

const entries = [
  ...Object.entries(PROFILE_TO_SLUG).map(([key, slug]) => adhdEntry(RESULT_TYPES[key], slug)),
  ...Object.values(DISC_TYPES).map((type) => discEntry(type)),
];

for (const entry of entries) {
  const html = buildShareShell(indexHtml, entry);
  const outPath = path.join(root, "share", entry.testId, `${entry.slug}.html`);
  mkdirSync(path.dirname(outPath), { recursive: true });
  writeFileSync(outPath, html);
}

writeFileSync(path.join(root, "_redirects"), buildRedirects(entries));

const adhdCount = Object.keys(PROFILE_TO_SLUG).length;
const discCount = Object.keys(DISC_TYPES).length;
console.log(`공유 셸 ${entries.length}개 생성 완료 (adhd ${adhdCount}개 · disc ${discCount}개) + _redirects 갱신`);
