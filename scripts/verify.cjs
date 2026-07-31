/**
 * 브라우저 회귀 스위트 — 헤드리스로 실제 흐름을 재현한다.
 *
 * `npm test`는 채점 로직과 모듈 정합성만 본다. 라우팅·이벤트 바인딩·타이머·레이아웃은
 * 브라우저를 띄워야만 잡힌다(docs/ERRORS.md A-1). 이 스크립트가 그 몫이다.
 *
 * 실행:
 *   1) 터미널 A: python3 serve.py 8766
 *                (python3 -m http.server 는 안 된다 — SPA 폴백이 없다. docs/ERRORS.md E-9)
 *   2) 터미널 B: mkdir -p /tmp/pw && cd /tmp/pw && npm i playwright
 *                NODE_PATH=/tmp/pw/node_modules node <레포>/scripts/verify.cjs
 *      ※ node는 스크립트 위치 기준으로 모듈을 찾으므로 NODE_PATH가 필요하다.
 *      ※ 확장자가 `.cjs`인 이유: package.json이 "type": "module"이라 `.js`는 ESM으로 읽히고,
 *        ESM은 NODE_PATH를 무시해서 레포 밖에 설치한 playwright를 못 찾는다.
 *
 * playwright는 의도적으로 레포 의존성이 아니다(docs/DECISIONS.md D-9 — 런타임 의존성 0 유지).
 *
 * 새 화면·새 테스트를 추가하면 여기에 케이스를 추가한다.
 * 새 검사를 넣었으면 **버그를 일부러 되살려 빨간불이 뜨는지 확인할 것** — 초록불만 보면
 * 검사가 비어 있어도 모른다(docs/DECISIONS.md D-17).
 */
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const BASE = process.env.VERIFY_BASE || "http://localhost:8766";

// 샌드박스/CI에 미리 깔린 chromium을 찾는다. 없으면 playwright 기본 브라우저를 쓴다.
function findChromium() {
  if (process.env.CHROMIUM_PATH) return process.env.CHROMIUM_PATH;
  const root = process.env.PLAYWRIGHT_BROWSERS_PATH || "/opt/pw-browsers";
  try {
    const dir = fs.readdirSync(root).find((d) => /^chromium-\d+$/.test(d));
    if (dir) {
      const bin = path.join(root, dir, "chrome-linux", "chrome");
      if (fs.existsSync(bin)) return bin;
    }
  } catch {
    /* 없으면 기본값 사용 */
  }
  return undefined;
}

const fails = [];
const ok = [];
const check = (name, cond, detail = "") =>
  (cond ? ok : fails).push(`${name}${detail ? " — " + detail : ""}`);

// Go/No-Go 게임을 실수 없이 끝까지 플레이한다(모든 go에 반응, 모든 no-go는 무시) —
// 그래야 gameBonuses()가 0을 반환해서 이 파일의 축 퍼센트 회귀 확인값(75%)이 안 흔들린다.
// 라운드 수는 데이터 상수를 들고 오지 않고 진행률 표시("1/14")에서 읽는다 — 이 파일도
// docs/DECISIONS.md D-17(개수 하드코딩 금지)과 같은 원칙을 따른다.
async function playCptGame(page) {
  const totalText = await page.textContent(".progress-count .total");
  const total = parseInt(totalText.replace("/", ""), 10);
  if (!Number.isInteger(total) || total <= 0) {
    throw new Error(`playCptGame: 라운드 수를 못 읽었다 — "${totalText}"`);
  }

  await page.waitForSelector("#game-panel");
  await page.click("#game-panel"); // intro → 1라운드 시작

  for (let round = 0; round < total; round++) {
    // 이번 라운드의 신호가 뜰 때까지 기다린다. null이면 이미 화면을 벗어난 것
    // (마지막 라운드가 결과로 넘어간 경우) — 그러면 더 볼 라운드가 없다.
    let seenMsg = null;
    for (let tries = 0; tries < 80; tries++) {
      const msg = await page.textContent("#game-msg").catch(() => null);
      if (msg === null) break;
      if (msg.includes("지금 클릭") || msg.includes("누르지 마세요")) {
        seenMsg = msg;
        break;
      }
      await page.waitForTimeout(50);
    }
    if (seenMsg === null) break;
    if (seenMsg.includes("지금 클릭")) await page.click("#game-panel");

    // no-go를 올바르게 참았을 때는 피드백 화면 없이 최대 1초 대기 후 바로 다음
    // 라운드로 넘어간다. 고정 시간만 기다리면 이 대기가 덜 끝난 상태에서 다음
    // 반복이 같은 "누르지 마세요!" 문구를 다시 읽어 라운드를 잘못 센다 — 그래서
    // 문구 자체가 바뀔 때까지(=다음 라운드로 실제로 넘어갈 때까지) 기다린다.
    await page
      .waitForFunction(
        (prev) => document.querySelector("#game-msg")?.textContent !== prev,
        seenMsg,
        { timeout: 4000 }
      )
      .catch(() => {});
  }
}

// NumPath 보드를 DOM(data-r/data-c/data-type/data-op/data-operand/data-value)에서 읽어
// 순수 객체로 재구성한다. 페이지 안 엔진(js/games/numpath/engine.js)을 그대로 가져다 쓰지
// 않고 아래 solveNumpath()가 완전히 독립된 DFS를 새로 구현하는 이유: 페이지 엔진 자체에
// 버그가 있으면 페이지 엔진을 재사용한 검증은 그 버그를 같이 통과시켜버린다.
// 결론이 서로 다르면(예: 여기선 해가 없는데 생성기는 있다고 우겼다) 그게 진짜 버그 신호다.
async function readNumpathBoard(page) {
  const size = parseInt(await page.getAttribute(".np-board", "data-size"), 10);
  const tiles = await page.$$eval(".np-tile", (nodes) =>
    nodes.map((n) => ({
      r: parseInt(n.dataset.r, 10),
      c: parseInt(n.dataset.c, 10),
      type: n.dataset.type,
      op: n.dataset.op || null,
      operand: n.dataset.operand ? parseInt(n.dataset.operand, 10) : null,
      value: n.dataset.value ? parseInt(n.dataset.value, 10) : null,
    }))
  );
  const board = Array.from({ length: size }, () => Array(size).fill(null));
  let start = null;
  for (const t of tiles) {
    board[t.r][t.c] = t;
    if (t.type === "start") start = t;
  }
  const target = parseInt((await page.textContent("#np-target")).trim(), 10);
  const moveLimit = parseInt((await page.textContent("#np-moves")).split("/")[1], 10);
  return { size, board, start, target, moveLimit };
}

function solveNumpath(puzzle) {
  const DIRS = [
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1],
  ];
  const visited = new Set([`${puzzle.start.r},${puzzle.start.c}`]);
  let found = null;

  function applyOp(v, op, operand) {
    if (op === "+") return v + operand;
    if (op === "-") return v - operand;
    if (op === "*") return v * operand;
    if (op === "/") return v / operand;
    throw new Error(`solveNumpath: 알 수 없는 연산자 ${op}`);
  }

  function dfs(r, c, value, moves, path) {
    if (found) return;
    if (value === puzzle.target) {
      found = path.slice();
      return;
    }
    if (moves >= puzzle.moveLimit) return;
    for (const [dr, dc] of DIRS) {
      const nr = r + dr;
      const nc = c + dc;
      if (nr < 0 || nr >= puzzle.size || nc < 0 || nc >= puzzle.size) continue;
      const key = `${nr},${nc}`;
      if (visited.has(key)) continue;
      const cell = puzzle.board[nr][nc];
      if (!cell || cell.type === "block") continue;
      const next = applyOp(value, cell.op, cell.operand);
      if (cell.op === "/" && !Number.isInteger(next)) continue;
      if (next <= 0) continue;
      visited.add(key);
      path.push({ r: nr, c: nc });
      dfs(nr, nc, next, moves + 1, path);
      path.pop();
      visited.delete(key);
      if (found) return;
    }
  }

  dfs(puzzle.start.r, puzzle.start.c, puzzle.start.value, 0, []);
  return found;
}

// 한 런 전체를 자체 솔버가 찾은 경로대로 끝까지 클릭해 클리어한다. 스테이지 수는 상수를
// import하지 않고 HUD 진행률 표시("1 / 6")에서 읽는다 — playCptGame과 같은 이유(D-17).
async function playNumpathRun(page) {
  const firstStageText = await page.textContent("#np-stage");
  const total = parseInt(firstStageText.split("/")[1], 10);
  if (!Number.isInteger(total) || total <= 0) {
    throw new Error(`playNumpathRun: 스테이지 수를 못 읽었다 — "${firstStageText}"`);
  }

  for (let stage = 0; stage < total; stage++) {
    await page.waitForSelector(".np-board .np-tile");
    const puzzle = await readNumpathBoard(page);
    const solutionPath = solveNumpath(puzzle);
    if (!solutionPath) {
      throw new Error(`playNumpathRun: 자체 솔버가 스테이지 ${stage}의 해를 못 찾음 — 생성기/엔진 불일치 의심`);
    }
    for (const { r, c } of solutionPath) {
      await page.click(`.np-tile[data-r="${r}"][data-c="${c}"]`);
    }
    if (stage < total - 1) {
      // 다음 스테이지의 target이 우연히 이전 스테이지와 같은 값일 수 있어(둘 다 무작위
      // 범위 안에서 뽑힌 숫자) target 텍스트로 전환을 기다리면 안 된다 — #np-stage는
      // 스테이지마다 반드시 1씩 늘어나므로 이걸로 전환 완료를 확인한다.
      const prevStageText = await page.textContent("#np-stage");
      await page.waitForFunction(
        (prev) => document.querySelector("#np-stage")?.textContent !== prev,
        prevStageText,
        { timeout: 3000 }
      );
    }
  }
  return total;
}

