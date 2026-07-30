// DISC 검사의 모든 화면 + 딜레마 미니게임 화면.
import { app, go, onLeave, parseSharedPath } from "../../core/router.js";
import { el, bindNav, bindExit, bindAdGate } from "../../core/dom.js";
import { state } from "../../core/state.js";
import { shuffle, roundRect } from "../../core/util.js";
import { shareBlockMarkup, wireShare } from "../../core/share.js";
import { adSlotMarkup, adGateMarkup } from "../../core/ads.js";
import { TETRADS, DILEMMAS, DISC_TYPES, AXIS_LABELS } from "./data.js";
import {
  AXES,
  scoreTetrads,
  resolveDiscType,
  toPct,
  addBonus,
  dilemmaBonus,
} from "./score.js";
import { radarMarkup, animateRadar, drawRadarOnCanvas } from "./radar.js";

const N = TETRADS.length;

export function startDiscTest() {
  // 선택지 순서를 시작할 때 한 번만 섞어 state에 넣어둔다. 순서를 고정하면 첫 번째
  // 자리에 놓인 축이 체계적으로 유리해지고, 렌더할 때마다 섞으면 뒤로가기에서
  // 순서가 바뀌어 혼란스럽다.
  state.disc = {
    order: TETRADS.map(() => shuffle([0, 1, 2, 3])),
    answers: [],
    pending: { most: null },
    dilemma: null,
  };
}

function ensureOrder() {
  if (!state.disc.order || state.disc.order.length !== N) {
    state.disc.order = TETRADS.map(() => shuffle([0, 1, 2, 3]));
  }
  return state.disc.order;
}

// ---------------------------------------------------------------- 결과 계산

export function computeDisc() {
  const { raw, mostCount } = scoreTetrads(state.disc.answers);
  const bonus = dilemmaBonus(state.disc.dilemma);
  const boosted = addBonus(raw, bonus, N);

  const prePct = {};
  const pct = {};
  for (const ax of AXES) {
    prePct[ax] = toPct(raw[ax], N);
    pct[ax] = toPct(boosted[ax], N);
  }
  // 이미 한계라 실제로는 반영되지 않은 보너스를 "반영됐다"고 표시하지 않는다.
  const visibleBonus = {};
  for (const ax of AXES) {
    if (bonus[ax] && pct[ax] > prePct[ax]) visibleBonus[ax] = bonus[ax];
  }

  const resolved = resolveDiscType(boosted, mostCount);
  return { ...resolved, type: DISC_TYPES[resolved.key], raw: boosted, pct, visibleBonus };
}

function intensityText(pct) {
  if (pct >= 85) return "아주 강하게 나타나요";
  if (pct >= 70) return "뚜렷하게 나타나요";
  if (pct >= 58) return "조금 높은 편이에요";
  if (pct >= 43) return "보통 수준이에요";
  if (pct >= 30) return "낮은 편이에요";
  return "거의 나타나지 않아요";
}

// ---------------------------------------------------------------- 인트로

export function renderDiscIntro() {
  app.appendChild(el(`
    <div>
      <div class="back-row">
        <button class="back-btn" data-nav="psych-list">‹</button>
        <div class="back-title">심리테스트</div>
        <button class="exit-btn" data-nav="home" aria-label="홈으로 가기">🏠</button>
      </div>
      ${adSlotMarkup("bannerTop", "margin-top:10px; margin-bottom:4px;")}
      <div class="cover">
        <div class="emoji">🎭</div>
        <div class="tag">직장인 유형검사</div>
        <h2>나는 어떤<br/>행동유형일까?</h2>
        <p>상황 ${N}개와 짧은 게임 하나.<br/>남들이랑 확실히 다르게 나와요.</p>
      </div>
      <div class="meta-chips">
        <div class="meta-chip"><div class="value">${N}상황</div><div class="label">먼저</div></div>
        <div class="meta-chip"><div class="value">+${DILEMMAS.length}라운드</div><div class="label">미니게임</div></div>
        <button class="meta-chip" data-nav="disc-types"><div class="value">${Object.keys(DISC_TYPES).length}가지</div><div class="label">결과 유형 ›</div></button>
      </div>
      <p class="disclaimer">상황마다 <b>가장 나 같은 것</b>과 <b>가장 아닌 것</b>을 하나씩 고릅니다.
      한쪽을 고르면 다른 쪽 점수가 내려가는 방식이라, 전부 "그렇다"로 밀어붙일 수 없어요.<br/>
      문항이 끝나면 짧은 미니게임이 바로 이어지고, 두 결과를 합쳐 유형이 정해져요.</p>
      <div class="cta">
        <button class="cta-btn" id="disc-start">시작하기</button>
      </div>
      ${adSlotMarkup("bannerBottom", "margin-top:6px; margin-bottom:22px;")}
    </div>
  `));
  bindNav(app);
  app.querySelector("#disc-start").addEventListener("click", () => {
    startDiscTest();
    go("disc-question");
  });
}

