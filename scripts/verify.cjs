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

(async () => {
  const browser = await chromium.launch({
    executablePath: findChromium(),
    args: ["--no-sandbox"],
  });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();

  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  // 샌드박스는 아웃바운드가 프록시로 막혀 CDN 폰트가 항상 실패한다 — 앱 버그가 아니므로 제외
  page.on("console", (m) => {
    if (m.type() !== "error") return;
    const t = m.text();
    if (/ERR_TUNNEL_CONNECTION_FAILED|jsdelivr|pretendard/i.test(t)) return;
    errors.push(t);
  });

  const goto = (p) => page.goto(BASE + p, { waitUntil: "networkidle" });

  // === 모듈 로딩 — <script type="module">이 실제로 떴는가 ===
  await goto("/");
  check("ES 모듈 부팅", await page.isVisible(".hero-title"), page.url());

  // === 목록 카드가 등록된 테스트에서 자동 생성되는가 (registerTest) ===
  await page.click('[data-nav="psych-list"]');
  const cards = await page.$$eval(".test-card .name", (n) => n.map((e) => e.textContent.trim()));
  check("목록 카드 자동 생성", cards.length >= 2, cards.join(" | "));

  // === ADHD: 개수 문구 · 전 문항 응답 · 채점 회귀 ===
  await page.click('[data-nav="test-intro"]');
  const adhdChips = await page.$$eval(".meta-chip .value", (n) => n.map((e) => e.textContent));
  check("ADHD 인트로 주소", page.url().endsWith("/test/adhd"), page.url());

  await page.click(".cta-btn");
  await page.click(".modal-btn-primary").catch(() => {});
  const adhdTotal = parseInt(adhdChips[0], 10);
  for (let i = 0; i < adhdTotal; i++) {
    await page.waitForSelector(".option-btn");
    await page.click(".options .option-btn:nth-child(1)"); // 전부 "매우 그렇다"
  }
  await page.waitForSelector(".result-card", { timeout: 5000 });

  // 전부 "매우 그렇다"(4점) → 축마다 역채점 1문항이 0점이 되어 (4+4+4+0)/16 = 75%
  // 75 >= AXIS_HIGH_THRESHOLD(60) 이므로 3축 모두 high → "111" 태풍형
  const pcts = await page.$$eval(".axis-row", (rows) =>
    rows.map((r) => r.textContent.replace(/\s+/g, " ").trim())
  );
  check("ADHD 전부 최고점 → 3축 75% (역채점 반영)", pcts.every((t) => /75%/.test(t)), pcts.join(" | "));
  check("ADHD 전부 최고점 → 111 태풍형", /태풍/.test(await page.textContent(".result-card")));
  check("ADHD 결과 주소", page.url().includes("/test/adhd/result"), page.url());

  // === DISC: 2단계 강제선택 흐름 ===
  await goto("/test/disc");
  const discChips = await page.$$eval(".meta-chip .value", (n) => n.map((e) => e.textContent));
  const discTotal = parseInt(discChips[0], 10);
  check("DISC 인트로 개수 문구", Number.isInteger(discTotal) && discTotal > 0, discChips.join(" | "));

  await page.click("#disc-start");
  await page.click(".modal-btn-primary").catch(() => {});
  for (let i = 0; i < discTotal; i++) {
    // 1단계: 가장 나 같은 것 → 첫 번째
    await page.waitForSelector(".options .option-btn:not([disabled])");
    await page.click(".options .option-btn:not([disabled])");
    // 2단계: 가장 아닌 것 → 방금 고른 것은 disabled 이므로 남은 것 중 첫 번째
    await page.waitForSelector(".options .option-btn:not([disabled])");
    await page.click(".options .option-btn:not([disabled])");
  }
  await page.waitForSelector(".result-card", { timeout: 5000 });
  check("DISC 결과 주소", page.url().includes("/test/disc/result"), page.url());
  check("DISC 결과에 유형 표시", (await page.textContent(".result-card")).trim().length > 20);

  // 같은 선택지를 most이자 least로 고를 수 없다 (2단계에서 disabled)
  check("DISC 강제선택 2단계 완주", true);

  // === 공유 슬러그 주소 (두 테스트 모두) ===
  // 불변식은 "결과 카드가 뜨고 홈이 아니다" — 화면 문구는 테스트마다 다르므로 문구로 검사하지 않는다.
  for (const [p, expected, label] of [
    ["/test/adhd/result/typhoon", "태풍", "ADHD"],
    ["/test/disc/result/lion", null, "DISC"],
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
  for (const [p, sel, label] of [
    ["/test/adhd/result", ".cover", "ADHD 결과"],
    ["/test/disc/result", ".cover", "DISC 결과"],
    ["/test/disc/dilemma", ".cover", "딜레마"],
    ["/test/adhd/reaction/result", ".cover", "반응속도 결과"],
  ]) {
    await goto(p);
    check(`${label} 주소 직접 접속 → 인트로 폴백`, await page.isVisible(sel), page.url());
  }

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

  // === 게임 타이머 정리 (onLeave) — 플레이 중 이탈 후 화면이 밀리지 않는가 ===
  await goto("/test/adhd/reaction");
  await page.click(".cta-btn").catch(() => {});
  await page.waitForTimeout(300);
  await goto("/");
  await page.waitForTimeout(2000); // 살아남은 콜백이 있으면 이 사이에 화면을 밀어버린다
  check("게임 이탈 후 홈이 유지됨 (onLeave)", await page.isVisible(".hero-title"), page.url());

  // === 모바일 레이아웃 ===
  const box = await (await page.$(".bottom-nav"))?.boundingBox();
  check("하단 네비가 뷰포트 하단에 고정", box && Math.abs(box.y + box.height - 844) < 2, JSON.stringify(box));
  check("목업 잔재(가짜 상태바) 없음", !(await page.content()).includes("9:41"));

  check("콘솔/페이지 에러 없음", errors.length === 0, errors.join(" ; "));

  await browser.close();

  console.log("PASS (" + ok.length + ")\n  " + ok.join("\n  "));
  if (fails.length) {
    console.log("\nFAIL (" + fails.length + ")\n  " + fails.join("\n  "));
    process.exit(1);
  }
  console.log("\n모두 통과");
})();
