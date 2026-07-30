// NumPath의 게임 화면이 아닌 나머지 화면(인트로 · 광고 게이트 · 결과 · 넘버 마을). 플레이 화면은
// in-place 렌더가 필요해서 play.js로 따로 뗐다(D-9 재검토 조건 — 모듈 하나가 커지기 전에 미리 나눔).
import { app, go, onLeave } from "../../core/router.js";
import { el, bindNav, bindAdGate, showModal } from "../../core/dom.js";
import { adSlotMarkup, adGateMarkup } from "../../core/ads.js";
import { shareBlockMarkup, wireShare } from "../../core/share.js";
import { roundRect, escapeHtml } from "../../core/util.js";
import { state } from "../../core/state.js";
import { DIFFICULTIES, difficultyById, stageCountFor, MAX_STARS } from "./data.js";
import { VILLAGE_ITEMS, loadVillage, saveVillage, buildItem, canBuild, isBuilt, villageProgress } from "./village.js";
import { loadCloud } from "./cloud-loader.js";

function startRun() {
  state.numpath.run = {
    seed: Math.floor(Math.random() * 2 ** 31),
    difficulty: state.numpath.difficulty,
    stageIndex: 0,
    stars: [],
    coins: 0,
  };
  go("numpath-play");
}

// 인트로·결과 양쪽에서 쓰는 마을 현황 한 줄 버튼. 코인 지갑과 건설 진행도를 함께 보여줘서
// "코인을 모으면 뭘 하는지"가 게임 진입 전부터 보이게 한다.
function villageLinkMarkup(id) {
  const village = loadVillage();
  const progress = villageProgress(village);
  return `
    <button class="np-village-link" id="${id}">
      <span class="np-village-link-title">🏘️ 넘버 마을</span>
      <span class="np-village-link-stat">🪙 ${village.coins} · 건물 ${progress.built}/${progress.total}</span>
      <span class="np-village-link-arrow">›</span>
    </button>`;
}