// ---------------------------------------------------------------- 유형 12가지 미리보기

// 검사를 시작하지 않고도 12개 유형을 훑어볼 수 있는 목록. 항목을 누르면 검사를 안 해도
// 되는 공유 결과 화면(disc-shared, /test/disc/result/<slug>)으로 바로 보낸다 — 그 화면이
// 이미 유형별 상세(태그·설명·궁합)를 전부 갖추고 있어서 화면을 새로 만들 필요가 없었다.
export function renderDiscTypes() {
  const entries = Object.values(DISC_TYPES);
  app.appendChild(el(`
    <div>
      <div class="back-row">
        <button class="back-btn" data-nav="disc-intro">‹</button>
        <div class="back-title">${entries.length}가지 유형 미리보기</div>
        <button class="exit-btn" data-nav="home" aria-label="홈으로 가기">🏠</button>
      </div>
      <div class="test-list" style="padding-top:8px;">
        ${entries.map((t) => `
          <button class="test-card" data-slug="${t.slug}">
            <div class="icon" style="background:#E8642E;">${t.emoji}</div>
            <div class="body">
              <div class="name">${t.name}</div>
              <div class="desc">${t.subtitle}</div>
            </div>
            <div class="chevron">›</div>
          </button>
        `).join("")}
      </div>
    </div>
  `));
  bindNav(app);
  app.querySelectorAll(".test-card").forEach((card) => {
    card.addEventListener("click", () => {
      location.href = `/test/disc/result/${card.dataset.slug}`;
    });
  });
}

// ---------------------------------------------------------------- 문항

