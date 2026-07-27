// DISC 검사의 모든 화면 + 딜레마 미니게임 화면.
import { app, go, onLeave, parseSharedPath } from "../../core/router.js";
import { el, bindNav } from "../../core/dom.js";
import { state } from "../../core/state.js";
import { shuffle, roundRect } from "../../core/util.js";
import { shareBlockMarkup, wireShare } from "../../core/share.js";
import { TETRADS, DILEMMAS, DISC_TYPES, AXIS_LABELS } from "./data.js";
import {
  AXES,
  scoreTetrads,
  resolveDiscType,
  toPct,
  addBonus,
  dilemmaBonus,
  summarizeDilemma,
} from "./score.js";
import { radarMarkup, animateRadar, drawRadarOnCanvas } from "./radar.js";

const N = TETRADS.length;
const DILEMMA_WINDOW = 7000; // 선택지가 뜬 뒤 이 시간이 지나면 시간초과 처리
const DILEMMA_READ_DELAY = 1200; // 상황을 읽을 시간. 이때부터 재야 읽는 속도가 안 섞인다

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
      </div>
      <div class="cover">
        <div class="emoji">🎭</div>
        <div class="tag">DISC 행동유형 검사</div>
        <h2>나는 어떤<br/>행동유형일까?</h2>
        <p>상황 12개와 짧은 게임 하나.<br/>남들이랑 확실히 다르게 나와요.</p>
      </div>
      <div class="meta-chips">
        <div class="meta-chip"><div class="value">${N}상황</div><div class="label">먼저</div></div>
        <div class="meta-chip"><div class="value">+${DILEMMAS.length}라운드</div><div class="label">미니게임</div></div>
        <div class="meta-chip"><div class="value">${Object.keys(DISC_TYPES).length}가지</div><div class="label">결과 유형</div></div>
      </div>
      <p class="disclaimer">상황마다 <b>가장 나 같은 것</b>과 <b>가장 아닌 것</b>을 하나씩 고릅니다.
      한쪽을 고르면 다른 쪽 점수가 내려가는 방식이라, 전부 "그렇다"로 밀어붙일 수 없어요.<br/>
      문항이 끝나면 짧은 미니게임이 바로 이어지고, 두 결과를 합쳐 유형이 정해져요.</p>
      <div class="cta">
        <button class="cta-btn" id="disc-start">시작하기</button>
      </div>
      <div class="ad-slot banner" style="margin:6px 20px 22px;">카카오 AdFit · 320×50</div>
    </div>
  `));
  bindNav(app);
  app.querySelector("#disc-start").addEventListener("click", () => {
    startDiscTest();
    go("disc-question");
  });
}

// ---------------------------------------------------------------- 문항

export function renderDiscQuestion() {
  const order = ensureOrder();
  const i = state.disc.answers.length;
  const tetrad = TETRADS[i];
  const pendingMost = state.disc.pending.most;
  const step = pendingMost === null ? "most" : "least";

  // 진행바는 반 칸씩 움직이지만 숫자는 12분의 몇으로 보여준다.
  // 24문항을 푸는 기분이 들면 중간 이탈이 늘어난다.
  const progress = Math.round(((i * 2 + (step === "least" ? 1 : 0)) / (N * 2)) * 100);

  app.appendChild(el(`
    <div>
      <div class="progress-row">
        <button class="back-btn" id="disc-back">‹</button>
        <div class="progress-track"><div class="progress-fill" style="width:${progress}%;"></div></div>
        <div class="progress-count">${i + 1}<span class="total">/${N}</span></div>
      </div>
      <div class="question-block">
        <div class="qno">Q${i + 1}.</div>
        <h2 class="disc-scene">${tetrad.scene}</h2>
      </div>
      <div class="disc-step-hint ${step === "least" ? "least" : ""}">
        ${step === "most" ? "이 중 <b>가장 나 같은 것</b> 하나" : "이번엔 <b>가장 나 같지 않은 것</b> 하나"}
      </div>
      <div class="options"></div>
    </div>
  `));

  const optionsEl = app.querySelector(".options");
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
          go("disc-question");
        } else {
          state.disc.answers.push({ most: pendingMost, least: opt.axis });
          state.disc.pending.most = null;
          // 문항이 끝나면 결과로 바로 가지 않고 딜레마 게임을 거친다 — 게임 결과까지
          // 반영된 최종 유형을 한 번에 보여주기 위해서다.
          go(state.disc.answers.length >= N ? "dilemma-intro" : "disc-question");
        }
      });
    }
    optionsEl.appendChild(btn);
  }

  // 뒤로가기는 화면에 보이는 단계 기준으로 딱 하나씩 되돌린다.
  app.querySelector("#disc-back").addEventListener("click", () => {
    if (step === "least") {
      state.disc.pending.most = null;
      go("disc-question");
    } else if (state.disc.answers.length > 0) {
      state.disc.pending.most = state.disc.answers.pop().most;
      go("disc-question");
    } else {
      go("disc-intro");
    }
  });
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
      <div class="result-card">
        <div class="eyebrow">나의 DISC 유형은</div>
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

      <div class="ad-slot rect">카카오 AdFit<br/>250×250</div>

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
    text: `나는 DISC "${t.name}(${t.subtitle})"이 나왔어요! 너는 어떤 유형일까?`,
    filename: "과몰입구역-DISC-결과카드.png",
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
      <div class="ad-slot banner" style="margin:6px 20px 22px;">카카오 AdFit · 320×50</div>
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

async function drawDiscCard(r) {
  const t = r.type;
  const W = 1080;
  const H = 1080;
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
  ctx.fillText("과몰입구역 · DISC", W / 2, 84);

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

  ctx.font = "700 34px Pretendard, sans-serif";
  ctx.fillStyle = "#fff";
  ctx.fillText("너는 무슨 유형이야?", W / 2, 990);
  ctx.font = "600 26px Pretendard, sans-serif";
  ctx.fillStyle = "rgba(255,255,255,.7)";
  ctx.fillText(`${location.origin}/test/disc`, W / 2, 1032);

  return canvas;
}

// ---------------------------------------------------------------- 딜레마 게임

export function renderDilemmaIntro() {
  app.appendChild(el(`
    <div>
      <div class="back-row">
        <button class="back-btn" id="dilemma-intro-back">‹</button>
        <div class="back-title">딜레마 게임</div>
      </div>
      <div class="cover">
        <div class="emoji">⚖️</div>
        <div class="tag">DISC 마지막 단계</div>
        <h2>고민할 시간,<br/>많지 않아요</h2>
        <p>문항 ${N}개는 끝났어요.<br/>정답 없는 상황 ${DILEMMAS.length}개만 더 고르면 결과가 나와요.</p>
      </div>
      <p class="disclaimer">DISC는 <b>무엇을 우선하는가</b>(과제/사람)와 <b>얼마나 빨리 움직이는가</b>로 설명하는
      모델이에요. 문항에서 고른 것과 여기서 고르는 것을 합쳐 최종 유형이 정해져요.</p>
      <div class="cta">
        <button class="cta-btn" id="dilemma-start">게임 시작하기</button>
      </div>
    </div>
  `));
  bindNav(app);
  app.querySelector("#dilemma-start").addEventListener("click", () => go("dilemma-play"));
  // disc-result는 이제 게임까지 끝나야 들어갈 수 있는 화면이라 뒤로가기 대상이 될 수
  // 없다 — 대신 마지막 문항(2단계)으로 되돌아간다. disc-question의 guard가 답을 하나
  // 지우고 그 자리로 되돌려준다.
  app.querySelector("#dilemma-intro-back").addEventListener("click", () => go("disc-question"));
}

export function renderDilemmaPlay() {
  const order = shuffle([...DILEMMAS.keys()]);
  const rounds = [];
  let round = 0;
  let timer = null;
  let rafId = null;
  let aborted = false;
  let openedAt = 0;
  let armed = false;

  // 화면을 떠나면 예약된 타이머와 프레임을 전부 무효화한다.
  onLeave(() => {
    aborted = true;
    clearTimeout(timer);
    cancelAnimationFrame(rafId);
  });

  app.appendChild(el(`
    <div>
      <div class="back-row">
        <button class="back-btn" data-nav="dilemma-intro">‹</button>
        <div class="back-title">딜레마 게임</div>
      </div>
      <div class="progress-row">
        <div class="progress-track"><div class="progress-fill" id="d-fill" style="width:0%;"></div></div>
        <div class="progress-count" id="d-count">1<span class="total">/${DILEMMAS.length}</span></div>
      </div>
      <div class="dilemma-panel">
        <p class="dilemma-scene" id="d-scene"></p>
        <div class="dilemma-timer"><div class="dilemma-timer-fill" id="d-timer"></div></div>
        <div class="dilemma-choices" id="d-choices"></div>
      </div>
    </div>
  `));
  bindNav(app);

  const sceneEl = app.querySelector("#d-scene");
  const choicesEl = app.querySelector("#d-choices");
  const timerEl = app.querySelector("#d-timer");
  const fill = app.querySelector("#d-fill");
  const count = app.querySelector("#d-count");

  function finish() {
    // 문항 결과와 합쳐 최종 유형을 결정한다 — 이 게임만의 별도 결과 화면은 없다.
    state.disc.dilemma = summarizeDilemma(rounds);
    go("disc-result");
  }

  function record(choice, ms, timedOut, length) {
    if (!armed) return;
    armed = false;
    clearTimeout(timer);
    cancelAnimationFrame(rafId);
    rounds.push({ choice, ms, timedOut, length });
    round++;
    if (round >= DILEMMAS.length) {
      finish();
    } else {
      timer = setTimeout(() => {
        if (!aborted) startRound();
      }, 350);
    }
  }

  function startRound() {
    if (aborted) return;
    const d = DILEMMAS[order[round]];
    const length = d.task.length + d.people.length;

    fill.style.width = `${Math.round((round / DILEMMAS.length) * 100)}%`;
    count.innerHTML = `${round + 1}<span class="total">/${DILEMMAS.length}</span>`;
    sceneEl.textContent = d.scene;
    timerEl.style.width = "100%";
    choicesEl.innerHTML = `<p class="dilemma-hint">잠시 후 선택지가 나타나요…</p>`;

    // 상황을 읽을 시간을 먼저 주고, 선택지가 뜨는 순간부터 잰다.
    // 이걸 안 하면 측정값의 대부분이 읽는 속도가 된다.
    timer = setTimeout(() => {
      if (aborted) return;
      choicesEl.innerHTML = "";
      for (const kind of shuffle(["task", "people"])) {
        const btn = el(`<button class="dilemma-choice">${d[kind]}</button>`);
        btn.addEventListener("click", () => record(kind, Math.round(performance.now() - openedAt), false, length));
        choicesEl.appendChild(btn);
      }
      armed = true;
      openedAt = performance.now();

      // 숫자 카운트다운 대신 조용히 줄어드는 막대. 초를 세어 보여주면 모두가
      // 급해져서, 재려던 속도 차이 자체가 사라진다.
      const tick = (now) => {
        if (aborted || !armed) return;
        const left = Math.max(0, 1 - (now - openedAt) / DILEMMA_WINDOW);
        timerEl.style.width = `${(left * 100).toFixed(1)}%`;
        if (left > 0) rafId = requestAnimationFrame(tick);
      };
      rafId = requestAnimationFrame(tick);

      // 시간이 다 가도 실패로 처리하지 않는다. 못 고른 것도 하나의 응답이다.
      timer = setTimeout(() => {
        if (!aborted) record(null, DILEMMA_WINDOW, true, length);
      }, DILEMMA_WINDOW);
    }, DILEMMA_READ_DELAY);
  }

  startRound();
}