export function renderNumpathIntro() {
  const selected = difficultyById(state.numpath.difficulty);
  app.appendChild(el(`
    <div>
      <div class="back-row">
        <button class="back-btn" data-nav="game-list">‹</button>
        <div class="back-title">미니게임</div>
        <button class="exit-btn" data-nav="home" aria-label="홈으로 가기">🏠</button>
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
        ${DIFFICULTIES.map(
          (d) => `
          <button class="np-diff${d.id === selected.id ? " np-diff--selected" : ""}" data-diff="${d.id}">
            <span class="np-diff-emoji">${d.emoji}</span>
            <span class="np-diff-main">
              <span class="np-diff-name">${d.name}</span>
              <span class="np-diff-desc">${d.desc}</span>
            </span>
            <span class="np-diff-stat">${d.stages.length}스테이지<br/>별당 ${d.coinsPerStar}🪙</span>
          </button>`
        ).join("")}
      </div>
      <div class="section-title" style="padding:16px 20px 8px;">🏘️ 마을 키우기</div>
      ${villageLinkMarkup("np-village-btn")}
      <p class="disclaimer">스테이지를 클리어하면 받은 별만큼 코인을 얻어요(어려울수록 배로).<br/>모은 코인으로 넘버 마을에 건물을 지어 마을을 완성해보세요.</p>
      <div class="section-title" style="padding:4px 20px 8px;">🗺️ 칸 종류</div>
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

  app.querySelector("#np-village-btn").addEventListener("click", () => go("numpath-village"));

  app.querySelector("#start-btn").addEventListener("click", () => {
    const diff = difficultyById(state.numpath.difficulty);
    showModal({
      title: `${diff.emoji} ${diff.name} 난이도로 시작`,
      body: "인접한 칸을 탭해서 이동하세요. 지나온 칸은 사라져서\n다시 밟을 수 없어요.\n\n이동한 순서대로 계산이 적용돼요 (예: 5 → +3 → 8). 현재값이\n화면 위쪽의 목표값과 정확히 같아지면 클리어예요.\n\n스테이지를 클리어하면 받은 별만큼 코인을 얻고, 코인으로\n넘버 마을에 건물을 지을 수 있어요.\n\n막히면 Undo나 Reset으로 바로 다시 시작할 수 있어요.",
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

  app.appendChild(el(`
    <div>
      <div class="back-row">
        <button class="exit-btn" data-nav="home" aria-label="홈으로 가기">🏠</button>
      </div>
      <div class="result-card">
        <div class="eyebrow">${diff.emoji} ${diff.name} 난이도 런 결과</div>
        <div class="emoji">🧮</div>
        <h2>NumPath 클리어!</h2>
        <div class="result-subtitle">${totalStars} / ${maxStars} ⭐ · +${run.coins}🪙</div>
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

      <div class="section-title" style="padding:16px 20px 8px;">🏘️ 번 코인으로 마을 짓기</div>
      ${villageLinkMarkup("np-village-btn")}

      ${shareBlockMarkup("친구도 도전해볼래? 🧮")}

      ${adSlotMarkup("rect")}

      <button class="retry-btn" id="retry-btn">🔄 새 런 시작하기</button>
    </div>
  `));
  bindNav(app);

  app.querySelector("#np-village-btn").addEventListener("click", () => go("numpath-village"));

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

// 넘버 마을: 코인으로 건물을 하나씩 지어 완성해 나가는 보상 화면. 런과 무관하게 언제든 볼 수 있다.
// 건설 버튼을 누를 때마다 화면 전체를 go()로 다시 그리지 않고 #np-village-body만 갈아끼운다 —
// 플레이 화면과 같은 이유(광고 슬롯이 재마운트되면 refreshAds()가 반복 실행된다, D-26).
export function renderNumpathVillage() {
  app.appendChild(el(`
    <div>
      <div class="back-row">
        <button class="back-btn" data-nav="numpath-intro">‹</button>
        <div class="back-title">넘버 마을</div>
        <button class="exit-btn" data-nav="home" aria-label="홈으로 가기">🏠</button>
      </div>
      ${adSlotMarkup("bannerTop", "margin-top:10px; margin-bottom:4px;")}
      <div id="np-village-body"></div>
      ${adSlotMarkup("bannerBottom", "margin-top:14px; margin-bottom:22px;")}
    </div>
  `));
  bindNav(app);

  const body = app.querySelector("#np-village-body");

  // 클라우드 상태 3단계: "loading"(로더 결과 기다리는 중) · "unavailable"(CDN 차단·오프라인 —
  // cloud-loader.js가 실패를 흡수해 null을 돌려준 경우) · "ready"(cloud.js 로드 완료, 이제부터
  // getCachedUser()로 로그인 여부를 물어볼 수 있다). 최초 렌더는 항상 "loading"으로 시작한다 —
  // 로그인 확인 때문에 마을 화면 첫 페인트를 늦추지 않는다(오프라인에서도 로컬 마을은 즉시 보여야 한다).
  let cloudState = { status: "loading" };
  let unsubscribeCloud = null;

  function cloudSectionMarkup() {
    if (cloudState.status === "unavailable") {
      return `
        <div class="np-cloud">
          <div class="np-cloud-title">☁️ 다른 기기와 이어하기</div>
          <p class="np-cloud-hint">지금은 이 기능을 쓸 수 없어요. 나중에 다시 시도해주세요.</p>
        </div>`;
    }
    const user = cloudState.status === "ready" ? cloudState.module.getCachedUser() : null;
    if (user) {
      const label = escapeHtml(user.user_metadata?.name || user.email || "계정");
      return `
        <div class="np-cloud">
          <div class="np-cloud-title">☁️ 다른 기기와 이어하기</div>
          <div class="np-cloud-row">
            <span class="np-cloud-status">✅ ${label}님으로 연동됨</span>
            <button class="np-cloud-btn" id="np-cloud-signout">로그아웃</button>
          </div>
        </div>`;
    }
    return `
      <div class="np-cloud">
        <div class="np-cloud-title">☁️ 다른 기기와 이어하기</div>
        <p class="np-cloud-hint">${cloudState.status === "loading" ? "확인 중…" : "로그인하면 이 마을이 다른 기기에서도 이어져요."}</p>
        <div class="np-cloud-row">
          <button class="np-cloud-btn" id="np-cloud-google" ${cloudState.status === "ready" ? "" : "disabled"}>구글로 연동</button>
          <button class="np-cloud-btn" id="np-cloud-kakao" ${cloudState.status === "ready" ? "" : "disabled"}>카카오로 연동</button>
        </div>
      </div>`;
  }

  function renderBody() {
    const village = loadVillage();
    const progress = villageProgress(village);
    const complete = progress.built >= progress.total;
    const builtItems = VILLAGE_ITEMS.filter((i) => isBuilt(village, i.id));

    body.innerHTML = `
      <div class="np-scene${complete ? " np-scene--complete" : ""}">
        <div class="np-scene-title">${complete ? "🎉 마을 완성! 축하해요!" : "마을 풍경"}</div>
        ${
          builtItems.length
            ? `<div class="np-scene-row">${builtItems.map((i) => `<span class="np-scene-item" title="${i.name}">${i.emoji}</span>`).join("")}</div>`
            : `<p class="np-scene-empty">아직 빈 터예요.<br/>스테이지를 클리어하고 코인으로 첫 건물을 지어보세요!</p>`
        }
        <div class="np-progress"><div class="np-progress-fill" style="width:${Math.round((progress.built / progress.total) * 100)}%"></div></div>
        <div class="np-scene-stat">
          <span class="np-wallet" id="np-wallet">🪙 ${village.coins}</span>
          <span>건물 ${progress.built} / ${progress.total}</span>
        </div>
      </div>
      ${cloudSectionMarkup()}
      <div class="section-title" style="padding:16px 20px 8px;">🧱 건설 목록</div>
      <div class="np-shop">
        ${VILLAGE_ITEMS.map((item) => {
          const built = isBuilt(village, item.id);
          const affordable = canBuild(village, item.id);
          return `
            <div class="np-shop-item${built ? " np-shop-item--built" : ""}">
              <span class="np-shop-emoji">${item.emoji}</span>
              <span class="np-shop-info">
                <span class="np-shop-name">${item.name}</span>
                <span class="np-shop-cost">${built ? "완공 ✓" : `🪙 ${item.cost}`}</span>
              </span>
              ${built ? "" : `<button class="np-build-btn" data-build="${item.id}" ${affordable ? "" : "disabled"}>짓기</button>`}
            </div>`;
        }).join("")}
      </div>
      <p class="disclaimer">코인은 스테이지를 클리어할 때마다 받은 별 × 난이도 배수만큼 쌓여요.<br/>마을 진행은 이 브라우저에 저장돼요.</p>
      <div class="cta">
        <button class="cta-btn" id="np-village-play">🧮 코인 벌러 가기</button>
      </div>`;

    body.querySelectorAll("[data-build]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const next = buildItem(loadVillage(), btn.dataset.build);
        saveVillage(next);
        if (cloudState.status === "ready") cloudState.module.pushIfLoggedIn(next);
        renderBody();
      });
    });
    body.querySelector("#np-village-play").addEventListener("click", () => go("numpath-intro"));

    const signoutBtn = body.querySelector("#np-cloud-signout");
    if (signoutBtn) {
      signoutBtn.addEventListener("click", () => {
        if (cloudState.status === "ready") {
          cloudState.module.signOutCloud().catch((err) => console.error("NumPath 클라우드: 로그아웃 실패", err));
        }
      });
    }
    const googleBtn = body.querySelector("#np-cloud-google");
    if (googleBtn) {
      googleBtn.addEventListener("click", () => {
        if (cloudState.status === "ready") {
          cloudState.module.signInWithProvider("google").catch((err) => console.error("NumPath 클라우드: 구글 로그인 실패", err));
        }
      });
    }
    const kakaoBtn = body.querySelector("#np-cloud-kakao");
    if (kakaoBtn) {
      kakaoBtn.addEventListener("click", () => {
        if (cloudState.status === "ready") {
          cloudState.module.signInWithProvider("kakao").catch((err) => console.error("NumPath 클라우드: 카카오 로그인 실패", err));
        }
      });
    }
  }

  renderBody();

  // 첫 페인트(로컬 마을)를 클라우드 확인 때문에 늦추지 않는다 — 로드가 끝나면 상태를 갱신하고
  // 다시 그린다. onCloudChange 구독은 화면을 떠나면(onLeave) 반드시 해제한다 — 안 그러면 이미
  // 닫힌 이 렌더 클로저를 로그인 상태가 바뀔 때마다 계속 호출하게 된다.
  loadCloud().then((cloud) => {
    cloudState = cloud ? { status: "ready", module: cloud } : { status: "unavailable" };
    if (cloud) unsubscribeCloud = cloud.onCloudChange(renderBody);
    renderBody();
  });
  onLeave(() => {
    if (unsubscribeCloud) unsubscribeCloud();
  });
}