// 문항(과 단계)을 넘길 때마다 go("disc-question")으로 화면 전체를 다시 그리면, 광고
// 슬롯도 매번 새로 만들어져 refreshAds()가 최대 N*2번 실행된다 — 로드되다 만 노출만
// 쌓인다. 반응속도 게임(renderReactionPlay)이 라운드마다 하는 것과 같은 패턴으로,
// 화면은 문항 진입 시 한 번만 그리고 문항·단계가 바뀔 때는 텍스트·선택지만 갈아끼운다.
export function renderDiscQuestion() {
  app.appendChild(el(`
    <div>
      <div class="progress-row">
        <button class="back-btn" id="disc-back">‹</button>
        <div class="progress-track"><div class="progress-fill" id="disc-fill" style="width:0%;"></div></div>
        <div class="progress-count" id="disc-count"></div>
        <button class="exit-btn" aria-label="홈으로 가기">🏠</button>
      </div>
      ${adSlotMarkup("bannerTop", "margin-top:10px; margin-bottom:4px;")}
      <div class="question-block">
        <div class="qno" id="disc-qno"></div>
        <h2 class="disc-scene" id="disc-scene"></h2>
      </div>
      <div class="disc-step-hint" id="disc-hint"></div>
      <div class="options" id="disc-options"></div>
      ${adSlotMarkup("bannerBottom", "margin-top:18px; margin-bottom:4px;")}
    </div>
  `));

  const order = ensureOrder();
  const fill = app.querySelector("#disc-fill");
  const count = app.querySelector("#disc-count");
  const qno = app.querySelector("#disc-qno");
  const sceneEl = app.querySelector("#disc-scene");
  const hintEl = app.querySelector("#disc-hint");
  const optionsEl = app.querySelector("#disc-options");
  const backBtn = app.querySelector("#disc-back");

  function renderCurrent() {
    const i = state.disc.answers.length;
    const tetrad = TETRADS[i];
    const pendingMost = state.disc.pending.most;
    const step = pendingMost === null ? "most" : "least";

    // 진행바는 반 칸씩 움직이지만 숫자는 12분의 몇으로 보여준다.
    // 24문항을 푸는 기분이 들면 중간 이탈이 늘어난다.
    const progress = Math.round(((i * 2 + (step === "least" ? 1 : 0)) / (N * 2)) * 100);
    fill.style.width = `${progress}%`;
    count.innerHTML = `${i + 1}<span class="total">/${N}</span>`;
    qno.textContent = `Q${i + 1}.`;
    sceneEl.textContent = tetrad.scene;
    hintEl.className = `disc-step-hint ${step === "least" ? "least" : ""}`;
    hintEl.innerHTML = step === "most" ? "이 중 <b>가장 나 같은 것</b> 하나" : "이번엔 <b>가장 나 같지 않은 것</b> 하나";

    optionsEl.innerHTML = "";
    for (const idx of order[i]) {
      const opt = tetrad.options[idx];
      const picked = opt.axis === pendingMost;
      // 1단계에서 고른 선택지는 지우지 않고 잠근다. 비교할 맥락이 남아 있고,
      // 같은 걸 두 번 고르는 상황 자체가 구조적으로 불가능해진다.
      const btn = el(`
        <button class="option-btn ${picked ? "picked-most" : ""}" ${picked && step === "least" ? "disabled" : ""}>
          <span class="dot"></span>${opt.text}
        </button>
      `);
      if (!(picked && step === "least")) {
        btn.addEventListener("click", () => {
          if (step === "most") {
            state.disc.pending.most = opt.axis;
            renderCurrent();
          } else {
            state.disc.answers.push({ most: pendingMost, least: opt.axis });
            state.disc.pending.most = null;
            // 문항이 끝나면 결과로 바로 가지 않고 딜레마 게임을 거친다 — 게임 결과까지
            // 반영된 최종 유형을 한 번에 보여주기 위해서다.
            if (state.disc.answers.length >= N) go("dilemma-intro");
            else renderCurrent();
          }
        });
      }
      optionsEl.appendChild(btn);
    }
  }

  // 뒤로가기는 화면에 보이는 단계 기준으로 딱 하나씩 되돌린다.
  backBtn.addEventListener("click", () => {
    const step = state.disc.pending.most === null ? "most" : "least";
    if (step === "least") {
      state.disc.pending.most = null;
      renderCurrent();
    } else if (state.disc.answers.length > 0) {
      state.disc.pending.most = state.disc.answers.pop().most;
      renderCurrent();
    } else {
      go("disc-intro");
    }
  });

  bindExit(app, startDiscTest);

  renderCurrent();
}

// ---------------------------------------------------------------- 결과

function axisRowsMarkup(pct) {
  return AXES.map(
    (ax) => `
      <div class="axis-row">
        <span class="axis-label">${AXIS_LABELS[ax]}</span>
        <span class="axis-pct">${pct[ax]}%</span>
        <span class="axis-text">${intensityText(pct[ax])}</span>
      </div>
    `
  ).join("");
}

function lifeMarkup(type) {
  const sections = [
    ["💘", "연애할 때", type.life.love],
    ["💼", "일할 때", type.life.work],
    ["🌧️", "스트레스 받을 때", type.life.stress],
    ["📋", "나를 대하는 법", type.life.manual],
  ];
  return `
    <div class="life-list">
      ${sections.map(([icon, title, body]) => `
        <div class="life-card">
          <h4><span class="icon">${icon}</span>${title}</h4>
          <p>${body}</p>
        </div>
      `).join("")}
    </div>
  `;
}

function matchMarkup(type) {
  const best = DISC_TYPES[type.match.best];
  const worst = DISC_TYPES[type.match.worst];
  return `
    <div class="section-title" style="padding:22px 20px 9px;">이런 사람과는 어때요? 💞</div>
    <div class="match-row">
      <button class="match-card best" data-slug="${best.slug}">
        <div class="badge">잘 맞아요</div>
        <div class="emoji">${best.emoji}</div>
        <div class="name">${best.name}</div>
        <div class="why">속도도 우선순위도 정반대예요.<br/>서로 겹치지 않아서 빈자리를 그대로 채워줘요.</div>
      </button>
      <button class="match-card worst" data-slug="${worst.slug}">
        <div class="badge">부딪혀요</div>
        <div class="emoji">${worst.emoji}</div>
        <div class="name">${worst.name}</div>
        <div class="why">중요하게 여기는 건 같은데 속도가 달라요.<br/>같은 걸 두고 매번 방식에서 갈립니다.</div>
      </button>
    </div>
  `;
}

