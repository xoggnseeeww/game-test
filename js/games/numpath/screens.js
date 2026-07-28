// NumPath의 게임 화면이 아닌 나머지 화면(인트로 · 광고 게이트 · 결과). 플레이 화면은
// in-place 렌더가 필요해서 play.js로 따로 뗐다(D-9 재검토 조건 — 모듈 하나가 커지기 전에 미리 나눔).
import { app, go } from "../../core/router.js";
import { el, bindNav, bindAdGate, showModal } from "../../core/dom.js";
import { adSlotMarkup, adGateMarkup } from "../../core/ads.js";
import { shareBlockMarkup, wireShare } from "../../core/share.js";
import { roundRect } from "../../core/util.js";
import { state } from "../../core/state.js";
import { STAGES_PER_RUN, MAX_STARS } from "./data.js";

function startRun() {
  state.numpath.run = { seed: Math.floor(Math.random() * 2 ** 31), stageIndex: 0, stars: [] };
  go("numpath-play");
}

export function renderNumpathIntro() {
  app.appendChild(el(`
    <div>
      <div class="back-row">
        <button class="back-btn" data-nav="game-list">‹</button>
        <div class="back-title">미니게임</div>
        <button class="exit-btn" data-nav="home" aria-label="홈으로 가기">🏠</button>
      </div>
      ${adSlotMarkup("banner", "margin-top:10px; margin-bottom:4px;")}
      <div class="cover">
        <div class="emoji">🧮</div>
        <div class="tag">숫자 경로 퍼즐</div>
        <h2>NumPath<br/>Stack &amp; Clear</h2>
        <p>인접한 칸을 밟아 숫자를 계산해서<br/>목표값을 정확히 만들어보세요.<br/>지나온 칸은 사라져서 다시 밟을 수 없어요!</p>
      </div>
      <div class="meta-chips">
        <div class="meta-chip"><div class="value">${STAGES_PER_RUN}스테이지</div><div class="label">한 런</div></div>
        <div class="meta-chip"><div class="value">${"⭐".repeat(MAX_STARS)}</div><div class="label">별 ${MAX_STARS}개 도전</div></div>
      </div>
      <p class="disclaimer">막히거나 이동 횟수를 다 쓰면 Undo나 Reset으로 바로 다시 도전할 수 있어요.</p>
      <div class="cta">
        <button class="cta-btn" id="start-btn">런 시작하기</button>
      </div>
      ${adSlotMarkup("banner", "margin-top:6px; margin-bottom:22px;")}
    </div>
  `));
  bindNav(app);
  app.querySelector("#start-btn").addEventListener("click", () => {
    showModal({
      title: "🧮 시작 전 안내",
      body: "인접한 칸을 탭해서 이동하세요. 지나온 칸은 사라져서\n다시 밟을 수 없어요.\n\n이동한 순서대로 계산이 적용돼요 (예: 5 → +3 → 8).\n\n막히면 Undo나 Reset으로 바로 다시 시작할 수 있어요.",
      confirmLabel: "시작할게요",
      cancelLabel: "취소",
      onConfirm: startRun,
    });
  });
}

export function renderNumpathAd() {
  app.appendChild(el(`
    <div>
      <div class="back-row">
        <div class="back-title">결과 준비 중</div>
        <button class="exit-btn" data-nav="home" aria-label="홈으로 가기">🏠</button>
      </div>
      ${adGateMarkup("런 완료! 결과 보러 가기 전에\n광고 하나만 보고 갈게요 🙏")}
    </div>
  `));
  bindNav(app);
  bindAdGate(app, () => go("numpath-result"));
}

// 공유 결과 카드를 캔버스로 그려서 PNG로 내보낸다. theme-game 팔레트(초록)를 그대로 쓴다.
async function drawNumpathCard(run, totalStars, maxStars) {
  const W = 1080;
  const H = 1080;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");

  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, "#1FAE6A");
  bg.addColorStop(1, "#0F5C39");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  ctx.textAlign = "center";
  ctx.fillStyle = "rgba(255,255,255,.85)";
  ctx.font = "700 30px Pretendard, sans-serif";
  ctx.fillText("과몰입구역", W / 2, 90);

  ctx.font = "150px sans-serif";
  ctx.fillText("🧮", W / 2, 290);

  ctx.fillStyle = "#fff";
  ctx.font = "800 72px Pretendard, sans-serif";
  ctx.fillText("NumPath", W / 2, 400);

  const subtitleText = "Stack & Clear";
  ctx.font = "700 28px Pretendard, sans-serif";
  const subtitleWidth = ctx.measureText(subtitleText).width + 56;
  ctx.fillStyle = "rgba(255,255,255,.18)";
  roundRect(ctx, W / 2 - subtitleWidth / 2, 430, subtitleWidth, 52, 26);
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.fillText(subtitleText, W / 2, 465);

  ctx.font = "800 84px Pretendard, sans-serif";
  ctx.fillText(`⭐ ${totalStars} / ${maxStars}`, W / 2, 600);

  run.stars.forEach((s, i) => {
    const y = 665 + i * 48;
    ctx.textAlign = "left";
    ctx.font = "700 26px Pretendard, sans-serif";
    ctx.fillStyle = "#fff";
    ctx.fillText(`STAGE ${i + 1}`, 120, y);
    ctx.textAlign = "right";
    ctx.fillText(`${"⭐".repeat(s)}${"☆".repeat(MAX_STARS - s)}`, W - 120, y);
  });

  ctx.textAlign = "center";
  ctx.font = "700 32px Pretendard, sans-serif";
  ctx.fillStyle = "#fff";
  ctx.fillText("너도 도전해볼래?", W / 2, 985);
  ctx.font = "600 26px Pretendard, sans-serif";
  ctx.fillStyle = "rgba(255,255,255,.75)";
  ctx.fillText(`${location.origin}/game/numpath`, W / 2, 1025);

  return canvas;
}

export function renderNumpathResult() {
  const run = state.numpath.run;
  const totalStars = run.stars.reduce((a, b) => a + b, 0);
  const maxStars = STAGES_PER_RUN * MAX_STARS;

  app.appendChild(el(`
    <div>
      <div class="back-row">
        <button class="exit-btn" data-nav="home" aria-label="홈으로 가기">🏠</button>
      </div>
      <div class="result-card">
        <div class="eyebrow">이번 런 결과</div>
        <div class="emoji">🧮</div>
        <h2>NumPath 클리어!</h2>
        <div class="result-subtitle">${totalStars} / ${maxStars} ⭐</div>
        <div class="np-stage-stars">
          ${run.stars
            .map(
              (s, i) => `
            <div class="np-stage-star">
              <span class="np-stage-star-label">STAGE ${i + 1}</span>
              <span>${"⭐".repeat(s)}${"☆".repeat(MAX_STARS - s)}</span>
            </div>`
            )
            .join("")}
        </div>
      </div>

      ${shareBlockMarkup("친구도 도전해볼래? 🧮")}

      ${adSlotMarkup("rect")}

      <button class="retry-btn" id="retry-btn">🔄 새 런 시작하기</button>
    </div>
  `));
  bindNav(app);

  app.querySelector("#retry-btn").addEventListener("click", () => {
    state.numpath.run = null;
    go("numpath-intro");
  });

  wireShare(app, {
    url: `${location.origin}/game/numpath`,
    text: `NumPath에서 ${totalStars}/${maxStars}⭐ 받았어요! 너도 도전해볼래?`,
    filename: "과몰입구역-numpath-결과.png",
    draw: () => drawNumpathCard(run, totalStars, maxStars),
  });
}
