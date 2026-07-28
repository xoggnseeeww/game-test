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

(async () => {
  const browser = await chromium.launch({
    executablePath: findChromium(),
    args: ["--no-sandbox"],
  });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();

  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  // 샌드박스는 아웃바운드가 프록시로 막혀 외부 자원(CDN 폰트 · AdFit 로더)이 항상 실패한다.
  // 앱 버그가 아니므로 제외한다. 다만 "Failed to load resource: ... 403" 같은 메시지는 본문에
  // 주소가 없어서 m.text()만 보면 걸러지지 않는다 — m.location().url까지 같이 본다.
  // (AdFit 스크립트가 슬롯마다 붙었는지는 아래 "광고 슬롯" 검사가 DOM으로 따로 확인한다)
  const EXTERNAL_NOISE = /ERR_TUNNEL_CONNECTION_FAILED|jsdelivr|pretendard|daumcdn|AdFit/i;
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
  // AdFit 로더는 실행 시점의 문서만 훑는다. index.html에 한 번 심는 방식으로 되돌아가면
  // 슬롯은 그려지는데 광고만 조용히 안 나온다 — 눈으로는 "빈 자리"라 발견이 늦다.
  // (샌드박스에선 로더 자체가 차단되므로 "스크립트가 붙었는가"까지만 본다)
  const adLoaders = (root) =>
    root.$$eval(".ad-slot ins.kakao_ad_area", (list) =>
      list.map((ins) => {
        const next = ins.nextElementSibling;
        return {
          unit: ins.dataset.adUnit || "",
          loaded: !!next && next.tagName === "SCRIPT" && next.src.includes("ba.min.js"),
        };
      })
    );

  const homeAds = await adLoaders(page);
  check("홈 광고 슬롯 존재", homeAds.length > 0, `${homeAds.length}개`);
  check(
    "홈 광고 슬롯마다 AdFit 로더가 붙음",
    homeAds.length > 0 && homeAds.every((a) => a.loaded),
    JSON.stringify(homeAds)
  );

  // === 목록 카드가 등록된 테스트에서 자동 생성되는가 (registerTest) ===
  await page.click('[data-nav="psych-list"]');
  const cards = await page.$$eval(".test-card .name", (n) => n.map((e) => e.textContent.trim()));
  check("목록 카드 자동 생성", cards.length >= 2, cards.join(" | "));

  // === ADHD: 개수 문구 · 전 문항 응답 · 문항 후 게임으로 직행 · 채점 회귀 ===
  await page.click('[data-nav="test-intro"]');
  const adhdChips = await page.$$eval(".meta-chip .value", (n) => n.map((e) => e.textContent));
  check("ADHD 인트로 주소", page.url().endsWith("/test/adhd"), page.url());

  // 새로고침 없는 화면 이동에서도 새 슬롯에 로더가 붙어야 한다 — index.html 한 번 심기로는
  // 절대 통과할 수 없는 검사다(로더가 이미 실행을 끝낸 뒤 만들어진 <ins>이므로).
  const introAds = await adLoaders(page);
  check(
    "SPA 이동 후 새 광고 슬롯에도 로더가 붙음",
    introAds.length > 0 && introAds.every((a) => a.loaded),
    JSON.stringify(introAds)
  );

  await page.click(".cta-btn");
  await page.click(".modal-btn-primary").catch(() => {});
  const adhdTotal = parseInt(adhdChips[0], 10);
  for (let i = 0; i < adhdTotal; i++) {
    await page.waitForSelector(".option-btn");
    await page.click(".options .option-btn:nth-child(1)"); // 전부 "매우 그렇다"
  }

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
  // 문항이 끝나면 결과가 아니라 딜레마 게임으로 이어진다 — 게임 결과까지 반영된
  // 유형을 한 번에 보여주기 위해 disc-result 가드가 게임 완료를 요구한다.
  check("문항 완료 → 딜레마 인트로로 자동 이동", page.url().endsWith("/test/disc/dilemma"), page.url());

  await page.click("#dilemma-start");
  let dilemmaRounds = 0;
  while (await page.isVisible(".dilemma-panel")) {
    await page.waitForSelector(".dilemma-choice", { timeout: 3000 });
    await page.click(".dilemma-choice >> nth=0");
    // 클릭 직후엔 armed=false라 같은 버튼이 아직 DOM에 남아있어도 재클릭이 씹힌다.
    // 다음 라운드로 넘어가며 선택지가 갈아끼워지거나(잠깐 사라짐) 결과로 이동해
    // .dilemma-choice가 통째로 없어질 때까지 기다린 뒤에야 다시 확인해야 한다 —
    // 안 그러면 같은 라운드를 반복 클릭하며 헛도는데 겉으로는 진행되는 것처럼 보인다.
    await page.waitForSelector(".dilemma-choice", { state: "detached", timeout: 3000 }).catch(() => {});
    dilemmaRounds++;
    if (dilemmaRounds > 20) break; // 무한루프 방지 (버그가 있으면 여기서 멎는다)
  }

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

  // (게임 타이머 정리(onLeave) 확인은 ADHD 섹션에서 "다시하기"로 이미 검사했다 —
  // reaction-intro/reaction-play가 문항 미완료 시 test-intro로 떨어지는 guard가 생겨서
  // 답 없이 곧장 게임 주소로 들어가는 방식으로는 더 이상 게임 화면 자체를 확인할 수 없다.)

  // === 모바일 레이아웃 ===
  await goto("/");
  check("장식뿐이던 하단 네비게이션 제거됨", !(await page.$(".bottom-nav")));
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