function bonusMarkup(visibleBonus) {
  const parts = AXES.filter((ax) => visibleBonus[ax]).map((ax) => `${AXIS_LABELS[ax]} +${visibleBonus[ax]}`);
  if (!parts.length) return "";
  return `<div class="result-stats" style="margin-top:8px;"><span>⚡ 딜레마 게임 결과 반영됨 · ${parts.join(" · ")}</span></div>`;
}

function noteMarkup(r) {
  const notes = [];
  if (r.flat) {
    notes.push("성향이 한쪽으로 크게 쏠리지 않았어요. 상황에 따라 유연하게 움직이는 편이에요.");
  } else if (r.nearTie) {
    notes.push("1위와 2위가 거의 붙어 있어요. 컨디션에 따라 다르게 나올 수 있는 결과예요.");
  }
  return notes.length ? `<p class="result-note">${notes.join("<br/>")}</p>` : "";
}

export function renderDiscResult() {
  const r = computeDisc();
  const t = r.type;

  app.appendChild(el(`
    <div>
      <div class="back-row">
        <button class="exit-btn" data-nav="home" aria-label="홈으로 가기">🏠</button>
      </div>
      <div class="result-card">
        <div class="eyebrow">나의 직장인 유형은</div>
        <div class="emoji">${t.emoji}</div>
        <h2>${t.name}</h2>
        <div class="result-subtitle">${t.subtitle}</div>
        <div class="result-tags">${t.tags.map((x) => `<span>${x}</span>`).join("")}</div>
        <p>${t.desc}</p>
        <div class="result-stats">
          ${AXES.map((ax) => `<span>${AXIS_LABELS[ax]} ${r.pct[ax]}</span>`).join('<span class="sep">·</span>')}
        </div>
        ${bonusMarkup(r.visibleBonus)}
      </div>

      ${noteMarkup(r)}

      <div class="radar-block">
        ${radarMarkup(r.pct)}
        <p class="radar-caption">네 축의 합은 누구나 비슷해요.<br/>크기가 아니라 <b>어느 쪽으로 기울었는지</b>를 보는 그래프예요.</p>
      </div>

      <div class="axis-breakdown">${axisRowsMarkup(r.pct)}</div>

      <div class="section-title" style="padding:22px 20px 9px;">실제로는 이렇게 나와요 🔍</div>
      ${lifeMarkup(t)}

      ${matchMarkup(t)}

      <div class="result-tip">💡 ${t.tip}</div>

      ${shareBlockMarkup()}

      ${adSlotMarkup("rect")}

      <div class="next-block">
        <div class="section-title" style="padding:0 0 9px;">이런 것도 해봤어? 🎲</div>
        <div class="next-row">
          <button class="next-card" data-nav="test-intro"><div class="icon">🎯</div><div class="label">ADHD 성향 체크</div></button>
        </div>
      </div>

      <button class="retry-btn" id="disc-retry">🔄 다시 해보기</button>
    </div>
  `));
  bindNav(app);

  animateRadar(app.querySelector(".disc-radar"), r.pct, onLeave);

  app.querySelectorAll(".match-card").forEach((card) => {
    card.addEventListener("click", () => {
      location.href = `/test/disc/result/${card.dataset.slug}`;
    });
  });

  app.querySelector("#disc-retry").addEventListener("click", () => {
    startDiscTest();
    go("disc-intro");
  });

  wireShare(app, {
    url: `${location.origin}/test/disc/result/${t.slug}`,
    text: `나는 직장인 유형검사에서 "${t.name}(${t.subtitle})"이 나왔어요! 너는 어떤 유형일까?`,
    filename: "과몰입구역-직장인유형-결과카드.png",
    draw: () => drawDiscCard(r),
  });
}

