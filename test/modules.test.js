// 모듈을 쪼개면서 실제로 두 번 겪은 사고를 잡기 위한 검사:
//  1) 다른 파일의 함수를 쓰면서 import를 빠뜨림 (renderReactionResult의 gameBonuses)
//  2) 쓰이는 쪽은 멀쩡한데 정의하는 쪽에 export를 빠뜨림 (renderTestShared)
// 둘 다 브라우저에서 특정 화면까지 가야만 터져서 단위 테스트로는 안 잡혔다.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.join(import.meta.dirname, "..");
const JS_DIR = path.join(ROOT, "js");

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? walk(p) : p.endsWith(".js") ? [p] : [];
  });
}

const files = walk(JS_DIR);

function exportsOf(source) {
  const names = new Set();
  for (const m of source.matchAll(/^export\s+(?:async\s+)?function\s+(\w+)/gm)) names.add(m[1]);
  for (const m of source.matchAll(/^export\s+(?:const|let|var)\s+(\w+)/gm)) names.add(m[1]);
  return names;
}

function importsOf(source) {
  const out = [];
  for (const m of source.matchAll(/import\s*\{([^}]*)\}\s*from\s*["']([^"']+)["']/g)) {
    const names = m[1]
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean)
      .map((x) => x.split(/\s+as\s+/)[0].trim());
    out.push({ names, from: m[2] });
  }
  return out;
}

test("모든 import가 실제로 존재하는 export를 가리킨다", () => {
  for (const file of files) {
    const src = fs.readFileSync(file, "utf8");
    for (const { names, from } of importsOf(src)) {
      if (!from.startsWith(".")) continue;
      const target = path.resolve(path.dirname(file), from);
      assert.ok(fs.existsSync(target), `${path.relative(ROOT, file)} → 없는 파일: ${from}`);
      const available = exportsOf(fs.readFileSync(target, "utf8"));
      for (const name of names) {
        assert.ok(
          available.has(name),
          `${path.relative(ROOT, file)}이 ${from}에서 ${name}을(를) 가져오는데 그쪽에 export가 없다`
        );
      }
    }
  }
});

test("다른 파일의 export를 import 없이 쓰는 곳이 없다", () => {
  // 프로젝트 전체에서 정의된 이름 → 정의한 파일
  const definedIn = new Map();
  for (const file of files) {
    for (const name of exportsOf(fs.readFileSync(file, "utf8"))) definedIn.set(name, file);
  }

  for (const file of files) {
    const src = fs.readFileSync(file, "utf8");
    // 주석과 문자열은 오탐의 원인이라 걷어내고 본다
    const code = src
      .replace(/\/\/[^\n]*/g, "")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/`(?:[^`\\]|\\.)*`/g, "``")
      .replace(/"(?:[^"\\]|\\.)*"/g, '""')
      .replace(/'(?:[^'\\]|\\.)*'/g, "''");

    const local = new Set();
    for (const m of code.matchAll(/(?:^|\s)(?:export\s+)?(?:async\s+)?function\s+(\w+)/g)) local.add(m[1]);
    for (const m of code.matchAll(/(?:^|\s)(?:export\s+)?(?:const|let|var)\s+(\w+)/g)) local.add(m[1]);
    const imported = new Set(importsOf(src).flatMap((i) => i.names));

    for (const [name, source] of definedIn) {
      if (source === file || local.has(name) || imported.has(name)) continue;
      const used = new RegExp(`(?:^|[^\\w.$])${name}\\s*\\(`, "m").test(code);
      assert.ok(
        !used,
        `${path.relative(ROOT, file)}이 ${name}을(를) 쓰는데 import하지 않았다 (정의: ${path.relative(ROOT, source)})`
      );
    }
  }
});

test("등록되는 화면 id와 경로가 겹치지 않는다", async () => {
  // 라우터는 브라우저 DOM이 필요해서 직접 못 부르고, 디스크립터만 읽어 검사한다.
  const { adhdScreens } = await import("../js/tests/adhd/index.js");
  const { discScreens } = await import("../js/tests/disc/index.js");
  const { coupleScreens } = await import("../js/tests/couple/index.js");
  const { numpathScreens } = await import("../js/games/numpath/index.js");
  const { basicConversationScreens } = await import("../js/learning/basic-conversation/index.js");
  const { elementaryConversationScreens } = await import("../js/learning/elementary-conversation/index.js");
  const { commonScreens } = await import("../js/screens/home.js");
  const all = [...commonScreens, ...adhdScreens, ...discScreens, ...coupleScreens, ...numpathScreens, ...basicConversationScreens, ...elementaryConversationScreens];

  const ids = all.map((s) => s.id);
  assert.equal(new Set(ids).size, ids.length, `화면 id가 겹친다: ${ids.join(", ")}`);

  const paths = all.map((s) => s.path).filter(Boolean);
  assert.equal(new Set(paths).size, paths.length, `경로가 겹친다: ${paths.join(", ")}`);

  // 공유 결과 화면은 주소가 슬러그마다 달라서 고정 경로를 가지면 안 된다
  for (const s of all) {
    if (s.dynamicPath) assert.equal(s.path, undefined, `${s.id}는 dynamicPath인데 고정 경로가 있다`);
    else assert.ok(s.path, `${s.id}에 경로가 없다`);
    assert.ok(s.title, `${s.id}에 제목이 없다`);
  }

  // 기존에 공유된 주소가 계속 살아있어야 한다
  assert.ok(paths.includes("/test/adhd"));
  assert.ok(paths.includes("/test/adhd/result"));
  assert.ok(adhdScreens.some((s) => s.id === "test-shared" && s.dynamicPath));
  assert.ok(paths.includes("/game/numpath"));
  assert.ok(paths.includes("/learning"));
  assert.ok(paths.includes("/learning/basic-conversation"));
  assert.ok(coupleScreens.some((s) => s.id === "couple-shared" && s.dynamicPath));

  // 배우자 초대 링크는 ?p=<코드>를 붙여 보낸다. 그 주소가 고정 경로로 등록돼 있어야
  // 새로고침·직접 접속에서 홈으로 튕기지 않는다.
  assert.ok(paths.includes("/test/couple/pair"));
});
