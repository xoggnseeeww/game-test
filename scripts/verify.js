/**
 * 회귀 스위트 — 헤드리스 브라우저로 실제 흐름을 재현한다.
 *
 * 이 프로젝트에는 빌드도 타입 체크도 없다. 정적 검사로는 이벤트 바인딩·라우팅·타이머·
 * 레이아웃을 하나도 잡을 수 없으므로(docs/ERRORS.md A-1), 변경 후에는 이 스크립트를 돌린다.
 *
 * 실행:
 *   1) 터미널 A: python3 serve.py 8766      ← _redirects와 같은 SPA 폴백이 필요하다
 *                (python3 -m http.server 는 안 된다 — docs/ERRORS.md E-9)
 *   2) 터미널 B: mkdir -p /tmp/pw && cd /tmp/pw && npm i playwright
 *                NODE_PATH=/tmp/pw/node_modules node <레포>/scripts/verify.js
 *      ※ node는 스크립트 위치 기준으로 모듈을 찾으므로 NODE_PATH가 필요하다.
 *
 * playwright는 의도적으로 레포 의존성이 아니다(docs/DECISIONS.md D-9 — 의존성 0 유지).
 * 검증 도구는 레포 밖에 설치하고, 이 파일은 "무엇을 확인해야 하는가"의 기록으로 남긴다.
 *
 * 새 화면·새 채점 규칙을 추가하면 여기에 케이스를 추가한다.
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

  // --- 개수 하드코딩 (docs/ERRORS.md E-1) ---
  await page.goto(BASE + "/", { waitUntil: "networkidle" });
  await page.click('[data-nav="psych-list"]');
  const desc = (await page.textContent(".test-card .desc")).trim();
  await page.click('[data-nav="test-intro"]');
  const chips = await page.$$eval(".meta-chip .value", (n) => n.map((e) => e.textContent));
  const listCount = (desc.match(/\d+문항/) || [])[0];
  check("목록/인트로 문항 수 일치", listCount === chips[0], `list=${listCount} intro=${chips[0]}`);
  check("결과 유형 수 표기", /^\d+가지$/.test(chips[1]), `intro=${chips[1]}`);

  // --- 라우팅 (docs/ERRORS.md E-2) ---
  check("내부 이동 시 주소 반영", page.url().endsWith("/test/adhd"), page.url());

  // --- 채점 회귀 세트 (docs/ERRORS.md E-8) ---
  // 전부 "매우 그렇다"(4점) → 축당 역채점 1문항이 0점이 되어 (4+4+4+0)/16 = 75%
  // 75 >= AXIS_HIGH_THRESHOLD(60) 이므로 3축 모두 high → "111" 태풍형
  await page.click(".cta-btn");
  await page.click(".modal-btn-primary").catch(() => {});
  const total = parseInt(chips[0], 10);
  for (let i = 0; i < total; i++) {
    await page.waitForSelector(".option-btn");
    await page.click(".options .option-btn:nth-child(1)");
  }
  await page.waitForSelector(".result-card", { timeout: 5000 });
  const pcts = await page.$$eval(".axis-row", (rows) =>
    rows.map((r) => r.textContent.replace(/\s+/g, " ").trim())
  );
  check("전부 최고점 → 3축 75% (역채점 반영)", pcts.every((t) => /75%/.test(t)), pcts.join(" | "));
  check("전부 최고점 → 111 태풍형", /태풍/.test(await page.textContent(".result-card")));
  check("결과 화면 주소", page.url().includes("/test/adhd/result"), page.url());

  // --- 공유 슬러그 URL (docs/ERRORS.md E-3) ---
  await page.goto(BASE + "/test/adhd/result/typhoon", { waitUntil: "networkidle" });
  const eyebrow = (await page.textContent(".eyebrow").catch(() => "")) || "";
  check("공유 URL이 친구 결과를 보여줌", /친구/.test(eyebrow), `eyebrow="${eyebrow.trim()}"`);

  // --- 뒤로가기 정합성 (docs/ERRORS.md E-2) ---
  await page.goto(BASE + "/", { waitUntil: "networkidle" });
  await page.click('[data-nav="psych-list"]');
  await page.click('[data-nav="test-intro"]');
  await page.goBack();
  check("뒤로가기 → 목록 화면", await page.isVisible(".test-card"), page.url());

  // 답변 없이 결과 경로 직접 접속 → resolveScreen() 폴백
  await page.goto(BASE + "/test/adhd/result", { waitUntil: "networkidle" });
  check("답변 없이 결과 접속 → 인트로 폴백", await page.isVisible(".cover"), page.url());

  // --- 모바일 레이아웃 (docs/ERRORS.md E-7) ---
  await page.goto(BASE + "/", { waitUntil: "networkidle" });
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