export function renderDiscShared() {
  const shared = parseSharedPath(location.pathname);
  const t = DISC_TYPES[shared.key];

  app.appendChild(el(`
    <div>
      <div class="back-row">
        <button class="back-btn" data-nav="home">‹</button>
        <div class="back-title">심리테스트</div>
      </div>
      ${adSlotMarkup("bannerTop", "margin-top:10px; margin-bottom:4px;")}
      <div class="result-card">
        <div class="eyebrow">이 유형은</div>
        <div class="emoji">${t.emoji}</div>
        <h2>${t.name}</h2>
        <div class="result-subtitle">${t.subtitle}</div>
        <div class="result-tags">${t.tags.map((x) => `<span>${x}</span>`).join("")}</div>
        <p>${t.desc}</p>
      </div>
      <div class="section-title" style="padding:22px 20px 9px;">실제로는 이렇게 나와요 🔍</div>
      ${lifeMarkup(t)}
      ${matchMarkup(t)}
      <div class="result-tip">💡 ${t.tip}</div>
      <div class="cta" style="padding-top:18px;">
        <button class="cta-btn" data-nav="disc-intro">나는 어떤 유형인지 해보기</button>
      </div>
      ${adSlotMarkup("bannerBottom", "margin-top:6px; margin-bottom:22px;")}
    </div>
  `));
  bindNav(app);
  app.querySelectorAll(".match-card").forEach((card) => {
    card.addEventListener("click", () => {
      location.href = `/test/disc/result/${card.dataset.slug}`;
    });
  });
}

// ---------------------------------------------------------------- 공유 카드

// data.js의 "\n" 줄바꿈은 온스크린 좁은 컬럼 기준이라, 1080px 캔버스에 그대로 그리면
// 가장 긴 줄이 여백 없이 캔버스 폭에 거의 맞닿는다(측정 결과 1040px, 캔버스 1080px).
// 단어 단위로 다시 감싸서 항상 여백 안에 들어오게 한다.
function wrapLine(ctx, text, maxWidth) {
  const words = text.split(" ");
  const lines = [];
  let current = "";
  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (current && ctx.measureText(test).width > maxWidth) {
      lines.push(current);
      current = word;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);
  return lines;
}

const DESC_FONT = "500 32px Pretendard, sans-serif";
const LIFE_TITLE_FONT = "700 32px Pretendard, sans-serif";
const LIFE_HEADER_FONT = "700 30px Pretendard, sans-serif";
const LIFE_BODY_FONT = "500 28px Pretendard, sans-serif";

// 결과 화면(.result-card p)의 설명과 "실제로는 이렇게 나와요" 카드 4개(연애·일·스트레스·
// 나를 대하는 법)를 순서대로 쌓으며 각 줄의 y좌표를 미리 계산한다. 캔버스는 유형마다
// 텍스트 길이가 달라 고정 높이로 두면 잘리거나 빈 공간이 남으므로, 그리기 전에 전체
// 내용의 최종 높이부터 알아야 한다 — 그래서 측정과 배치를 한 번에 하는 이 함수가 필요하다.
function layoutDiscCardBody(measureCtx, t, maxWidth, startY) {
  const plan = [];
  let y = startY;

  measureCtx.font = DESC_FONT;
  for (const line of t.desc.split("\n").flatMap((l) => wrapLine(measureCtx, l, maxWidth))) {
    plan.push({ text: line, y, font: DESC_FONT, color: "rgba(255,255,255,.92)" });
    y += 44;
  }

  y += 64;
  plan.push({ text: "실제로는 이렇게 나와요", y, font: LIFE_TITLE_FONT, color: "#fff" });
  y += 58;

  const sections = [
    ["💘", "연애할 때", t.life.love],
    ["💼", "일할 때", t.life.work],
    ["🌧️", "스트레스 받을 때", t.life.stress],
    ["📋", "나를 대하는 법", t.life.manual],
  ];
  for (const [icon, title, body] of sections) {
    plan.push({ text: `${icon} ${title}`, y, font: LIFE_HEADER_FONT, color: "#FFE2D2" });
    y += 46;
    measureCtx.font = LIFE_BODY_FONT;
    for (const line of body.split("\n").flatMap((l) => wrapLine(measureCtx, l, maxWidth))) {
      plan.push({ text: line, y, font: LIFE_BODY_FONT, color: "rgba(255,255,255,.92)" });
      y += 40;
    }
    y += 44;
  }

  return { plan, bottom: y };
}

