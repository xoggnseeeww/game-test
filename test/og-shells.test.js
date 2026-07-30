// OG 메타 태그는 정적 SPA라 런타임에 못 바꾼다(index.html이 전 주소 공통) — 그래서
// 테스트·게임 페이지별 og:title/description/image는 `_redirects`가 특정 경로만
// `og-shells/*.html`로 rewrite하는 정적 셸로 구현했다. 이 파일이 지키는 불변식:
//   1) `_redirects`의 각 셸 규칙이 실제로 등록된 화면 경로를 가리킨다 — 경로가
//      바뀌면(화면 id는 안 바뀌지만 path는 바뀔 수 있다) 셸이 조용히 죽은 경로가 된다.
//   2) 셸의 <title>·og:title·og:description이 카드 데이터(card.name/desc)와
//      일치한다 — 문항 수 등이 바뀌어 card.desc가 달라지면 셸은 그 순간엔 못
//      따라가지만, 최소한 "달라졌다"는 건 빨간불로 알 수 있어야 한다.
//   3) og:image가 실제 존재하는 파일을 가리킨다.
//   4) 와일드카드(`/*  /index.html  200`)가 항상 마지막 줄이다 — Cloudflare Pages는
//      `_redirects`를 위에서부터 첫 매치로 적용하므로, 순서가 어긋나면 특정 경로
//      규칙이 와일드카드에 가려 죽은 코드가 된다.
//   5) `_redirects`의 목적지는 확장자(`.html`) 없이 적는다 — Cloudflare Pages가
//      `.html` 파일을 확장자 없는 "정식 주소"로 취급해서, `.html`이 붙은 주소로
//      rewrite하면 그 정식 주소로 308을 한 번 더 보낸다. 그 308의 목적지
//      (`/og-shells/test-disc` 같은 내부 파일 경로)는 앱에 등록된 화면이 아니라서
//      라우터가 홈으로 떨어뜨린다 — 실제로 배포에서 겪은 버그다(2026-07-30,
//      `docs/decisions/2027-h1.md` D-32 갱신 4).
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { adhdTest } from "../js/tests/adhd/index.js";
import { discTest } from "../js/tests/disc/index.js";
import { numpathGame } from "../js/games/numpath/index.js";

const ROOT = path.join(import.meta.dirname, "..");

function parseRedirects() {
  const text = fs.readFileSync(path.join(ROOT, "_redirects"), "utf8");
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [source, dest, status] = line.split(/\s+/);
      return { source, dest, status };
    });
}

test("_redirects: 와일드카드(/*)는 항상 마지막 줄", () => {
  const rules = parseRedirects();
  assert.ok(rules.length > 0, "_redirects가 비어 있다");
  const wildcardIndex = rules.findIndex((r) => r.source === "/*");
  assert.notEqual(wildcardIndex, -1, "/* 폴백 규칙이 없다");
  assert.equal(wildcardIndex, rules.length - 1, "/*는 마지막 줄이어야 다른 규칙을 가리지 않는다");
});

// { 경로, 카드 소유자, og:image 파일명 } — card.screen이 가리키는 실제 diskPath 확인용
// `redirectDest`는 _redirects에 적히는 값(확장자 없음), `file`은 디스크의 실제 파일(.html).
const SHELLS = [
  {
    path: "/test/adhd",
    redirectDest: "/og-shells/test-adhd",
    file: "/og-shells/test-adhd.html",
    card: adhdTest.card,
    image: "og-adhd-v2.png",
  },
  {
    path: "/test/disc",
    redirectDest: "/og-shells/test-disc",
    file: "/og-shells/test-disc.html",
    card: discTest.card,
    image: "og-disc-v2.png",
  },
  {
    path: "/game/numpath",
    redirectDest: "/og-shells/game-numpath",
    file: "/og-shells/game-numpath.html",
    card: numpathGame.card,
    image: "og-numpath-v2.png",
  },
];