(async () => {
  const browser = await chromium.launch({
    executablePath: findChromium(),
    args: ["--no-sandbox"],
  });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();

  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  // 샌드박스는 아웃바운드가 프록시로 막혀 외부 자원(CDN 폰트 · AdFit 로더 · 클라우드 로그인용
  // Supabase JS — NumPath 마을 동기화·우상단 관리자 로그인이 공유해서 쓴다)이 항상 실패한다.
  // 앱 버그가 아니므로 제외한다. 다만 "Failed to load resource: ... 403" 같은 메시지는 본문에
  // 주소가 없어서 m.text()만 보면 걸러지지 않는다 — m.location().url까지 같이 본다.
  // (AdFit 스크립트가 슬롯마다 붙었는지, NumPath 클라우드 패널이 실제로 "사용 불가" 상태로
  // 착지하는지는 아래 각 전용 검사가 DOM으로 따로 확인한다)
  const EXTERNAL_NOISE = /ERR_TUNNEL_CONNECTION_FAILED|jsdelivr|pretendard|daumcdn|AdFit|esm\.sh|불러오지 못했습니다/i;
  page.on("console", (m) => {
    if (m.type() !== "error") return;
    const t = m.text();
    const url = (m.location() && m.location().url) || "";
    if (EXTERNAL_NOISE.test(t) || EXTERNAL_NOISE.test(url)) return;
    errors.push(url ? `${t} (${url})` : t);
  });

  const goto = (p) => page.goto(BASE + p, { waitUntil: "networkidle" });

  // === 모듈 로딩 — <script type="module">이 실제로 떴는가 ===
  await goto("/");
  check("ES 모듈 부팅", await page.isVisible(".hero-title"), page.url());

  // === 광고 슬롯에 AdFit 로더가 실제로 붙는가 ===
  // ba.min.js는 실행 시점의 문서만 훑는다. refreshAds()가 그 <script> 태그 자체를 통째로
  // 갈아끼워(replaceWith) 재실행시키는 방식으로 화면 전환마다 재스캔시킨다 — index.html에
  // 한 번만 심어두는 방식으로 되돌아가면 슬롯은 그려지는데 광고만 조용히 안 나온다.
  // (샌드박스에선 로더 자체가 차단되므로 "태그가 실제로 갈아끼워지는가"까지만 본다)
  const adSlotCount = (root) => root.$$eval(".ad-slot ins.kakao_ad_area", (list) => list.length);
  const loaderExists = (root) => root.$eval('script[src*="ba.min.js"]', () => true).catch(() => false);
  // 지금 붙어있는 로더 태그에 표시를 남겨서, 다음 화면 전환 때 refreshAds()가 그 태그를
  // 실제로 갈아끼웠는지(표시가 사라졌는지) 확인한다 — 태그 존재만으로는 "한 번도 안
  // 갈아끼워졌다"와 구분이 안 된다.
  const markLoader = (root, mark) =>
    root.evaluate((m) => {
      const s = document.querySelector('script[src*="ba.min.js"]');
      if (s) s.dataset.verifyMark = m;
    }, mark);
  const loaderMark = (root) =>
    root.evaluate(() => document.querySelector('script[src*="ba.min.js"]')?.dataset.verifyMark || null);

  const homeAdCount = await adSlotCount(page);
  check("홈 광고 슬롯 존재", homeAdCount > 0, `${homeAdCount}개`);
  check("홈 로더 스크립트 태그 존재", await loaderExists(page));
  await markLoader(page, "home");

  // === 목록 카드가 등록된 테스트에서 자동 생성되는가 (registerTest) ===
  await page.click('[data-nav="psych-list"]');
  const cards = await page.$$eval(".test-card .name", (n) => n.map((e) => e.textContent.trim()));
  check("목록 카드 자동 생성", cards.length >= 2, cards.join(" | "));

  // === ADHD: 개수 문구 · 전 문항 응답 · 문항 후 게임으로 직행 · 채점 회귀 ===
  await page.click('[data-nav="test-intro"]');
  const adhdChips = await page.$$eval(".meta-chip .value", (n) => n.map((e) => e.textContent));
  check("ADHD 인트로 주소", page.url().endsWith("/test/adhd"), page.url());

  // 새로고침 없는 화면 이동에서도(홈 → 목록 → 인트로, 둘 다 광고 슬롯 있음) 로더 태그가
  // 매번 갈아끼워져야 한다 — index.html 한 번 심기로는 절대 통과할 수 없는 검사다
  // (표시가 그대로 남아있으면 refreshAds()가 실행되지 않았다는 뜻).
  check(
    "SPA 이동 후 로더 태그가 재실행됨(교체됨)",
    (await loaderMark(page)) !== "home",
    `mark=${await loaderMark(page)}`
  );

  await page.click(".cta-btn");
  await page.click(".modal-btn-primary").catch(() => {});

  // === 문항 뒤로가기: in-place 리팩터 후에도 정확히 한 단계씩만 되돌아가는가 ===
  // (go()를 다시 안 부르고 텍스트만 바꾸는 방식으로 바뀌면서 생길 수 있는 회귀 —
  // 다음 문항으로 진짜 넘어갔는지, 뒤로가기가 딱 한 문항만 되돌리는지 직접 확인)
  await page.waitForSelector(".option-btn");
  const q1Text = await page.textContent("#q-text");
  await page.click(".options .option-btn:nth-child(1)"); // Q1 답변 → Q2로
  await page.waitForFunction(
    (prev) => document.querySelector("#q-text")?.textContent !== prev,
    q1Text,
    { timeout: 3000 }
  );
  const q2Text = await page.textContent("#q-text");
  check(
    "ADHD 답변 후 같은 화면에서 다음 문항으로(재이동 없음)",
    q2Text !== q1Text && page.url().endsWith("/test/adhd/play"),
    `"${q1Text}" → "${q2Text}", ${page.url()}`
  );
  await page.click("#q-back"); // Q2 → Q1로
  await page.waitForFunction(
    (prev) => document.querySelector("#q-text")?.textContent !== prev,
    q2Text,
    { timeout: 3000 }
  );
  const backText = await page.textContent("#q-text");
  check("ADHD 뒤로가기 → 직전 문항으로 정확히 한 단계만 복귀", backText === q1Text, `"${backText}" vs "${q1Text}"`);
  await page.click("#q-back"); // 첫 문항에서 뒤로가기 → 인트로
  check("ADHD 첫 문항에서 뒤로가기 → 인트로", page.url().endsWith("/test/adhd"), page.url());

  // 다시 시작 (state.answers는 #start-btn 핸들러가 리셋한다)
  await page.click(".cta-btn");
  await page.click(".modal-btn-primary").catch(() => {});

  // 문항 화면은 진입 시 한 번만 그리고, 다음 문항으로 넘어갈 땐 텍스트·선택지만
  // 갈아끼운다(go()를 다시 부르지 않는다) — 광고 슬롯이 문항마다 새로 만들어지며
  // refreshAds()가 반복 실행되는 걸 막기 위해서다. 로더 표시가 마지막 문항 직전까지
  // 그대로 남아있어야 이게 실제로 지켜지고 있다는 뜻이다.
  await markLoader(page, "adhd-question");
  const adhdTotal = parseInt(adhdChips[0], 10);
  for (let i = 0; i < adhdTotal - 1; i++) {
    await page.waitForSelector(".option-btn");
    await page.click(".options .option-btn:nth-child(1)"); // 전부 "매우 그렇다"
  }
  check(
    "ADHD 문항 진행 중 광고 슬롯이 한 번만 마운트됨(로더 재실행 없음)",
    (await loaderMark(page)) === "adhd-question",
    `mark=${await loaderMark(page)} (문항 ${adhdTotal - 1}개 통과)`
  );
  check(
    "ADHD 문항 화면에 광고 슬롯 정확히 2개(상단+하단, 중복 누적 없음)",
    (await page.$$eval(".ad-slot", (l) => l.length)) === 2,
    `${await page.$$eval(".ad-slot", (l) => l.length)}개`
  );
  await page.waitForSelector(".option-btn");
  await page.click(".options .option-btn:nth-child(1)"); // 마지막 문항

  // 반응속도 게임은 보너스가 아니라 이 테스트의 마지막 단계다 — 문항이 끝나면 결과가
  // 아니라 게임으로 바로 이어진다. 결과는 게임까지 마쳐야 볼 수 있다(guard).
  await page.waitForSelector('h2:has-text("반응속도 게임")', { timeout: 5000 });
  check("ADHD 문항 완료 → 결과가 아니라 게임으로 직행", page.url().endsWith("/test/adhd/reaction"), page.url());
  check(
    "최고기록 게이미피케이션 없음 (게임 채점 철학과 충돌 — docs/DECISIONS.md D-19)",
    !(await page.content()).includes("최고기록")
  );

  await page.click(".cta-btn"); // 게임 시작 — 방법 안내 모달이 뜬다
  await page.click(".modal-btn-primary");
  await playCptGame(page); // 전부 정답으로 클린 플레이 (보너스 0 → 축 퍼센트가 안 흔들림)

  // 게임이 끝나면 결과가 아니라 광고 게이트(reaction-ad)를 한 번 거친다.
  // 카운트다운 중엔 버튼이 비활성 상태이고, 다 세면 활성화된다(js/core/dom.js bindAdGate).
  await page.waitForSelector("#ad-gate-continue", { timeout: 5000 });
  check("ADHD 게임 종료 → 결과가 아니라 광고 게이트로 직행", page.url().endsWith("/test/adhd/reaction/ad"), page.url());
  await page.waitForFunction(() => !document.querySelector("#ad-gate-continue").disabled, { timeout: 6000 });
  await page.click("#ad-gate-continue");

  await page.waitForSelector(".result-card", { timeout: 5000 });

  // 전부 "매우 그렇다"(4점) → 축마다 역채점 1문항이 0점이 되어 (4+4+4+0)/16 = 75%
  // 75 >= AXIS_HIGH_THRESHOLD(60) 이므로 3축 모두 high → "111" 태풍형
  // 게임을 클린 플레이했으므로 gameBonuses()는 0을 반환해 이 퍼센트를 흔들지 않는다.
  const pcts = await page.$$eval(".axis-row", (rows) =>
    rows.map((r) => r.textContent.replace(/\s+/g, " ").trim())
  );
  check("ADHD 전부 최고점 → 3축 75% (역채점 반영)", pcts.every((t) => /75%/.test(t)), pcts.join(" | "));
  check("ADHD 전부 최고점 → 111 태풍형", /태풍/.test(await page.textContent(".result-card")));
  check("ADHD 결과 주소", page.url().includes("/test/adhd/result"), page.url());
  check(
    "최종 결과에 게임 분석이 같은 결과로 병합됨 (별도 결과 화면 없음)",
    (await page.content()).includes("게임에서 측정된 수치")
  );

  // === 게임 타이머 정리 (onLeave) — "다시하기"로 재진입해 라운드 도중 이탈해도
  // 남은 rAF/timeout이 화면을 결과로 밀어버리지 않는가 (docs/ERRORS.md E-4) ===
  await page.click("#replay-game-btn");
  await page.waitForSelector("#game-panel");
  await page.click("#game-panel"); // 라운드 시작 — 타이머가 예약된 상태
  await page.waitForTimeout(300);
  await page.click('[data-nav="reaction-intro"]'); // 라운드 도중 이탈
  await page.waitForTimeout(2000); // 살아남은 콜백이 있으면 이 사이에 화면을 밀어버린다
  check(
    "게임 도중 이탈 후 화면이 밀리지 않음 (onLeave)",
    await page.isVisible('h2:has-text("반응속도 게임")'),
    page.url()
  );

  // === DISC: 2단계 강제선택 흐름 ===
  await goto("/test/disc");
  const discChips = await page.$$eval(".meta-chip .value", (n) => n.map((e) => e.textContent));
  const discTotal = parseInt(discChips[0], 10);
  check("DISC 인트로 개수 문구", Number.isInteger(discTotal) && discTotal > 0, discChips.join(" | "));

  // === 검사 시작 없이 12가지 유형 미리보기 → 유형 클릭 시 공유 상세로 이동 ===
  await page.click('[data-nav="disc-types"]');
  check("결과 유형 칩 → 12가지 미리보기 화면", page.url().endsWith("/test/disc/types"), page.url());
  const typeCardCount = await page.$$eval(".test-card", (l) => l.length);
  check(
    "유형 미리보기 카드 개수가 결과 유형 수와 일치",
    typeCardCount === discTotal,
    `카드 ${typeCardCount}개 vs 칩 문구 ${discTotal}`
  );
  await page.click(".test-card >> nth=0");
  await page.waitForSelector(".result-card", { timeout: 5000 });
  check(
    "유형 카드 클릭 → 검사 없이 해당 유형 상세로 직행",
    /\/test\/disc\/result\/[a-z0-9-]+$/.test(page.url()),
    page.url()
  );
  await goto("/test/disc/types");
  await page.click(".back-btn");
  check("유형 미리보기 뒤로가기 → 인트로", page.url().endsWith("/test/disc"), page.url());

  await page.click("#disc-start");
  await page.click(".modal-btn-primary").catch(() => {});

  // === DISC 문항 뒤로가기: 2단계(most/least) 사이, 문항 사이 각각 확인 ===
  await page.waitForSelector(".options .option-btn:not([disabled])");
  const scene1 = await page.textContent("#disc-scene");
  await page.click(".options .option-btn:not([disabled])"); // most 선택 → least 단계로
  await page.waitForSelector(".disc-step-hint.least", { timeout: 3000 });
  check(
    "DISC most 선택 후 같은 화면에서 least 단계로(재이동 없음)",
    page.url().endsWith("/test/disc/play"),
    page.url()
  );
  await page.click("#disc-back"); // least → 같은 문항의 most 단계로
  await page.waitForFunction(
    () => !document.querySelector(".disc-step-hint").classList.contains("least"),
    { timeout: 3000 }
  );
  const sceneAfterBack = await page.textContent("#disc-scene");
  check(
    "DISC least에서 뒤로가기 → 같은 문항의 most 단계로 복귀",
    sceneAfterBack === scene1,
    `"${sceneAfterBack}" vs "${scene1}"`
  );
  await page.click("#disc-back"); // 첫 문항 most에서 뒤로가기 → 인트로
  check("DISC 첫 문항 most에서 뒤로가기 → 인트로", page.url().endsWith("/test/disc"), page.url());

  // 다시 시작 (#disc-start가 startDiscTest()로 state.disc를 통째로 리셋한다)
  await page.click("#disc-start");
  await page.click(".modal-btn-primary").catch(() => {});

  // ADHD와 같은 이유로, DISC 문항 화면도 문항·단계가 바뀔 때 go()를 다시 부르지
  // 않고 텍스트·선택지만 갈아끼운다. 로더 표시가 마지막 문항 직전까지 그대로
  // 남아있어야 한다(2단계짜리라 총 discTotal*2번 클릭 중 마지막 한 번만 빼고 확인).
  await markLoader(page, "disc-question");
  for (let i = 0; i < discTotal - 1; i++) {
    // 1단계: 가장 나 같은 것 → 첫 번째
    await page.waitForSelector(".options .option-btn:not([disabled])");
    await page.click(".options .option-btn:not([disabled])");
    // 2단계: 가장 아닌 것 → 방금 고른 것은 disabled 이므로 남은 것 중 첫 번째
    await page.waitForSelector(".options .option-btn:not([disabled])");
    await page.click(".options .option-btn:not([disabled])");
  }
  check(
    "DISC 문항 진행 중 광고 슬롯이 한 번만 마운트됨(로더 재실행 없음)",
    (await loaderMark(page)) === "disc-question",
    `mark=${await loaderMark(page)} (문항 ${discTotal - 1}개 통과)`
  );
  check(
    "DISC 문항 화면에 광고 슬롯 정확히 2개(상단+하단, 중복 누적 없음)",
    (await page.$$eval(".ad-slot", (l) => l.length)) === 2,
    `${await page.$$eval(".ad-slot", (l) => l.length)}개`
  );
  // 마지막 문항 (1단계 + 2단계) — 끝나면 딜레마 게임으로 넘어간다
  await page.waitForSelector(".options .option-btn:not([disabled])");
  await page.click(".options .option-btn:not([disabled])");
  await page.waitForSelector(".options .option-btn:not([disabled])");
  await page.click(".options .option-btn:not([disabled])");

  // 문항이 끝나면 결과가 아니라 딜레마 게임으로 이어진다 — 게임 결과까지 반영된
  // 유형을 한 번에 보여주기 위해 disc-result 가드가 게임 완료를 요구한다.
  check("문항 완료 → 딜레마 인트로로 자동 이동", page.url().endsWith("/test/disc/dilemma"), page.url());

  await page.click("#dilemma-start");
  let dilemmaRounds = 0;
  let sawFourAxisRound = true;
  // 딜레마 라운드는 이제 문항과 같은 .options/.option-btn을 그대로 쓴다(카드형 타이머
  // 패널이 아니라 D/I/S/C 4지선다 한 번씩). URL이 dilemma/play인 동안만 진행 중으로 본다.
  while (page.url().includes("/test/disc/dilemma/play")) {
    await page.waitForSelector(".options .option-btn", { timeout: 3000 });
    const optCount = (await page.$$(".options .option-btn")).length;
    if (optCount !== 4) sawFourAxisRound = false;
    await page.click(".options .option-btn >> nth=0");
    // 다음 라운드로 넘어가며 선택지가 갈아끼워지거나 결과로 이동해 옛 버튼이 전부
    // 사라질 때까지 기다린 뒤에야 다시 확인해야, 같은 라운드를 헛클릭하며 도는 걸 피한다.
    await page.waitForSelector(".options .option-btn", { state: "detached", timeout: 3000 }).catch(() => {});
    dilemmaRounds++;
    if (dilemmaRounds > 20) break; // 무한루프 방지 (버그가 있으면 여기서 멎는다)
  }
  check("딜레마 매 라운드 선택지 4개(D/I/S/C)", sawFourAxisRound);

  // 딜레마 게임이 끝나면 결과가 아니라 광고 게이트(dilemma-ad)를 한 번 거친다.
  await page.waitForSelector("#ad-gate-continue", { timeout: 5000 });
  check("딜레마 게임 종료 → 결과가 아니라 광고 게이트로 직행", page.url().endsWith("/test/disc/dilemma/ad"), page.url());
  await page.waitForFunction(() => !document.querySelector("#ad-gate-continue").disabled, { timeout: 6000 });
  await page.click("#ad-gate-continue");

  await page.waitForSelector(".result-card", { timeout: 5000 });
  check("딜레마 게임 완주 → 별도 결과 화면 없이 DISC 결과로 직행", page.url().includes("/test/disc/result"), page.url());
  check("DISC 결과에 유형 표시", (await page.textContent(".result-card")).trim().length > 20);

  // 같은 선택지를 most이자 least로 고를 수 없다 (2단계에서 disabled)
  check("DISC 강제선택 2단계 완주", true);

  // 옛 /test/disc/dilemma/result 화면은 제거됐다 — 알 수 없는 경로는 홈으로
  await goto("/test/disc/dilemma/result");
  check("제거된 딜레마 결과 경로 → 홈 폴백", await page.isVisible(".hero-title"), page.url());

  // === NumPath: 미니게임 목록 노출 · 자체 솔버로 완주 · in-place 스테이지 전환 · Undo/Reset · onLeave ===
  // 반응속도·딜레마 게임과 달리 registerGame()된 독립 게임이라 /game 목록에 실제로 나와야 한다
  // (CURRENT_TASK.md "미니게임 목록이 비어 있음" 항목이 이걸로 해소된다).
  await goto("/game");
  const gameCards = await page.$$eval(".test-card .name", (n) => n.map((e) => e.textContent.trim()));
  check("미니게임 목록에 NumPath 카드 노출(빈 상태 아님)", gameCards.includes("NumPath: Stack & Clear"), gameCards.join(" | "));

  await page.click('[data-nav="numpath-intro"]');
  check("NumPath 인트로 주소", page.url().endsWith("/game/numpath"), page.url());

  // === 난이도 선택 UI — 카드 수·기본 선택·난이도별 스테이지 수 확충·선택 토글 ===
  // 스테이지 수는 상수를 import하지 않고 카드 문구("N스테이지")에서 읽는다(D-17).
  const diffCards = await page.$$eval(".np-diff", (nodes) =>
    nodes.map((n) => ({
      id: n.dataset.diff,
      selected: n.classList.contains("np-diff--selected"),
      stages: parseInt((n.textContent.match(/(\d+)\s*스테이지/) || [])[1], 10),
    }))
  );
  check(
    "NumPath 난이도 카드가 여러 개 있고 기본 선택이 정확히 하나다",
    diffCards.length >= 2 && diffCards.filter((d) => d.selected).length === 1,
    JSON.stringify(diffCards)
  );
  check(
    "난이도별 스테이지 수가 전부 다르다(회차 확충)",
    diffCards.every((d) => Number.isInteger(d.stages) && d.stages > 0) &&
      new Set(diffCards.map((d) => d.stages)).size === diffCards.length,
    diffCards.map((d) => `${d.id}:${d.stages}`).join(" ")
  );
  // 이후 검사는 첫 카드(가장 쉬운 난이도)로 돈다 — 런이 짧아 빠르고, 선택 토글도 같이 검증된다.
  await page.click(".np-diff:first-child");
  check(
    "난이도 카드 클릭 → 선택 표시가 그 카드로 옮겨감",
    await page.$eval(".np-diff:first-child", (n) => n.classList.contains("np-diff--selected")),
  );
  const easyStageCount = diffCards[0].stages;

  await page.click("#start-btn");
  await page.click(".modal-btn-primary").catch(() => {});
  await page.waitForSelector(".np-board .np-tile", { timeout: 5000 });
  check("NumPath 플레이 진입 → HUD 채워짐", page.url().endsWith("/game/numpath/play"), page.url());
  const npHudFilled =
    /\d/.test(await page.textContent("#np-target")) &&
    /\d/.test(await page.textContent("#np-current")) &&
    /\d\s*\/\s*\d/.test(await page.textContent("#np-moves"));
  check("NumPath HUD(TARGET/CURRENT/MOVES) 채워짐", npHudFilled);
  const npStageTotal = parseInt((await page.textContent("#np-stage")).split("/")[1], 10);
  check(
    "HUD 스테이지 총수 = 인트로에서 고른 난이도의 스테이지 수",
    npStageTotal === easyStageCount,
    `HUD=${npStageTotal}, 카드=${easyStageCount}`
  );
  check("HUD에 선택한 난이도 표시", (await page.textContent("#np-diff")).trim().length > 0);

  // Undo/Reset: 한 칸 이동 → Undo로 되돌리고 → 다시 이동 → Reset으로 처음 상태까지 되돌린다.
  {
    const puzzle0 = await readNumpathBoard(page);
    const path0 = solveNumpath(puzzle0);
    if (!path0) throw new Error("NumPath Undo/Reset 검사: 자체 솔버가 스테이지 0의 해를 못 찾음");
    const startValueText = await page.textContent("#np-current");
    const first = path0[0];

    await page.click(`.np-tile[data-r="${first.r}"][data-c="${first.c}"]`);
    const afterMoveValue = await page.textContent("#np-current");
    const startTileVoidAfterMove = await page.$eval(
      `.np-tile[data-r="${puzzle0.start.r}"][data-c="${puzzle0.start.c}"]`,
      (n) => n.classList.contains("np-tile--void")
    );
    check(
      "NumPath 이동 후 CURRENT 값이 바뀌고 이전 칸은 소멸 표시됨",
      afterMoveValue !== startValueText && startTileVoidAfterMove,
      `${startValueText} → ${afterMoveValue}`
    );

    await page.click("#np-undo");
    const afterUndoValue = await page.textContent("#np-current");
    const startTileVoidAfterUndo = await page.$eval(
      `.np-tile[data-r="${puzzle0.start.r}"][data-c="${puzzle0.start.c}"]`,
      (n) => n.classList.contains("np-tile--void")
    );
    check(
      "NumPath Undo → CURRENT 값·소멸 표시 모두 원복",
      afterUndoValue === startValueText && !startTileVoidAfterUndo,
      `${afterMoveValue} → ${afterUndoValue}`
    );

    await page.click(`.np-tile[data-r="${first.r}"][data-c="${first.c}"]`);
    await page.click("#np-reset");
    const afterResetValue = await page.textContent("#np-current");
    const afterResetMoves = await page.textContent("#np-moves");
    check(
      "NumPath Reset → 시작 상태로 완전히 복귀",
      afterResetValue === startValueText && afterResetMoves.trim().startsWith("0"),
      `value=${afterResetValue} moves=${afterResetMoves}`
    );
  }

  // 스테이지 전환이 in-place인가 — go()로 화면을 다시 그리면 광고 슬롯도 새로 만들어져
  // refreshAds()가 스테이지마다 실행된다(D-26과 같은 회귀). 로더 표시가 스테이지 전환 뒤에도
  // 그대로 남아있어야 in-place 렌더가 지켜지고 있다는 뜻이다.
  await markLoader(page, "numpath-play");
  // target 텍스트는 스테이지가 바뀌어도 우연히 같은 값일 수 있어(playNumpathRun과 같은 이유)
  // #np-stage로 전환을 확인한다.
  const npFirstStageText = await page.textContent("#np-stage");
  {
    const puzzleForAdvance = await readNumpathBoard(page);
    const pathForAdvance = solveNumpath(puzzleForAdvance);
    if (!pathForAdvance) throw new Error("NumPath in-place 전환 검사: 자체 솔버가 스테이지 0의 해를 못 찾음");
    for (const { r, c } of pathForAdvance) {
      await page.click(`.np-tile[data-r="${r}"][data-c="${c}"]`);
    }
  }
  await page.waitForFunction(
    (prev) => document.querySelector("#np-stage")?.textContent !== prev,
    npFirstStageText,
    { timeout: 3000 }
  );
  check(
    "NumPath 스테이지 전환 후에도 광고 로더 태그 유지(in-place, 재마운트 아님)",
    (await loaderMark(page)) === "numpath-play",
    `mark=${await loaderMark(page)}`
  );
  check(
    "NumPath 스테이지 전환 시 광고 슬롯 정확히 2개(상단+하단, 중복 누적 없음)",
    (await page.$$eval(".ad-slot", (l) => l.length)) === 2
  );

  // === 스테이지 클리어 직후(다음 스테이지로 넘어가기 전 900ms 지연 중) 이탈해도
  // 남은 setTimeout이 다른 화면을 밀어버리지 않는가 (E-4와 같은 종류의 버그) ===
  {
    const puzzleForLeave = await readNumpathBoard(page);
    const pathForLeave = solveNumpath(puzzleForLeave);
    if (!pathForLeave) throw new Error("NumPath onLeave 검사: 자체 솔버가 해를 못 찾음");
    for (const { r, c } of pathForLeave) {
      await page.click(`.np-tile[data-r="${r}"][data-c="${c}"]`);
    }
    // 클리어 직후, 다음 스테이지 로드를 예약하는 setTimeout이 아직 안 끝난 상태에서 이탈한다.
    await page.click('[data-nav="numpath-intro"]');
    await page.waitForTimeout(1500); // 살아남은 타이머가 있으면 이 사이에 화면을 밀어버린다
    check(
      "NumPath 클리어 직후 이탈해도 화면이 밀리지 않음 (onLeave)",
      page.url().endsWith("/game/numpath") && (await page.isVisible(".cover")),
      page.url()
    );
  }

  // === 나머지 런 완주 → 광고 게이트 → 결과 (자체 솔버 재사용) ===
  await page.click("#start-btn");
  await page.click(".modal-btn-primary").catch(() => {});
  await page.waitForSelector(".np-board .np-tile", { timeout: 5000 });
  await playNumpathRun(page);
  await page.waitForSelector("#ad-gate-continue", { timeout: 5000 });
  check("NumPath 런 완주 → 결과가 아니라 광고 게이트로 직행", page.url().endsWith("/game/numpath/ad"), page.url());
  await page.waitForFunction(() => !document.querySelector("#ad-gate-continue").disabled, { timeout: 6000 });
  await page.click("#ad-gate-continue");
  await page.waitForSelector(".result-card", { timeout: 5000 });
  check("NumPath 결과 주소", page.url().endsWith("/game/numpath/result"), page.url());
  check(
    "NumPath 결과에 별 기록 표시",
    (await page.textContent(".result-card")).includes("⭐"),
    (await page.textContent(".result-card")).replace(/\s+/g, " ").trim().slice(0, 80)
  );
  check(
    "NumPath 결과에 이번 런 코인 보상 표시",
    (await page.textContent(".result-card")).includes("🪙"),
    (await page.textContent(".result-subtitle")).trim()
  );

  // 다시 시작 → 인트로로 (자동으로 새 런을 시작하지 않는다 — ADHD "테스트 다시하기"와 같은 패턴)
  await page.click("#retry-btn");
  check("NumPath 다시하기 → 인트로로(자동 재시작 아님)", page.url().endsWith("/game/numpath"), page.url());

  // === 넘버 마을: 코인 적립 → 건설 → 영속(localStorage) ===
  // 방금 런(+앞의 부분 클리어들)에서 별×난이도 배수만큼 코인이 쌓였어야 하고, 첫 건물은
  // 최저 난이도 한 런 보상으로 살 수 있게 잡혀 있다(test/numpath.village.test.js의 경제 검증).
  await page.click("#np-village-btn");
  await page.waitForSelector(".np-shop", { timeout: 5000 });
  check("마을 화면 주소", page.url().endsWith("/game/numpath/village"), page.url());
  const walletBefore = parseInt((await page.textContent("#np-wallet")).replace(/\D/g, ""), 10);
  check("런에서 번 코인이 마을 지갑에 적립됨", Number.isInteger(walletBefore) && walletBefore > 0, `wallet=${walletBefore}`);

  const buildBtn = await page.$(".np-build-btn:not([disabled])");
  check("지갑 코인으로 살 수 있는 건물이 있다", !!buildBtn);
  if (buildBtn) {
    await markLoader(page, "numpath-village");
    await buildBtn.click();
    await page.waitForFunction(
      (prev) => document.querySelector("#np-wallet")?.textContent.replace(/\D/g, "") !== prev,
      String(walletBefore),
      { timeout: 3000 }
    );
    const walletAfter = parseInt((await page.textContent("#np-wallet")).replace(/\D/g, ""), 10);
    const builtCount = await page.$$eval(".np-shop-item--built", (l) => l.length);
    check("건설 → 코인 차감 + 완공 표시 + 마을 풍경에 등장", walletAfter < walletBefore && builtCount >= 1 && (await page.$$eval(".np-scene-item", (l) => l.length)) >= 1, `🪙 ${walletBefore}→${walletAfter}, built=${builtCount}`);
    check(
      "마을 건설 재렌더 후에도 광고 로더 태그 유지(in-place, 재마운트 아님)",
      (await loaderMark(page)) === "numpath-village",
      `mark=${await loaderMark(page)}`
    );

    // 영속성: 새로고침해도 지갑·건설 목록이 남는다 (localStorage["gt_numpath_village"], D-51)
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForSelector(".np-shop", { timeout: 5000 });
    const walletReloaded = parseInt((await page.textContent("#np-wallet")).replace(/\D/g, ""), 10);
    check(
      "새로고침 후에도 마을 진행 유지(localStorage)",
      walletReloaded === walletAfter && (await page.$$eval(".np-shop-item--built", (l) => l.length)) === builtCount,
      `reload: 🪙 ${walletReloaded}, built=${await page.$$eval(".np-shop-item--built", (l) => l.length)}`
    );
  }

  // === 넘버 마을 클라우드 연동 패널(D-52) — CDN 차단 상황에서도 화면이 안 죽는가 ===
  // 샌드박스는 esm.sh(Supabase JS)로 나가는 요청이 막혀 있다. 이건 배포 환경에서도 오프라인·
  // 네트워크 장애 시 똑같이 재현되는 상태라, "클라우드가 아예 안 뜨는 것"이 아니라 "패널이
  // 사용 불가로 착지하고 나머지 화면은 멀쩡한 것"을 검증한다 — cloud-loader.js가 실패를
  // 삼키지 않고 흡수하는 게 핵심이다. ("로딩 중" 초기 상태는 로컬 네트워크 실패가 너무 빨라
  // 안정적으로 잡히지 않는 순간의 상태라 여기선 검사하지 않는다 — 최종 착지 상태만 본다.)
  await page.waitForFunction(
    () => document.querySelector(".np-cloud-hint")?.textContent.includes("확인 중") === false,
    { timeout: 8000 }
  );
  check(
    "CDN 차단 시 클라우드 패널이 '사용 불가'로 착지하고 로그인 버튼을 감춘다",
    (await page.textContent(".np-cloud-hint")).includes("지금은 이 기능을 쓸 수 없어요") && (await page.$("#np-cloud-google")) === null,
    (await page.textContent(".np-cloud-hint")).trim()
  );
  check(
    "클라우드 모듈 로드 실패 후에도 마을 화면 나머지(지갑·건설 목록)는 정상 동작",
    await page.isVisible(".np-shop") && await page.isVisible("#np-wallet")
  );

  // === 관리자 전용 게이트: 부부 체크는 아직 출시 전이라 관리자(js/core/auth.js의
  // ADMIN_EMAIL)만 들어갈 수 있어야 한다. 로그인은 NumPath 마을과 같은 Supabase Auth를
  // 공유해서 쓴다(D-56) — 아래는 로그인 전(비관리자) 상태로 확인한다 ===
  await goto("/test");
  check("부부 체크 카드에 '출시 예정' 배지 (비관리자)", await page.isVisible(".coming-soon-badge"));
  await page.click('[data-nav="couple-intro"]');
  check(
    "비관리자가 카드를 클릭해도 목록에 그대로 남는다",
    page.url().endsWith("/test"),
    page.url()
  );
  check(
    "비관리자 접근 시 '곧 출시됩니다' 모달이 뜬다",
    (await page.textContent(".modal-title").catch(() => "")) === "곧 출시됩니다"
  );
  await page.click("#modal-confirm").catch(() => {});
  await goto("/test/couple/result");
  check(
    "비관리자가 하위 화면 주소로 직접 접속해도 목록으로 돌아온다",
    page.url().endsWith("/test"),
    page.url()
  );
  await page.click("#modal-confirm").catch(() => {});

  // 이후 부부 체크 회귀는 관리자 권한으로 진행한다 — 관리자 전용 기능이라 다른 방법이 없다.
  // 실제 Google 로그인(Supabase OAuth 리다이렉트)은 헤드리스에서 재현할 수 없어, localStorage를
  // js/core/auth.js와 같은 형식으로 직접 채워 "이미 로그인된" 상태를 흉내낸다 — 이 캐시는
  // 원래 Supabase 세션이 확인될 때 auth.js가 채워주는 값이라, CDN이 막힌 이 샌드박스에서도
  // NumPath 마을의 localStorage 폴백(D-52)과 같은 방식으로 유효하다.
  await page.evaluate(() => localStorage.setItem("gt_admin_email", "xogns022@gmail.com"));
  check(
    "관리자 로그인 후 배지가 사라진다",
    !(await goto("/test").then(() => page.isVisible(".coming-soon-badge")))
  );

  // === 부부 관계 성향 체크: 3축 선택 → 46문항 → 결과 → 배우자 코드 왕복 ===
  await goto("/test/couple");
  check("부부 체크 인트로 주소", page.url().endsWith("/test/couple"), page.url());
  check(
    "인트로에 응답 비공개 고지 노출 (§6.5.2)",
    await page.isVisible(".cp-privacy"),
    "cp-privacy"
  );
  check(
    "인트로에 '부부 결과 매칭' 버튼이 있다 (배우자 코드로 바로 합치기)",
    await page.isVisible('[data-nav="couple-pair"]')
  );
  // === 이용 안내 화면 ===
  // "둘이 하면 더 정확해진다"는 오해를 미리 풀어주는 화면이라, 링크가 살아 있는지와
  // 핵심 문장이 실제로 렌더되는지를 본다.
  await page.click('[data-nav="couple-guide"]');
  check("인트로 → 이용 안내", page.url().endsWith("/test/couple/guide"), page.url());
  const guideBody = (await page.textContent("#app")).replace(/\s+/g, " ");
  check(
    "안내에 '개인 결과는 합쳐도 더 정확해지지 않는다'가 명시됨",
    guideBody.includes("내 결과가 더 정확해지지는 않습니다"),
    guideBody.slice(0, 120)
  );
  check("안내에 이용 순서가 있다", guideBody.includes("배우자 초대 링크"));
  check("안내에 자주 묻는 것이 있다", guideBody.includes("자녀 단계는 꼭 같게 골라야 하나요"));
  check("안내에도 상시 안내 링크가 있다", await page.isVisible(".cp-support"));
  // 설명서가 "둘이 하면 더 정확" 류로 되돌아가는 변경을 막는다.
  check(
    "'합치면 더 정확' 류 표현 없음",
    !/합치면 더 정확|둘이 하면 더 정확|정확도가 (올라|높아)/.test(guideBody),
    guideBody.slice(0, 120)
  );
  await page.click('[data-nav="couple-intro"]');

  await page.click("#cp-start");
  check("시작하기 → 상황 고르기", page.url().endsWith("/test/couple/setup"), page.url());

  // 세 축을 다 고르기 전에는 진행 버튼이 잠겨 있어야 한다 — 하나라도 비면 문항 문장을
  // 고를 수 없어서, 조립 단계에서 터진다.
  check("축 미선택 상태에서 진행 버튼 잠김", await page.isDisabled("#cp-setup-next"));
  await page.click('.cp-axis-btn[data-code="T-H"]');
  await page.click('.cp-axis-btn[data-code="R-E"]');
  check("두 축만 골랐을 때도 여전히 잠김", await page.isDisabled("#cp-setup-next"));
  await page.click('.cp-axis-btn[data-code="K-1"]');
  check("세 축을 다 고르면 진행 버튼 열림", !(await page.isDisabled("#cp-setup-next")));
  await page.click("#cp-setup-next");
  await page.waitForSelector(".cp-likert-btn");

  const coupleTotalText = await page.textContent(".progress-count .total");
  const coupleTotal = parseInt(coupleTotalText.replace("/", ""), 10);
  check("문항 수를 진행 표시에서 읽음", Number.isInteger(coupleTotal) && coupleTotal > 0, coupleTotalText);

  // 문항 화면도 진입 시 한 번만 그리고 내용만 갈아끼운다(광고 로더 재실행 방지).
  await markLoader(page, "couple-question");

  // 뒤로가기가 정확히 한 문항만 되돌리는지 (ADHD와 같은 회귀 지점)
  const cq1 = await page.textContent("#cp-text");
  await page.click(".cp-likert-btn:nth-child(2)");
  await page.waitForFunction((prev) => document.querySelector("#cp-text")?.textContent !== prev, cq1, { timeout: 3000 });
  const cq2 = await page.textContent("#cp-text");
  await page.click("#cp-back");
  await page.waitForFunction((prev) => document.querySelector("#cp-text")?.textContent !== prev, cq2, { timeout: 3000 });
  check("부부 체크 뒤로가기 → 직전 문항으로 한 단계만 복귀", (await page.textContent("#cp-text")) === cq1);
  // 되돌아간 문항에는 직전에 고른 선택지가 그대로 표시돼 있어야 한다. 예전에는 뒤로 갈 때
  // 답을 지워서, 뭘 골랐는지 못 보고 다시 답해야 했다(선택 표시 코드가 죽은 분기였다).
  const cpBackPicked = await page.$$eval(".cp-likert-btn", (btns) =>
    btns.map((b, i) => (b.classList.contains("picked-most") ? i + 1 : 0)).filter(Boolean)
  );
  check(
    "뒤로 간 문항에 직전 선택이 그대로 표시된다",
    cpBackPicked.length === 1 && cpBackPicked[0] === 2,
    `picked=[${cpBackPicked}]`
  );

  // 비공개 재고지는 후반부 구간 진입 시점에 딱 한 번만 나온다(§6.5.2 v3.2).
  check("비공개 재고지가 초반 문항에서는 숨겨짐", !(await page.isVisible("#cp-anchor-notice")));

  // 전 문항 응답. "보통이다"만 찍으면 직선 응답으로 걸리므로 값을 흩어서 답한다.
  // 마지막 문항은 답하는 순간 광고 게이트로 넘어가므로(=refreshAds 실행) 루프 밖에 둔다 —
  // 그래야 아래 로더 표시 검사가 "문항 진행 중"만 보게 된다.
  // 앵커 문항(양쪽에 같은 문장으로 나가는 문항)은 두 사람이 정반대로 답하게 만든다.
  // 우연에 맡기면 인지 격차가 전부 "비슷함"으로 나올 수 있는데, 그러면 "격차 항목에는
  // 반드시 대화 스타터가 붙는다"(§6.5.3) 검사가 볼 대상 자체가 없어져 조용히 통과한다.
  const ANCHOR_HINTS = [
    "고마워한다고 느낀다",
    "들이는 노력을 잘 알고",
    "몫이 버겁게",
    "감당하기에 벅차다",
    "감당하는 몫이 배우자보다 크다고 느낀다",
    "조금 더 많이 짊어지고 있다고 느낀다",
  ];

  let noticeSeenAt = [];
  let anchorPick = 5; // 첫 번째 사람은 앵커에 "매우 그렇다"
  const answerCouple = async (i) => {
    await page.waitForSelector(".cp-likert-btn");
    if (await page.isVisible("#cp-anchor-notice")) noticeSeenAt.push(i + 1);
    const text = await page.textContent("#cp-text");
    if (ANCHOR_HINTS.some((h) => text.includes(h))) {
      await page.click(`.cp-likert-btn:nth-child(${anchorPick})`);
      return;
    }
    // 응답 품질 플래그가 서지 않는 "성실한 응답"을 흉내 낸다:
    //  - QC1은 안내대로 "그렇지 않다"(2점)
    //  - QC2와 I1은 같은 값(3점) — 두 문항 차이가 3점 이상이면 일관성 플래그가 선다.
    //    무작위로 답하면 여기가 자주 걸려서 이 검사 자체가 들쭉날쭉해진다.
    //  - 나머지는 값을 흩어서 직선 응답 검사를 피한다
    let pick = [4, 2, 5, 3, 1][i % 5];
    if (text.includes("성실한 응답을 확인하기 위한")) pick = 2;
    else if (text.includes("대화하는 시간을 소중하게") || text.includes("시시콜콜")) pick = 3;
    await page.click(`.cp-likert-btn:nth-child(${pick})`);
  };
  for (let i = 0; i < coupleTotal - 1; i++) await answerCouple(i);
  check(
    "부부 체크 문항 진행 중 광고 슬롯이 한 번만 마운트됨(로더 재실행 없음)",
    (await loaderMark(page)) === "couple-question",
    `mark=${await loaderMark(page)} (문항 ${coupleTotal - 1}개 통과)`
  );
  check(
    "부부 체크 문항 화면에 광고 슬롯 정확히 2개(상단+하단, 중복 누적 없음)",
    (await page.$$eval(".ad-slot", (l) => l.length)) === 2,
    `${await page.$$eval(".ad-slot", (l) => l.length)}개`
  );
  await answerCouple(coupleTotal - 1);
  // 특정 문항 바로 앞에 붙이면 그 문항이 민감하다는 신호가 되므로, 구간 진입 시점에
  // 중립적으로 딱 한 번만 노출한다.
  check(
    "비공개 재고지가 후반부 구간 진입 시점에 1회만 노출됨 (§6.5.2)",
    noticeSeenAt.length === 1 && noticeSeenAt[0] >= 30,
    `노출된 문항 번호: ${noticeSeenAt.join(",") || "없음"}`
  );

  await page.waitForSelector("#ad-gate-continue", { timeout: 5000 });
  check("문항 완료 → 광고 게이트로 직행", page.url().endsWith("/test/couple/ad"), page.url());
  await page.waitForFunction(() => !document.querySelector("#ad-gate-continue").disabled, { timeout: 6000 });
  await page.click("#ad-gate-continue");
  await page.waitForSelector(".result-card", { timeout: 5000 });
  check("부부 체크 결과 주소", page.url().endsWith("/test/couple/result"), page.url());

  // 결과 3요소(§6.1): 유형 라벨 · 연속 프로필 · 확신도가 항상 함께 나와야 한다.
  // 접기 블록: 핵심만 펼쳐두고 나머지는 접는다. 접힌 내용도 DOM에는 있어야 한다
  // (§6.4의 블록을 생략한 게 아니라 순서를 준 것).
  const folds = await page.$$eval(".cp-fold", (n) => n.map((d) => d.querySelector("summary").textContent.trim()));
  check("개인 결과에 접기 블록이 있다", folds.length >= 2, folds.join(" | "));
  check(
    "접힌 블록도 DOM에 내용이 있다",
    (await page.$$eval(".cp-fold .cp-fold-body", (n) => n.every((b) => b.textContent.trim().length > 10))),
    ""
  );
  const cpProfileBars = await page.$$eval(".cp-profile .cp-bar-row", (n) => n.length);
  check("결과에 연속 프로필이 함께 나옴 (§6.1 — 라벨 단독 노출 금지)", cpProfileBars >= 6, `${cpProfileBars}개 막대`);
  check("애착 축에 중간값 선 표시", (await page.$$(".cp-bar-mid")).length >= 2);
  const cpBody = (await page.textContent("#app")).replace(/\s+/g, " ");
  // 가까움·거리 막대는 예전엔 "경계에 가깝다"일 때만 문장이 붙어서, 그 외 경우엔 숫자만
  // 보고 뭘 뜻하는지 알 길이 없었다. 항상 풀어주는 문장이 있는지 본다.
  check(
    "가까움·거리 점수를 항상 말로 풀어준다 (편안한/자주 확인 등)",
    /(가까움을 자주 확인하고 싶어하는 편|가까움을 확인하지 않아도 편안한 편)이고, (혼자만의 거리를 두는 게 편한 편|거리를 크게 두지 않아도 괜찮은 편)이에요/.test(
      cpBody
    ),
    cpBody.slice(0, 200)
  );
  check("결과에 상시 안내 링크 노출 (§9.2)", await page.isVisible(".cp-support"));
  check("결과에 서비스 성격 고지 노출 (§9.3)", cpBody.includes("진단하거나 관계의 미래를 예측하지 않습니다"));

  // 규준 표본이 없으므로 백분위·석차 표현을 쓰면 안 된다(§6.2).
  check(
    "백분위·석차 표현 없음 (규준 미확보 — §6.2)",
    !/상위\s*\d+\s*%|백분위|하위\s*\d+\s*%/.test(cpBody),
    cpBody.slice(0, 120)
  );
  check(
    "결과 화면에도 '부부 결과 매칭' 보조 버튼이 있다 (초대 링크 만들기와 별개 경로)",
    await page.isVisible('.cp-invite-secondary[data-nav="couple-pair"]')
  );
  // 유형 설명이 한 줄 요약에 그치지 않고 실제로 풀어써졌는지 본다(D-51). 예전 한 줄
  // 요약은 40자 안팎이었다 — 길이만으로도 "한 줄짜리 요약"과 구분된다.
  check(
    "결과 유형 설명이 한 줄 요약을 넘어서는 길이로 풀어써졌다",
    (await page.$eval(".result-card p", (p) => p.textContent.trim().length)) > 80,
    await page.textContent(".result-card p")
  );

  // 짧은 코드는 예전엔 "배우자 초대 링크 만들기"를 눌러 별도 화면까지 가야 보였다 —
  // 결과 화면에 뜨자마자(클릭 없이) 바로 노출되는지 본다(D-51).
  const resultShortCodeReady = await page
    .waitForFunction(
      () => {
        const el = document.querySelector("#cp-shortcode-inline");
        return el && /^[0-9A-Z]{4}-[0-9A-Z]{4}$/.test(el.textContent.trim());
      },
      { timeout: 8000 }
    )
    .then(() => true)
    .catch(() => false);
  if (resultShortCodeReady) {
    check(
      "결과 화면에 짧은 코드가 클릭 없이 바로 노출된다",
      /^[0-9A-Z]{4}-[0-9A-Z]{4}$/.test((await page.textContent("#cp-shortcode-inline")).trim()),
      await page.textContent("#cp-shortcode-inline")
    );
    check(
      "짧은 코드가 뜬 뒤에도 여전히 결과 화면에 있다 (별도 화면으로 안 넘어감)",
      page.url().endsWith("/test/couple/result"),
      page.url()
    );
  } else {
    check(
      "백엔드가 없을 때는 결과 화면의 코드 노출도 조용히 폴백 문구로 넘어간다",
      (await page.textContent("#cp-shortcode-inline")).includes("발급이 지금 안 돼요")
    );
  }

  // === 배우자 초대 링크 왕복 ===
  await page.click('[data-nav="couple-invite"]');
  check("초대 링크 화면 주소", page.url().endsWith("/test/couple/invite"), page.url());
  const inviteUrl = (await page.textContent("#cp-link")).trim();
  check("초대 링크가 ?p= 코드를 담고 있다", /\/test\/couple\/pair\?p=[0-9a-z]+$/.test(inviteUrl), inviteUrl);

  // 짧은 코드는 functions/api/couple-code/의 KV 발급이 실제로 동작해야 나온다.
  // `serve.py`로 돌리면 API가 없어 폴백 문구("발급이 지금 안 돼요")만 확인할 수 있고,
  // 이 왕복은 `wrangler pages dev`로 돌릴 때만 끝까지 검증된다 — VERIFY_BASE로 가리킨다.
  let shortCodeText = null;
  const shortCodeReady = await page
    .waitForSelector("#cp-code-card-btn:not([disabled])", { timeout: 6000 })
    .then(() => true)
    .catch(() => false);
  if (shortCodeReady) {
    shortCodeText = (await page.textContent("#cp-shortcode")).trim();
    check("짧은 코드가 발급된다 (XXXX-XXXX 형식)", /^[0-9A-Z]{4}-[0-9A-Z]{4}$/.test(shortCodeText), shortCodeText);
    check(
      "코드 카드 저장 버튼이 활성화된다",
      await page.$eval("#cp-code-card-btn", (b) => b.classList.contains("active"))
    );
  } else {
    check(
      "백엔드가 없을 때는 짧은 코드 발급 실패가 조용히 링크 폴백으로 넘어간다",
      (await page.textContent("#cp-shortcode-block")).includes("발급이 지금 안 돼요")
    );
  }

  // 발급 API는 인증이 없는 공개 엔드포인트다. 형식(길이)만 보고 KV에 넣으면, 누구나
  // 유효하지 않은 문자열을 계속 보내 하루 쓰기 한도(1,000회)를 실제 사용자보다 먼저
  // 채울 수 있다 — decodePartner()로 진짜 유효한 코드인지 먼저 확인하고 저장해야 한다.
  // 브라우저 UI로는 이 경로를 못 타서(앱은 항상 유효한 코드만 보낸다) API를 직접 두드린다.
  if (shortCodeReady) {
    const junkRes = await fetch(`${BASE}/api/couple-code`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ p: "x".repeat(25) }),
    });
    check(
      "짧은 코드 발급 API가 유효하지 않은 부부 코드는 거절한다 (KV 쓰기 한도 남용 방지)",
      junkRes.status === 400,
      `status=${junkRes.status}`
    );
  }

  // 결과 화면의 "부부 결과 매칭" 버튼 — 이미 내 결과가 나와 있는 상태에서 배우자 코드를
  // 직접 입력하면, 상황 고르기로 다시 보내지 않고 곧장 결합 결과로 가야 한다(coupleReady()가
  // 참일 때의 분기). 자기 자신의 코드로 매칭해서 라우팅만 확인한다 — 결과 값의 의미가
  // 아니라 "이미 완료한 사람은 문항을 또 안 풀어도 된다"가 관심사다. 뒤로가기는 SPA
  // 내비게이션(data-nav)으로 돌아가 state.couple을 유지한다 — goto()면 새 세션이 된다.
  await page.click('[data-nav="couple-result"]');
  await page.waitForSelector(".cp-invite-secondary");
  await page.click(".cp-invite-secondary");
  check("결과 화면 매칭 버튼 → 코드 입력 화면", page.url().endsWith("/test/couple/pair"), page.url());

  // 코드 입력 화면의 뒤로가기는 예전엔 항상 "home"에 고정돼 있었다 — 이미 결과가 있는
  // 사람이 배우자 코드를 입력하러 왔다가 코드를 넣지 않고 뒤로 가면, 자기 결과 화면이
  // 아니라 홈으로 튕겨서 결과를 다시 찾아가야 했다(D-51).
  check(
    "코드 입력 화면의 뒤로가기가 내 결과로 향한다 (홈으로 고정되지 않음)",
    (await page.$eval(".back-btn", (b) => b.dataset.nav)) === "couple-result"
  );
  await page.click(".back-btn");
  check("뒤로가기 클릭 → 실제로 내 결과 화면으로 돌아간다", page.url().endsWith("/test/couple/result"), page.url());

  // 원래 시나리오(자기 코드로 매칭)를 이어간다.
  await page.click(".cp-invite-secondary");
  check("결과 화면 매칭 버튼 → 코드 입력 화면 (재진입)", page.url().endsWith("/test/couple/pair"), page.url());
  await page.fill("#cp-code-input", inviteUrl);
  await page.click("#cp-code-submit");
  await page.waitForFunction(() => !location.pathname.endsWith("/pair"), { timeout: 5000 });
  check(
    "이미 내 결과가 있으면 매칭 즉시 결합 결과로 (상황 고르기를 다시 시키지 않음)",
    new URL(page.url()).pathname === "/test/couple/together",
    page.url()
  );

  // 링크를 새 세션(state가 빈 상태)에서 열면 "배우자가 먼저 마쳤다" 화면이 떠야 한다.
  const partnerPath = inviteUrl.slice(inviteUrl.indexOf("/test/couple/pair"));
  await goto(partnerPath);
  check("초대 링크 직접 접속 → 배우자 초대 화면 (홈 폴백 아님)", await page.isVisible(".cover"), page.url());
  check("초대 화면이 배우자 유형을 보여줌", (await page.textContent(".cover")).includes("형"), page.url());
  check("초대 화면 주소에 코드가 남아 있음", page.url().includes("?p="), page.url());

  // 깨진 코드는 인트로로 떨어져야 한다 — 카카오톡에서 링크 끝이 잘려 붙는 경우가 있다.
  // (라우터는 화면을 바꿔도 location.search를 그대로 붙이므로 경로만 본다.)
  // 예전엔 여기서 인트로로 돌려보냈다. 지금은 "부부 결과 매칭" 버튼으로 같은 화면에
  // 직접 들어올 수 있는 경로가 생겨서, 깨진 코드도 인트로로 튕기는 대신 같은 화면에서
  // 직접 입력할 기회를 준다 — 배우자가 보낸 링크가 잘렸어도 코드만 따로 받아 넣을 수 있다.
  await goto(partnerPath.slice(0, -1));
  check(
    "코드가 잘린 초대 링크 → 직접 입력 폼으로 대체(인트로로 튕기지 않음)",
    new URL(page.url()).pathname === "/test/couple/pair" && (await page.isVisible("#cp-code-input")),
    page.url()
  );

  // 잘못된 값을 넣으면 화면에 머물며 에러만 보여줘야 한다 — 조용히 아무 일도 안 하거나
  // 엉뚱한 화면으로 튀면 사용자가 뭐가 잘못됐는지 알 수 없다.
  // (직전 검사에서 잘린 코드가 ?p=로 붙어 있는 채라, 경로만 비교한다 — 라우터가
  // go()로 화면을 바꿔도 location.search를 그대로 들고 다닌다.)
  await page.fill("#cp-code-input", "이건-말이안되는값");
  await page.click("#cp-code-submit");
  await page.waitForSelector("#cp-code-error:not([hidden])", { timeout: 5000 });
  check(
    "직접 입력 폼: 잘못된 코드는 에러를 보여주고 같은 화면에 머문다",
    new URL(page.url()).pathname === "/test/couple/pair" && (await page.isVisible("#cp-code-error")),
    page.url()
  );

  // 링크를 통째로 붙여넣어도(짧은 코드가 아니라) 코드가 추출돼 처리돼야 한다 —
  // 카카오톡에서 사람들이 실제로 링크째 복사해 붙이는 경우가 이 경로다.
  await page.fill("#cp-code-input", inviteUrl);
  await page.click("#cp-code-submit");
  await page.waitForFunction(() => !location.pathname.endsWith("/pair"), { timeout: 5000 });
  check(
    "직접 입력 폼: 링크를 통째로 붙여넣어도 코드가 추출된다",
    new URL(page.url()).pathname === "/test/couple/setup",
    page.url()
  );

  // 짧은 코드도 같은 폼에서 받아야 한다 — 인트로의 "부부 결과 매칭" 버튼으로 들어온
  // 완전히 새 세션에서, 링크가 아니라 8자 코드만으로 매칭이 되는지 확인한다.
  if (shortCodeReady) {
    await goto("/test/couple");
    await page.click('[data-nav="couple-pair"]');
    check("인트로의 매칭 버튼 → 코드 입력 화면", page.url().endsWith("/test/couple/pair"), page.url());
    await page.fill("#cp-code-input", shortCodeText);
    await page.click("#cp-code-submit");
    await page.waitForFunction(() => !location.pathname.endsWith("/pair"), { timeout: 5000 });
    check(
      "짧은 코드만 입력해도 매칭된다 (아직 내 결과가 없으니 상황 고르기로)",
      new URL(page.url()).pathname === "/test/couple/setup",
      page.url()
    );
  }

  // === 초대받은 쪽이 답을 마치면 결합 리포트까지 도달하는가 ===
  // 초대 링크의 목적이 "합쳐 보기"이므로, 문항을 마친 뒤 개인 결과에서 멈추면 안 된다.
  await goto(partnerPath);
  await page.click("#cp-pair-start");
  await page.click('.cp-axis-btn[data-code="T-W"]');
  await page.click('.cp-axis-btn[data-code="R-C"]');
  await page.click('.cp-axis-btn[data-code="K-1"]'); // 배우자와 같은 자녀 단계
  await page.click("#cp-setup-next");
  await page.waitForSelector(".cp-likert-btn");
  anchorPick = 1; // 초대받은 쪽은 앵커에 "전혀 아니다" → 인지 격차가 반드시 생긴다
  for (let i = 0; i < coupleTotal; i++) await answerCouple(coupleTotal - i);
  await page.waitForSelector("#ad-gate-continue", { timeout: 5000 });
  await page.waitForFunction(() => !document.querySelector("#ad-gate-continue").disabled, { timeout: 6000 });
  await page.click("#ad-gate-continue");
  await page.waitForSelector(".result-card", { timeout: 5000 });
  check(
    "초대받은 쪽은 문항 완료 후 개인 결과가 아니라 결합 결과로 간다",
    page.url().includes("/test/couple/together"),
    page.url()
  );

  const reportBody = (await page.textContent("#app")).replace(/\s+/g, " ");
  check("결합 결과에 두 유형 조합 이름이 나온다", (await page.textContent(".cp-pair-name")).includes("×"));
  check("성향 조합 해석이 나온다 (§7.2)", reportBody.includes("두 분의 성향은"));
  // 애착 조합 해석(attachTag)이 한 줄 요약을 넘어서는지 본다(D-51).
  check(
    "성향 조합 헤드라인 설명이 한 줄 요약을 넘어서는 길이로 풀어써졌다",
    (await page.$eval(".result-card p", (p) => p.textContent.trim().length)) > 80,
    await page.textContent(".result-card p")
  );
  // 예전엔 "많이 다른(contrast)" 축에만 설명을 붙이고, 닮았거나(similar) 보완하는(complement)
  // 축은 칩 라벨만 보여줬다 — 칩에 등장하는 구간 수만큼 설명 문장이 있는지로 확인한다
  // (구간이 3개(닮음/보완/대비) 다 나오면 설명도 3줄, 2개만 나오면 2줄이어야 한다).
  const dynamicsNoteCount = await page.$$eval(".cp-profile", (blocks) => {
    const b = blocks.find((el) => el.querySelector(".cp-block-title")?.textContent.trim() === "두 분의 성향은");
    return b ? b.querySelectorAll(".cp-note").length : -1;
  });
  const dynamicsLevelCount = await page.$$eval(".cp-chip-row .cp-chip", (chips) =>
    new Set(chips.map((c) => [...c.classList].find((cl) => cl.startsWith("cp-chip-")))).size
  );
  check(
    "성향 조합 설명이 축마다(닮음·보완·대비 구간별로) 붙는다 — 대비되는 축에만 몰아주지 않음",
    dynamicsNoteCount === dynamicsLevelCount && dynamicsNoteCount >= 1,
    `note=${dynamicsNoteCount} distinctLevels=${dynamicsLevelCount}`
  );
  check("앵커 기반 체감 비교가 나온다 (§7.3)", reportBody.includes("같은 질문, 서로의 대답"));
  check("환경축 비교가 나온다 (§7.4)", reportBody.includes("역할과 자녀 이야기"));
  // "격차가 큰 항목에는 반드시 대화 스크립트를 함께 붙인다"(§6.5.3)를 구조로 확인한다.
  // 스크립트가 화면 어딘가에 1개 있는지만 보면, 정작 격차 항목에 안 붙어도 통과한다.
  const gapRowsMissingScript = await page.$$eval(".cp-gap-row", (rows) =>
    rows
      .filter((r) => {
        const level = r.querySelector(".cp-bar-head b");
        return level && level.textContent.trim() !== "비슷함";
      })
      .filter((r) => !r.querySelector(".cp-script"))
      .map((r) => r.querySelector(".cp-bar-head span").textContent.trim())
  );
  check(
    "격차가 있는 항목에는 빠짐없이 대화 스타터가 붙는다 (§6.5.3)",
    gapRowsMissingScript.length === 0,
    gapRowsMissingScript.join(", ")
  );
  check("결합 결과에 상시 안내 링크 노출 (§9.2)", await page.isVisible(".cp-support"));

  // 단일 궁합 점수·등급명을 만들지 않는다(§7.2). 점수를 되살리는 변경은 여기서 걸린다.
  check(
    "궁합 점수·등급명 노출 없음 (§7.2)",
    !/궁합|매칭\s*점수|\d+\s*점\s*(만점|궁합)|매우 안정|성장 필요|상담 권유/.test(reportBody),
    reportBody.slice(0, 140)
  );
  // 격차의 크기와 개념명만 내보내고, 누가 어느 쪽이었는지(방향)는 내보내지 않는다(§7.3).
  check(
    "격차 방향·지목 표현 없음 (§6.5.3·§7.3)",
    !/(아내|남편)\s*쪽이|(아내|남편)분이\s|라고 답했습니다|더 크게 느끼고/.test(reportBody),
    reportBody.slice(0, 140)
  );
  // 원 척도의 유형명·축 명칭을 사용자 화면에 노출하지 않는다(§2.1 B등급 · §2.3).
  check(
    "원 척도 유형명·축 명칭 미노출 (§2.3)",
    !/집착형|두려움형|경쟁형|순응형|타협형|애착\s*불안|애착\s*회피/.test(reportBody),
    reportBody.slice(0, 140)
  );

  // === §7.6 자녀 단계 불일치는 결합 리포트를 만들지 않는다 ===
  // 자녀 단계는 객관적 사실이라 갈릴 수 없다. 갈리면 K문항의 문장 자체가 달라져
  // 비교 근거가 사라진다.
  await goto(partnerPath);
  await page.click("#cp-pair-start");
  await page.click('.cp-axis-btn[data-code="T-W"]');
  await page.click('.cp-axis-btn[data-code="R-C"]');
  await page.click('.cp-axis-btn[data-code="K-2"]'); // 배우자는 K-1을 골랐다
  await page.click("#cp-setup-next");
  for (let i = 0; i < coupleTotal; i++) await answerCouple(coupleTotal - i);
  await page.waitForFunction(() => !document.querySelector("#ad-gate-continue").disabled, { timeout: 6000 });
  await page.click("#ad-gate-continue");
  await page.waitForSelector(".empty-state, .result-card", { timeout: 5000 });
  const mismatchBody = (await page.textContent("#app")).replace(/\s+/g, " ");
  check(
    "자녀 단계가 다르면 결합 결과를 만들지 않고 다시 확인하도록 안내 (§7.6)",
    mismatchBody.includes("자녀 단계를 다시 확인"),
    mismatchBody.slice(0, 120)
  );

  // === 공유 슬러그 주소 (세 테스트 모두) ===
  // 불변식은 "결과 카드가 뜨고 홈이 아니다" — 화면 문구는 테스트마다 다르므로 문구로 검사하지 않는다.
  for (const [p, expected, label] of [
    ["/test/adhd/result/typhoon", "태풍", "ADHD"],
    ["/test/disc/result/lion", null, "DISC"],
    ["/test/couple/result/anchor", "포근한 동반자형", "부부"],
  ]) {
    await goto(p);
    const shown = await page.isVisible(".result-card");
    const isHome = await page.isVisible(".hero-title");
    const body = shown ? (await page.textContent(".result-card")).replace(/\s+/g, " ").trim() : "";
    check(
      `${label} 공유 URL이 결과를 보여줌 (홈 폴백 아님)`,
      shown && !isHome && body.length > 20 && (!expected || body.includes(expected)),
      `${p} → ${body.slice(0, 60)}`
    );
  }

  // 없는 슬러그는 홈으로 폴백 (guard)
  await goto("/test/disc/result/nonexistent-slug");
  check("없는 슬러그 → 홈 폴백", await page.isVisible(".hero-title"), page.url());

  // === guard: 선행 상태 없이 결과·게임 주소 직접 접속 ===
  // 반응속도 게임은 이제 문항을 다 풀어야만 들어갈 수 있는 필수 단계라(reaction-result
  // 화면 자체가 사라졌다), reaction-intro·reaction-play 둘 다 답이 없으면 test-intro로
  // 떨어진다 — docs/DECISIONS.md D-18.
  for (const [p, sel, label] of [
    ["/test/adhd/result", ".cover", "ADHD 결과"],
    ["/test/disc/result", ".cover", "DISC 결과"],
    ["/test/disc/dilemma", ".cover", "딜레마"],
    ["/test/adhd/reaction", ".cover", "반응속도 게임 (문항 미완료)"],
    ["/test/adhd/reaction/play", ".cover", "반응속도 게임 플레이 (문항 미완료)"],
    ["/test/adhd/reaction/ad", ".cover", "광고 게이트 (게임 미완료, ADHD)"],
    ["/test/disc/dilemma/ad", ".cover", "광고 게이트 (게임 미완료, DISC)"],
    ["/test/couple/play", ".cover", "부부 체크 문항 (축 미선택)"],
    ["/test/couple/result", ".cover", "부부 체크 결과 (문항 미완료)"],
    ["/test/couple/invite", ".cover", "부부 체크 초대 (문항 미완료)"],
    ["/test/couple/ad", ".cover", "부부 체크 광고 게이트 (문항 미완료)"],
    ["/test/couple/together", ".cover", "부부 체크 결합 결과 (코드·응답 없음)"],
    ["/game/numpath/play", ".cover", "NumPath 플레이 (런 없음)"],
    ["/game/numpath/ad", ".cover", "NumPath 광고 게이트 (런 없음)"],
    ["/game/numpath/result", ".cover", "NumPath 결과 (런 없음)"],
  ]) {
    await goto(p);
    check(`${label} 주소 직접 접속 → 인트로 폴백`, await page.isVisible(sel), page.url());
  }

  // /test/couple/pair는 위 표의 다른 화면들과 다르다 — 코드가 없다고 인트로로
  // 튕기지 않고, 이 화면 자체가 직접 입력 폼을 보여준다(부부 결과 매칭 진입점).
  await goto("/test/couple/pair");
  check(
    "부부 체크 페어링 (코드 없음) 주소 직접 접속 → 자체 입력 폼 렌더 (인트로 폴백 아님)",
    await page.isVisible(".cover") && await page.isVisible("#cp-code-input"),
    page.url()
  );

  // 넘버 마을은 런과 무관한 영속 진행이라 guard가 없다 — 직접 접속해도 마을이 그대로 떠야 한다.
  await goto("/game/numpath/village");
  check("넘버 마을 주소 직접 접속 → 폴백 없이 마을 표시", await page.isVisible(".np-shop"), page.url());

  // === OG 셸: 특정 경로만 og-shells/*.html로 rewrite되고, 그 안에서도 SPA가 그대로 뜨는가 ===
  // _redirects가 /test/adhd·/test/disc·/game/numpath 세 경로만 og-shells/*.html로 rewrite한다
  // (docs/DECISIONS.md 참고). 크롤러는 이 정적 셸의 <head>만 보고, 실제 방문자는 같은 셸이
  // 로드한 js/main.js가 정상적으로 SPA를 이어서 그려야 한다 — 둘 다 확인한다.
  for (const [p, expectedTitle, coverSel] of [
    ["/test/adhd", "성인 ADHD 성향 체크 | 과몰입구역", ".cover"],
    ["/test/disc", "직장인 유형검사 | 과몰입구역", ".cover"],
    ["/game/numpath", "NumPath: Stack & Clear | 과몰입구역", ".cover"],
  ]) {
    await goto(p);
    const title = await page.title();
    const ogTitle = await page
      .$eval('meta[property="og:title"]', (el) => el.content)
      .catch(() => null);
    check(`OG 셸 <title> — ${p}`, title === expectedTitle, title);
    check(`OG 셸 og:title — ${p}`, ogTitle === expectedTitle, ogTitle);
    check(`OG 셸 진입 후에도 SPA가 정상 렌더됨 — ${p}`, await page.isVisible(coverSel), page.url());
  }
  // 셸이 없는 주소는 여전히 전역 index.html의 공통 OG를 써야 한다 — rewrite 규칙이
  // 의도한 3개보다 넓게 매치되고 있진 않은지 확인. document.title은 router.js의
  // render()가 화면마다 다시 쓰므로(공유 결과 화면은 원래 "친구의 ... | 과몰입구역") 여기선
  // 못 쓴다 — og:title 메타는 client JS가 안 건드리므로 최초 응답 그대로 남는다.
  await goto("/test/adhd/result/typhoon");
  const fallbackOgTitle = await page.$eval('meta[property="og:title"]', (el) => el.content);
  check(
    "OG 셸 없는 경로는 전역 index.html의 og:title을 그대로 씀",
    fallbackOgTitle === "과몰입구역 - 심리테스트 · 미니게임",
    fallbackOgTitle
  );

  // === 뒤로가기 정합성 ===
  await goto("/");
  await page.click('[data-nav="psych-list"]');
  await page.click('[data-nav="test-intro"]');
  await page.goBack();
  check("뒤로가기 → 목록 화면", await page.isVisible(".test-card"), page.url());

  // === 테마 클래스가 화면을 떠날 때 정리되는가 ===
  await goto("/test/disc");
  const discTheme = await page.getAttribute("body", "class");
  await page.click('[data-nav="psych-list"]');
  const listTheme = (await page.getAttribute("body", "class")) || "";
  check(
    "테마 클래스가 화면 전환 시 제거됨",
    /theme-disc/.test(discTheme || "") && !/theme-/.test(listTheme),
    `disc="${discTheme}" list="${listTheme}"`
  );

  // (게임 타이머 정리(onLeave) 확인은 ADHD 섹션에서 "다시하기"로 이미 검사했다 —
  // reaction-intro/reaction-play가 문항 미완료 시 test-intro로 떨어지는 guard가 생겨서
  // 답 없이 곧장 게임 주소로 들어가는 방식으로는 더 이상 게임 화면 자체를 확인할 수 없다.)

  // === 모바일 레이아웃 ===
  await goto("/");
  check("장식뿐이던 하단 네비게이션 제거됨", !(await page.$(".bottom-nav")));
  check("목업 잔재(가짜 상태바) 없음", !(await page.content()).includes("9:41"));

  // === 개인정보처리방침 (부부 체크 짧은 코드 도입으로 "영속 데이터 없음"이 깨진 뒤 추가) ===
  await goto("/");
  await page.click('[data-nav="privacy"]');
  check("홈 하단 링크 → 개인정보처리방침", page.url().endsWith("/privacy"), page.url());
  const privacyBody = (await page.textContent("#app")).replace(/\s+/g, " ");
  check(
    "개인정보처리방침에 부부 체크 코드의 보유기간(7일)이 명시됨",
    privacyBody.includes("7일이 지나면 자동으로 삭제"),
    privacyBody.slice(0, 120)
  );
  check("개인정보처리방침에 문의처가 있다", privacyBody.includes("@"));
  await page.click('[data-nav="home"]');
  check("개인정보처리방침 뒤로가기 → 홈", page.url().endsWith("/") || new URL(page.url()).pathname === "/", page.url());

  // /api/couple-code 관련 콘솔 에러는 두 갈래로 나온다: ① 백엔드가 아예 없는 로컬 개발
  // (serve.py) — 위에서 shortCodeReady가 false로 이미 감지됐고, 그건 기대된 동작이라
  // 별도로 확인했다(브라우저 자체가 찍는 "Failed to load resource: ... 501"과 remote.js가
  // 찍는 "짧은 코드 발급 실패" 둘 다 이 경우에 나온다). ② 백엔드가 있는데도 실패 —
  // 이건 진짜 버그라 걸러내면 안 된다. 그래서 무조건 지우지 않고, ①로 확인됐을 때만
  // 이 경로의 메시지를 콘솔 에러 집계에서 뺀다.
  const filteredErrors = shortCodeReady
    ? errors
    : errors.filter((e) => !e.includes("/api/couple-code") && !e.includes("couple/remote.js"));
  check("콘솔/페이지 에러 없음", filteredErrors.length === 0, filteredErrors.join(" ; "));

  await browser.close();

  console.log("PASS (" + ok.length + ")\n  " + ok.join("\n  "));
  if (fails.length) {
    console.log("\nFAIL (" + fails.length + ")\n  " + fails.join("\n  "));
    process.exit(1);
  }
  console.log("\n모두 통과");
})();