async function drawDiscCard(r) {
  const t = r.type;
  const W = 1080;
  const MAX_WIDTH = W - 160; // 좌우 80px 여백

  // 높이를 정하기 전에 실제로 감싼 줄 수를 알아야 해서, 측정용으로 먼저 컨텍스트를 만든다.
  const measureCanvas = document.createElement("canvas");
  const measureCtx = measureCanvas.getContext("2d");
  const { plan, bottom } = layoutDiscCardBody(measureCtx, t, MAX_WIDTH, 970);

  const ctaY = bottom + 26;
  const urlY = ctaY + 42;
  const H = urlY + 48;

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");

  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, "#F0743C");
  bg.addColorStop(1, "#C94A18");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  ctx.textAlign = "center";
  ctx.fillStyle = "rgba(255,255,255,.85)";
  ctx.font = "700 30px Pretendard, sans-serif";
  ctx.fillText("과몰입구역 · 직장인 유형검사", W / 2, 84);

  ctx.font = "128px sans-serif";
  ctx.fillText(t.emoji, W / 2, 236);

  ctx.fillStyle = "#fff";
  ctx.font = "800 62px Pretendard, sans-serif";
  ctx.fillText(t.name, W / 2, 328);

  ctx.font = "700 28px Pretendard, sans-serif";
  const subW = ctx.measureText(t.subtitle).width + 56;
  ctx.fillStyle = "rgba(255,255,255,.18)";
  roundRect(ctx, W / 2 - subW / 2, 358, subW, 52, 26);
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.fillText(t.subtitle, W / 2, 393);

  // 화면에 보이는 것과 같은 레이더를 그린다 (좌표 계산은 radar.js와 공용)
  const pts = drawRadarOnCanvas(ctx, r.pct, W / 2, 640, 2.1);
  ctx.font = "700 30px Pretendard, sans-serif";
  ctx.fillStyle = "#fff";
  const labels = [
    [AXES[0], pts[0][0], pts[0][1] - 34, "center"],
    [AXES[1], pts[1][0] + 20, pts[1][1] + 10, "left"],
    [AXES[2], pts[2][0], pts[2][1] + 48, "center"],
    [AXES[3], pts[3][0] - 20, pts[3][1] + 10, "right"],
  ];
  for (const [ax, x, y, align] of labels) {
    ctx.textAlign = align === "center" ? "center" : align === "left" ? "left" : "right";
    ctx.fillText(`${AXIS_LABELS[ax]} ${r.pct[ax]}%`, x, y);
  }

  ctx.textAlign = "center";
  ctx.font = "600 30px Pretendard, sans-serif";
  ctx.fillStyle = "#FFE2D2";
  ctx.fillText(t.tags.join("   "), W / 2, 920);

  // 설명 + "실제로는 이렇게 나와요" 4카드 — layoutDiscCardBody가 계산해둔 좌표 그대로 찍는다.
  for (const item of plan) {
    ctx.font = item.font;
    ctx.fillStyle = item.color;
    ctx.fillText(item.text, W / 2, item.y);
  }

  ctx.font = "700 34px Pretendard, sans-serif";
  ctx.fillStyle = "#fff";
  ctx.fillText("너는 무슨 유형이야?", W / 2, ctaY);
  ctx.font = "600 26px Pretendard, sans-serif";
  ctx.fillStyle = "rgba(255,255,255,.7)";
  ctx.fillText(`${location.origin}/test/disc`, W / 2, urlY);

  return canvas;
}

// ---------------------------------------------------------------- 딜레마 게임