test("_redirects: OG 셸 규칙 3개가 전부 존재하고 대상 파일도 실재한다", () => {
  const rules = parseRedirects();
  for (const shell of SHELLS) {
    const rule = rules.find((r) => r.source === shell.path);
    assert.ok(rule, `${shell.path}에 대한 _redirects 규칙이 없다`);
    assert.equal(
      rule.dest,
      shell.redirectDest,
      `${shell.path} 규칙의 목적지가 예상과 다르다 — .html 확장자를 붙이면 Cloudflare가 확장자 없는 정식 주소로 308을 한 번 더 보낸다(D-32 갱신 4)`
    );
    assert.ok(!rule.dest.endsWith(".html"), `${shell.path} 규칙의 목적지에 .html 확장자가 붙어있으면 안 된다`);
    assert.equal(rule.status, "200", `${shell.path} 규칙은 rewrite(200)여야 한다 — 리다이렉트면 주소창이 바뀐다`);
    assert.ok(
      fs.existsSync(path.join(ROOT, shell.file)),
      `${shell.file} 파일이 실제로 없다`
    );
  }
});

test("OG 셸: title·og:title·og:description이 카드 데이터와 일치한다", () => {
  for (const shell of SHELLS) {
    const html = fs.readFileSync(path.join(ROOT, shell.file), "utf8");
    const expectedTitle = `${shell.card.name} | 과몰입구역`;

    const titleMatch = html.match(/<title>([^<]*)<\/title>/);
    assert.ok(titleMatch, `${shell.file}에 <title>이 없다`);
    assert.equal(titleMatch[1], expectedTitle, `${shell.file}의 <title>이 카드 이름과 다르다`);

    const ogTitleMatch = html.match(/og:title" content="([^"]*)"/);
    assert.ok(ogTitleMatch, `${shell.file}에 og:title이 없다`);
    assert.equal(ogTitleMatch[1], expectedTitle, `${shell.file}의 og:title이 카드 이름과 다르다`);

    const ogDescMatch = html.match(/og:description" content="([^"]*)"/);
    assert.ok(ogDescMatch, `${shell.file}에 og:description이 없다`);
    // card.desc는 " · "로 태그를 잇는 문구라 셸 문구엔 그 앞부분만 그대로 들어간다.
    const descPrefix = shell.card.desc.split(" · ")[0];
    assert.ok(
      ogDescMatch[1].includes(descPrefix),
      `${shell.file}의 og:description이 카드 설명("${descPrefix}")을 반영하지 못했다 — 문항 수 등이 바뀌었으면 셸도 같이 갱신할 것`
    );
  }
});

test("OG 셸: og:image가 실제 존재하는 파일을 가리킨다", () => {
  for (const shell of SHELLS) {
    const html = fs.readFileSync(path.join(ROOT, shell.file), "utf8");
    const imgMatch = html.match(/og:image" content="https:\/\/fun\.data-pantry\.com\/assets\/([^"]*)"/);
    assert.ok(imgMatch, `${shell.file}에 og:image가 없다`);
    assert.equal(imgMatch[1], shell.image, `${shell.file}의 og:image 파일명이 예상과 다르다`);
    assert.ok(
      fs.existsSync(path.join(ROOT, "assets", shell.image)),
      `assets/${shell.image} 파일이 실제로 없다`
    );
  }
});

test("OG 셸: og:url이 실제 경로와 정확히 일치한다(트레일링 슬래시 불일치 없음)", () => {
  for (const shell of SHELLS) {
    const html = fs.readFileSync(path.join(ROOT, shell.file), "utf8");
    const urlMatch = html.match(/og:url" content="([^"]*)"/);
    assert.ok(urlMatch, `${shell.file}에 og:url이 없다`);
    assert.equal(urlMatch[1], `https://fun.data-pantry.com${shell.path}`);
  }
});
