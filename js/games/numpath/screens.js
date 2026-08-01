// NumPath의 게임 화면이 아닌 나머지 화면(인트로 · 광고 게이트 · 결과). 플레이 화면은
// in-place 렌더가 필요해서 play.js로 따로 뗐다(D-9 재검토 조건 — 모듈 하나가 커지기 전에 미리 나눔).
import { app, go } from "../../core/router.js";
import { el, bindNav, bindAdGate, showModal } from "../../core/dom.js";
import { adSlotMarkup, adGateMarkup } from "../../core/ads.js";
import { shareBlockMarkup, wireShare } from "../../core/share.js";
import { roundRect } from "../../core/util.js";
import { state } from "../../core/state.js";
import { DIFFICULTIES, difficultyById, stageCountFor, MAX_STARS, formatTime } from "./data.js";

function startRun() {
  state.numpath.run = {
    seed: Math.floor(Math.random() * 2 ** 31),
    difficulty: state.numpath.difficulty,
    stageIndex: 0,
    stars: [],
    startedAt: Date.now(),
    finishedAt: null,
  };
  go("numpath-play");
}

// 개인 최고 기록(난이도별, 로컬 전용) — 여러 사용자를 비교하는 랭킹은 백엔드가 필요해서
// 하지 않기로 했다(D-54/D-55 되돌림과 같은 이유). localStorage 접근은 여기 두 함수에만 가둔다.
function bestTimeKey(difficultyId) {
  return `gt_numpath_best_${difficultyId}`;
}

function loadBestTime(difficultyId) {
  try {
    const raw = localStorage.getItem(bestTimeKey(difficultyId));
    return raw ? Number(raw) : null;
  } catch {
    return null; // 프라이버시 모드 등 — 의도된 방어, 기록 없이도 게임은 계속된다
  }
}

function saveBestTime(difficultyId, ms) {
  try {
    localStorage.setItem(bestTimeKey(difficultyId), String(ms));
  } catch {
    // 위와 같은 이유의 의도된 방어
  }
}