export function renderDilemmaIntro() {
  app.appendChild(el(`
    <div>
      <div class="back-row">
        <button class="back-btn" id="dilemma-intro-back">‹</button>
        <div class="back-title">딜레마 게임</div>
        <button class="exit-btn" aria-label="홈으로 가기">🏠</button>
      </div>
      <div class="cover">
        <div class="emoji">⚖️</div>
        <div class="tag">직장인 유형검사 마지막 단계</div>
        <h2>몇 가지만<br/>더 골라볼게요</h2>
        <p>문항 ${N}개는 끝났어요.<br/>같은 방식으로 상황 ${DILEMMAS.length}개만 더 고르면 결과가 나와요.</p>
      </div>
      <p class="disclaimer">방금과 똑같아요 — 상황마다 <b>가장 나 같은 반응</b> 하나를 고르면 됩니다.
      여기서 고른 것도 문항 결과와 합쳐져 한쪽으로 뚜렷하게 몰리면 결과에 살짝 더해져요.</p>
      <div class="cta">
        <button class="cta-btn" id="dilemma-start">시작하기</button>
      </div>
    </div>
  `));
  bindNav(app);
  app.querySelector("#dilemma-start").addEventListener("click", () => go("dilemma-play"));
  // disc-result는 이제 게임까지 끝나야 들어갈 수 있는 화면이라 뒤로가기 대상이 될 수
  // 없다 — 대신 마지막 문항(2단계)으로 되돌아간다. disc-question의 guard가 답을 하나
  // 지우고 그 자리로 되돌려준다.
  app.querySelector("#dilemma-intro-back").addEventListener("click", () => go("disc-question"));

  bindExit(app, startDiscTest);
}

export function renderDilemmaPlay() {
  // 상황마다 선택지 순서를 한 번만 섞는다 — 문항 화면(state.disc.order)과 같은 이유로,
  // 고정 순서면 특정 축이 첫 자리를 독차지해 유리해진다.
  const order = DILEMMAS.map(() => shuffle([0, 1, 2, 3]));
  const picks = [];
  let round = 0;
  let aborted = false;

  onLeave(() => {
    aborted = true;
  });

  app.appendChild(el(`
    <div>
      <div class="progress-row">
        <button class="back-btn" data-nav="dilemma-intro">‹</button>
        <div class="progress-track"><div class="progress-fill" id="d-fill" style="width:0%;"></div></div>
        <div class="progress-count" id="d-count">1<span class="total">/${DILEMMAS.length}</span></div>
        <button class="exit-btn" aria-label="홈으로 가기">🏠</button>
      </div>
      <div class="question-block">
        <div class="qno">보너스 1.</div>
        <h2 class="disc-scene" id="d-scene"></h2>
      </div>
      <div class="options" id="d-options"></div>
    </div>
  `));
  bindNav(app);
  bindExit(app, startDiscTest);

  const sceneEl = app.querySelector("#d-scene");
  const optionsEl = app.querySelector("#d-options");
  const qno = app.querySelector(".qno");
  const fill = app.querySelector("#d-fill");
  const count = app.querySelector("#d-count");

  function finish() {
    // 문항 결과와 합쳐 최종 유형을 결정한다 — 이 게임만의 별도 결과 화면은 없다.
    state.disc.dilemma = picks;
    go("dilemma-ad");
  }

  function startRound() {
    if (aborted) return;
    const d = DILEMMAS[round];

    fill.style.width = `${Math.round((round / DILEMMAS.length) * 100)}%`;
    count.innerHTML = `${round + 1}<span class="total">/${DILEMMAS.length}</span>`;
    qno.textContent = `보너스 ${round + 1}.`;
    sceneEl.textContent = d.scene;
    optionsEl.innerHTML = "";

    for (const idx of order[round]) {
      const opt = d.options[idx];
      const btn = el(`<button class="option-btn"><span class="dot"></span>${opt.text}</button>`);
      btn.addEventListener("click", () => {
        picks.push(opt.axis);
        round++;
        if (round >= DILEMMAS.length) finish();
        else startRound();
      });
      optionsEl.appendChild(btn);
    }
  }

  startRound();
}

// 딜레마 게임이 끝난 직후, 결과로 넘어가기 전에 한 번 거치는 광고 게이트.
export function renderDilemmaAd() {
  app.appendChild(el(`
    <div>
      <div class="back-row">
        <div class="back-title">결과 준비 중</div>
        <button class="exit-btn" data-nav="home" aria-label="홈으로 가기">🏠</button>
      </div>
      ${adGateMarkup("게임 끝! 결과 보러 가기 전에\n광고 하나만 보고 갈게요 🙏")}
    </div>
  `));
  bindNav(app);
  bindAdGate(app, () => go("disc-result"));
}