export function renderNumpathIntro() {
  const selected = difficultyById(state.numpath.difficulty);
  app.appendChild(el(`
    <div>
      <div class="back-row">
        <button class="back-btn" data-nav="game-list">‹</button>
        <div class="back-title">미니게임</div>
      </div>
      ${adSlotMarkup("bannerTop", "margin-top:10px; margin-bottom:4px;")}
      <div class="cover">
        <div class="emoji">🧮</div>
        <div class="tag">숫자 경로 퍼즐</div>
        <h2>NumPath<br/>Stack &amp; Clear</h2>
        <p>인접한 칸을 밟을 때마다 그 칸의 계산이 현재값에 적용돼요.<br/>현재값이 <b>목표값</b>과 정확히 같아지면 클리어!<br/>지나온 칸은 사라져서 다시 밟을 수 없어요.</p>
      </div>
      <div class="meta-chips">
        <div class="meta-chip"><div class="value">난이도 ${DIFFICULTIES.length}종</div><div class="label">매 판 새 퍼즐</div></div>
        <div class="meta-chip"><div class="value">${"⭐".repeat(MAX_STARS)}</div><div class="label">별 ${MAX_STARS}개 도전</div></div>
      </div>
      <div class="section-title" style="padding:16px 20px 8px;">🎚️ 난이도 선택</div>
      <div class="np-diff-list">
        ${DIFFICULTIES.map((d) => {
          const best = loadBestTime(d.id);
          return `
          <button class="np-diff${d.id === selected.id ? " np-diff--selected" : ""}" data-diff="${d.id}">
            <span class="np-diff-emoji">${d.emoji}</span>
            <span class="np-diff-main">
              <span class="np-diff-name">${d.name}</span>
              <span class="np-diff-desc">${d.desc}</span>
            </span>
            <span class="np-diff-stat">${d.stages.length}스테이지${best !== null ? `<br/>🏆 ${formatTime(best)}` : ""}</span>
          </button>`;
        }).join("")}
      </div>
      <div class="section-title" style="padding:16px 20px 8px;">🗺️ 칸 종류</div>
      <div class="np-legend">
        <div class="np-legend-item">
          <button class="np-tile np-tile--start" tabindex="-1">5</button>
          <span><b>시작 칸</b> — 여기서부터 출발, 숫자가 첫 현재값이에요</span>
        </div>
        <div class="np-legend-item">
          <button class="np-tile np-tile--tile" tabindex="-1">+3</button>
          <span><b>연산 칸</b> — 밟으면 현재값에 그 계산이 적용돼요 (+ − × ÷)</span>
        </div>
        <div class="np-legend-item">
          <button class="np-tile np-tile--tile np-tile--multiplier" tabindex="-1">×2</button>
          <span><b>배수 칸</b> — 현재값 전체에 2배 또는 3배를 곱해요</span>
        </div>
        <div class="np-legend-item">
          <button class="np-tile np-tile--block" tabindex="-1">✕</button>
          <span><b>차단 칸</b> — 지나갈 수 없어요</span>
        </div>
      </div>
      <p class="disclaimer">막히거나 이동 횟수를 다 쓰면 Undo나 Reset으로 바로 다시 도전할 수 있어요.<br/>최적 경로로 클리어하면 ⭐⭐⭐, 여유 있게 클리어하면 ⭐⭐, 그냥 클리어해도 ⭐예요.</p>
      <div class="cta">
        <button class="cta-btn" id="start-btn">런 시작하기</button>
      </div>
      ${adSlotMarkup("bannerBottom", "margin-top:6px; margin-bottom:22px;")}
    </div>
  `));
  bindNav(app);

  app.querySelectorAll(".np-diff").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.numpath.difficulty = btn.dataset.diff;
      app.querySelectorAll(".np-diff").forEach((b) => b.classList.toggle("np-diff--selected", b === btn));
    });
  });

  app.querySelector("#start-btn").addEventListener("click", () => {
    const diff = difficultyById(state.numpath.difficulty);
    showModal({
      title: `${diff.emoji} ${diff.name} 난이도로 시작`,
      body: "인접한 칸을 탭해서 이동하세요. 지나온 칸은 사라져서\n다시 밟을 수 없어요.\n\n이동한 순서대로 계산이 적용돼요 (예: 5 → +3 → 8). 현재값이\n화면 위쪽의 목표값과 정확히 같아지면 클리어예요.\n\n막히면 Undo나 Reset으로 바로 다시 시작할 수 있어요.",
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

  const diff = difficultyById(run.difficulty);
  const subtitleText = `${diff.emoji} ${diff.name} 난이도`;
  ctx.font = "700 28px Pretendard, sans-serif";
  const subtitleWidth = ctx.measureText(subtitleText).width + 56;
  ctx.fillStyle = "rgba(255,255,255,.18)";
  roundRect(ctx, W / 2 - subtitleWidth / 2, 430, subtitleWidth, 52, 26);
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.fillText(subtitleText, W / 2, 465);

  ctx.font = "800 84px Pretendard, sans-serif";
  ctx.fillText(`⭐ ${totalStars} / ${maxStars}`, W / 2, 600);

  // 스테이지 수가 난이도마다 다르다(5~9줄) — 줄 간격을 남은 세로 공간에 맞춰 줄여서
  // 어려움 난이도의 9줄도 하단 문구(y=985)를 침범하지 않게 한다.
  const rowH = Math.min(48, Math.floor(290 / run.stars.length));
  const rowFont = run.stars.length > 6 ? 22 : 26;
  run.stars.forEach((s, i) => {
    const y = 660 + i * rowH;
    ctx.textAlign = "left";
    ctx.font = `700 ${rowFont}px Pretendard, sans-serif`;
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
  const diff = difficultyById(run.difficulty);
  const totalStars = run.stars.reduce((a, b) => a + b, 0);
  const maxStars = stageCountFor(run.difficulty) * MAX_STARS;

  const elapsedMs = run.finishedAt - run.startedAt;
  const prevBest = loadBestTime(run.difficulty);
  const isNewBest = prevBest === null || elapsedMs < prevBest;
  if (isNewBest) saveBestTime(run.difficulty, elapsedMs);

  app.appendChild(el(`
    <div>
      <div class="result-card">
        <div class="eyebrow">${diff.emoji} ${diff.name} 난이도 런 결과</div>
        <div class="emoji">🧮</div>
        <h2>NumPath 클리어!</h2>
        <div class="result-subtitle">${totalStars} / ${maxStars} ⭐ · ⏱️ ${formatTime(elapsedMs)}</div>
        <p class="${isNewBest ? "np-best-badge" : "np-best-hint"}">${isNewBest ? "🎉 이 난이도 개인 신기록!" : `이 난이도 최고 기록 ⏱️ ${formatTime(prevBest)}`}</p>
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
    text: `NumPath ${diff.name} 난이도에서 ${totalStars}/${maxStars}⭐ 받았어요! 너도 도전해볼래?`,
    filename: "과몰입구역-numpath-결과.png",
    draw: () => drawNumpathCard(run, totalStars, maxStars),
  });
}
