"use strict";

const QUESTIONS = [
  { text: "해야 할 일을 자꾸 마지막 순간까지\n미루다가 늘 벼락치기로 끝낸다.", group: "focus" },
  { text: "대화 중에 딴생각에 빠져서\n방금 무슨 말을 들었는지 놓칠 때가 있다.", group: "focus" },
  { text: "지갑, 열쇠, 휴대폰을 어디 뒀는지\n매번 찾아 헤맨다.", group: "focus" },
  { text: "하던 일을 끝까지 마무리하지 못하고\n자꾸 다른 일로 넘어간다.", group: "focus" },
  { text: "줄을 서거나 신호를 기다리는 상황을\n유독 못 참는다.", group: "impulse" },
  { text: "좋은 생각이 떠오르면 앞뒤 재지 않고\n바로 저질러 버린다.", group: "impulse" },
  { text: "상대방 말이 끝나기도 전에\n끼어들어 말할 때가 많다.", group: "impulse" },
  { text: "계획에 없던 물건을 충동적으로\n사거나 약속을 잡는다.", group: "impulse" },
  { text: "가만히 앉아있는 것보다\n몸을 움직이는 게 훨씬 편하다.", group: "energy" },
  { text: "좋아하는 것에 꽂히면 시간 가는 줄\n모르고 몰입한다.", group: "energy" },
  { text: "회의나 수업 중에도 다리를 떨거나\n손을 계속 움직인다.", group: "energy" },
  { text: "새로운 자극이 없으면 금방 지루해하고\n딴짓을 찾는다.", group: "energy" },
];

const OPTIONS = [
  { label: "매우 그렇다", value: 4 },
  { label: "그렇다", value: 3 },
  { label: "보통이다", value: 2 },
  { label: "아니다", value: 1 },
  { label: "전혀 아니다", value: 0 },
];

const RESULT_TYPES = [
  {
    max: 12,
    emoji: "🦉",
    name: "차분한 올빼미형",
    desc: "웬만한 자극에는 흔들리지 않고\n제 페이스대로 차근차근 해내는 편이에요.",
    tip: "지금처럼 꾸준한 페이스를 유지해보세요.",
  },
  {
    max: 24,
    emoji: "🐢",
    name: "느긋한 거북이형",
    desc: "가끔 딴생각에 빠지긴 하지만\n결국엔 제 할 일을 끝까지 해내요.",
    tip: "25분 집중 · 5분 휴식(뽀모도로)을 시도해보면 좋아요.",
  },
  {
    max: 36,
    emoji: "🐿️",
    name: "호기심 폭발 다람쥐형",
    desc: "관심사가 생기면 폭발적으로 몰입!\n대신 지루한 건 1초도 못 참아요.",
    tip: "관심 가는 일부터 먼저 끝내는 순서로 할 일 목록을 짜보세요.",
  },
  {
    max: 48,
    emoji: "⚡",
    name: "번개 충동 폭풍형",
    desc: "생각나면 바로 행동하는 추진력 만렙!\n대신 브레이크가 살짝 약해요.",
    tip: "중요한 결정 전엔 '10초만 멈추기'를 연습해보세요.",
  },
];

// 반응·주의력 게임: Go/No-Go 과제를 단순화한 10라운드 미니게임.
// 초록불(go)엔 반응, 주황불(no-go)엔 억제 — 두 종류 오류와 반응시간 변산성을 측정한다.
const CPT_ROUNDS = 10;
const CPT_NOGO_COUNT = 3;
const CPT_GO_WINDOW = 1000; // go 신호 후 이 시간 안에 반응 못하면 누락(omission) 처리
const CPT_NOGO_WINDOW = 1000; // no-go 신호 후 이 시간 동안 누르면 억제 실패(commission) 처리

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function summarizeGameResults(results) {
  const goResults = results.filter((r) => r.type === "go");
  const noGoResults = results.filter((r) => r.type === "nogo");
  const correctGo = goResults.filter((r) => r.correct);
  const omissionErrors = goResults.length - correctGo.length;
  const commissionErrors = noGoResults.filter((r) => !r.correct).length;
  const rts = correctGo.map((r) => r.rt);
  const avgRt = rts.length ? Math.round(rts.reduce((a, b) => a + b, 0) / rts.length) : null;
  const rtSD = rts.length > 1
    ? Math.round(Math.sqrt(rts.reduce((s, v) => s + (v - avgRt) ** 2, 0) / rts.length))
    : 0;
  const correctCount = correctGo.length + (noGoResults.length - commissionErrors);
  const accuracy = results.length ? Math.round((correctCount / results.length) * 100) : 0;
  return {
    goCount: goResults.length,
    noGoCount: noGoResults.length,
    avgRt,
    rtSD,
    omissionErrors,
    commissionErrors,
    accuracy,
  };
}

const state = {
  screen: "home",
  answers: [],
  lastReaction: null,
};

// 심리테스트는 /test/이름, 미니게임은 /game/이름 경로를 갖는다.
// 반응속도 게임은 별도 미니게임이 아니라 ADHD 테스트에 딸린 보너스라 /test/adhd 하위 경로를 쓴다.
const ROUTES = {
  "/": "home",
  "/test": "psych-list",
  "/test/adhd": "test-intro",
  "/test/adhd/play": "test-question",
  "/test/adhd/result": "test-result",
  "/test/adhd/reaction": "reaction-intro",
  "/test/adhd/reaction/play": "reaction-play",
  "/test/adhd/reaction/result": "reaction-result",
  "/game": "game-list",
};
const SCREEN_TO_PATH = Object.fromEntries(Object.entries(ROUTES).map(([path, screen]) => [screen, path]));

function normalizePath(pathname) {
  if (pathname.length > 1 && pathname.endsWith("/")) pathname = pathname.slice(0, -1);
  return pathname || "/";
}

function pathToScreen(pathname) {
  return ROUTES[normalizePath(pathname)] || "home";
}

const app = document.getElementById("app");
let reactionTimer = null;

function render() {
  app.innerHTML = "";
  switch (state.screen) {
    case "home": renderHome(); break;
    case "psych-list": renderPsychList(); break;
    case "test-intro": renderTestIntro(); break;
    case "test-question": renderQuestion(); break;
    case "test-result": renderResult(); break;
    case "game-list": renderGameList(); break;
    case "reaction-intro": renderReactionIntro(); break;
    case "reaction-play": renderReactionPlay(); break;
    case "reaction-result": renderReactionResult(); break;
  }
  app.classList.toggle("has-bottom-nav", !!app.querySelector(".bottom-nav"));
}

// 뒤로/앞으로가기로 URL만 바뀌었을 때 화면-상태 불일치를 막기 위한 보정
function resolveScreen(screen) {
  if (screen === "test-question" && state.answers.length >= QUESTIONS.length) {
    state.answers = state.answers.slice(0, QUESTIONS.length - 1);
  }
  if (screen === "test-result" && state.answers.length < QUESTIONS.length) {
    return "test-intro";
  }
  if (screen === "reaction-result" && !state.lastReaction) {
    return "reaction-intro";
  }
  return screen;
}

const SCREEN_TITLES = {
  "home": "과몰입구역 - 심리테스트 · 미니게임",
  "psych-list": "심리테스트 | 과몰입구역",
  "test-intro": "성인 ADHD 자가진단 테스트 | 과몰입구역",
  "test-question": "성인 ADHD 자가진단 - 진행 중 | 과몰입구역",
  "test-result": "성인 ADHD 자가진단 결과 | 과몰입구역",
  "game-list": "미니게임 | 과몰입구역",
  "reaction-intro": "반응속도 게임 | 과몰입구역",
  "reaction-play": "반응속도 게임 - 플레이 중 | 과몰입구역",
  "reaction-result": "반응속도 게임 결과 | 과몰입구역",
};

function setScreen(screen, { push = false, replace = false } = {}) {
  if (reactionTimer) {
    clearTimeout(reactionTimer);
    reactionTimer = null;
  }
  const resolved = resolveScreen(screen);
  state.screen = resolved;
  render();
  window.scrollTo(0, 0);
  document.title = SCREEN_TITLES[resolved] || SCREEN_TITLES.home;

  const path = (SCREEN_TO_PATH[resolved] || "/") + location.search;
  if (push && normalizePath(location.pathname) !== SCREEN_TO_PATH[resolved]) {
    history.pushState({ screen: resolved }, "", path);
  } else if (replace && (normalizePath(location.pathname) !== SCREEN_TO_PATH[resolved] || !history.state)) {
    history.replaceState({ screen: resolved }, "", path);
  }
}

function go(screen) {
  setScreen(screen, { push: true });
}

window.addEventListener("popstate", (e) => {
  const screen = (e.state && e.state.screen) || pathToScreen(location.pathname);
  setScreen(screen, { replace: true });
});

function el(html) {
  const t = document.createElement("template");
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

function bindNav(root) {
  root.querySelectorAll("[data-nav]").forEach((b) => {
    b.addEventListener("click", () => go(b.dataset.nav));
  });
}

function showModal({ title, body, confirmLabel = "확인", cancelLabel = "취소", onConfirm }) {
  const overlay = el(`
    <div class="modal-overlay">
      <div class="modal-box">
        <div class="modal-title">${title}</div>
        <p class="modal-body">${body}</p>
        <div class="modal-actions">
          <button class="modal-btn-primary" id="modal-confirm">${confirmLabel}</button>
          <button class="modal-btn-secondary" id="modal-cancel">${cancelLabel}</button>
        </div>
      </div>
    </div>
  `);
  document.body.appendChild(overlay);
  const close = () => overlay.remove();
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) close();
  });
  overlay.querySelector("#modal-cancel").addEventListener("click", close);
  overlay.querySelector("#modal-confirm").addEventListener("click", () => {
    close();
    onConfirm();
  });
}

function renderHome() {
  app.appendChild(el(`
    <div>
      <div class="header">
        <div class="logo">
          <div class="logo-badge">과</div>
          <div class="logo-text">과몰입구역</div>
        </div>
        <div style="width:34px; height:34px; border-radius:11px; background:#fff; box-shadow:0 2px 8px rgba(0,0,0,.06); display:flex; align-items:center; justify-content:center; color:#75727B; font-size:16px;">☰</div>
      </div>
      <div class="ad-slot banner">카카오 AdFit · 320×50</div>
      <div class="hero">
        <p class="hero-title">오늘, 뭐에 과몰입해볼까?</p>
        <p class="hero-sub">1분이면 끝나는 테스트 · 게임 · 퀴즈</p>
      </div>
      <div class="category-grid">
        <button class="category-card" data-nav="psych-list">
          <div class="icon" style="background:#5B44F2;">🧠</div>
          <div class="title">심리테스트</div>
          <div class="sub">나를 알아보는 시간</div>
        </button>
        <button class="category-card" style="background:#E4F5EC;" data-nav="game-list">
          <div class="icon" style="background:#1FAE6A;">⚡</div>
          <div class="title">미니게임</div>
          <div class="sub">반응속도·기억력</div>
        </button>
      </div>
      <div class="bottom-nav">
        <div class="nav-item active"><div class="nav-icon">🏠</div><div class="nav-label">홈</div></div>
        <div class="nav-item"><div class="nav-icon">🔥</div><div class="nav-label">인기</div></div>
        <div class="nav-item"><div class="nav-icon">🔖</div><div class="nav-label">저장</div></div>
        <div class="nav-item"><div class="nav-icon">👤</div><div class="nav-label">내정보</div></div>
      </div>
    </div>
  `));
  bindNav(app);
}

function renderPsychList() {
  app.appendChild(el(`
    <div>
      <div class="back-row">
        <button class="back-btn" data-nav="home">‹</button>
        <div class="back-title">심리테스트</div>
      </div>
      <div class="section-title">🔥 지금 인기</div>
      <div class="test-list">
        <button class="test-card" data-nav="test-intro">
          <div class="icon">🎯</div>
          <div class="body">
            <div class="name">성인 ADHD 자가진단</div>
            <div class="desc">집중 안 되는 나, 혹시…? · 12문항</div>
          </div>
          <div class="chevron">›</div>
        </button>
      </div>
    </div>
  `));
  bindNav(app);
}

function renderTestIntro() {
  app.appendChild(el(`
    <div>
      <div class="back-row">
        <button class="back-btn" data-nav="psych-list">‹</button>
        <div class="back-title">심리테스트</div>
      </div>
      <div class="cover">
        <div class="emoji">🎯</div>
        <div class="tag">집중력 자가진단</div>
        <h2>성인 ADHD<br/>자가진단 테스트</h2>
        <p>요즘 유독 집중이 안 되고<br/>깜빡깜빡한다면?</p>
      </div>
      <div class="meta-chips">
        <div class="meta-chip"><div class="value">${QUESTIONS.length}문항</div><div class="label">약 1분</div></div>
        <div class="meta-chip"><div class="value">24.8만</div><div class="label">참여</div></div>
        <div class="meta-chip"><div class="value">${RESULT_TYPES.length}가지</div><div class="label">결과 유형</div></div>
      </div>
      <p class="disclaimer">본 테스트는 재미를 위한 자가 참고용이며, 의학적 진단이 아닙니다.</p>
      <div class="cta">
        <button class="cta-btn" id="start-btn">테스트 시작하기</button>
      </div>
      <div class="ad-slot banner" style="margin:6px 20px 22px;">카카오 AdFit · 320×50</div>
    </div>
  `));
  bindNav(app);
  app.querySelector("#start-btn").addEventListener("click", () => {
    showModal({
      title: "⚠️ 시작 전 안내",
      body: "이 테스트는 재미를 위한 자가 참고용 콘텐츠이며,\n의학적 진단 도구가 아닙니다.\n\n결과만으로 ADHD 여부를 판단할 수 없으니,\n정확한 진단은 반드시 정신건강의학과 등\n전문 의료기관에서 전문가와 상담을 통해\n받으시길 권해드립니다.",
      confirmLabel: "확인했어요, 시작할게요",
      cancelLabel: "취소",
      onConfirm: () => {
        state.answers = [];
        state.lastReaction = null;
        go("test-question");
      },
    });
  });
}

function renderQuestion() {
  const i = state.answers.length;
  const q = QUESTIONS[i];
  const pct = Math.round((i / QUESTIONS.length) * 100);

  app.appendChild(el(`
    <div>
      <div class="progress-row">
        <button class="back-btn" id="q-back">‹</button>
        <div class="progress-track"><div class="progress-fill" style="width:${pct}%;"></div></div>
        <div class="progress-count">${i + 1}<span class="total">/${QUESTIONS.length}</span></div>
      </div>
      <div class="question-block">
        <div class="qno">Q${i + 1}.</div>
        <h2>${q.text}</h2>
      </div>
      <div class="options"></div>
    </div>
  `));

  const optionsEl = app.querySelector(".options");
  OPTIONS.forEach((opt) => {
    const btn = el(`
      <button class="option-btn">
        <span class="dot"></span>${opt.label}
      </button>
    `);
    btn.addEventListener("click", () => {
      state.answers.push({ group: q.group, value: opt.value });
      if (state.answers.length >= QUESTIONS.length) {
        go("test-result");
      } else {
        go("test-question");
      }
    });
    optionsEl.appendChild(btn);
  });

  app.querySelector("#q-back").addEventListener("click", () => {
    if (state.answers.length === 0) {
      go("test-intro");
    } else {
      state.answers.pop();
      go("test-question");
    }
  });
}

// 게임 결과(state.lastReaction)를 충동/집중 보너스로 환산한다.
// 근거: Go/No-Go·CPT(연속수행검사) 계열 과제에서 실제로 쓰이는 두 축을 그대로 옮긴 것.
//  - 억제 실패(commission error, no-go에서 눌러버림) = 충동성(impulse) 지표
//  - 누락 반응(omission error, go를 놓침) + 반응시간 변산성(RT variability) = 부주의(focus) 지표
// "빨리 누를수록 충동적"이라는 예전 규칙은 반사신경과 충동성을 혼동한 것이라 폐기했다.
// 에너지(과잉행동) 성향은 이 방식으로 측정할 근거가 없어 의도적으로 반영하지 않는다.
function gameBonuses() {
  const g = state.lastReaction;
  if (!g) return { impulse: 0, focus: 0 };

  let impulse = 0;
  if (g.noGoCount > 0) {
    const rate = g.commissionErrors / g.noGoCount;
    if (rate >= 1) impulse = 4;
    else if (rate >= 0.66) impulse = 3;
    else if (rate >= 0.33) impulse = 1;
  }

  let focus = 0;
  if (g.goCount > 0) {
    const omissionRate = g.omissionErrors / g.goCount;
    if (omissionRate >= 0.4) focus += 2;
    else if (omissionRate > 0) focus += 1;
  }
  if (g.rtSD > 80) focus += 2;
  else if (g.rtSD > 40) focus += 1;
  focus = Math.min(4, focus);

  return { impulse, focus };
}

function computeResult() {
  const totals = { focus: 0, impulse: 0, energy: 0 };
  state.answers.forEach((a) => {
    totals[a.group] += a.value;
  });
  const bonus = gameBonuses();
  totals.impulse += bonus.impulse;
  totals.focus += bonus.focus;
  const total = totals.focus + totals.impulse + totals.energy;
  const type = RESULT_TYPES.find((t) => total <= t.max) || RESULT_TYPES[RESULT_TYPES.length - 1];
  const toPct = (v) => Math.min(100, Math.round((v / 16) * 100));
  return {
    type,
    focus: toPct(totals.focus),
    impulse: toPct(totals.impulse),
    energy: toPct(totals.energy),
    bonus,
  };
}

function renderResult() {
  const r = computeResult();
  app.appendChild(el(`
    <div>
      <div class="result-card">
        <div class="eyebrow">나의 집중 유형은</div>
        <div class="emoji">${r.type.emoji}</div>
        <h2>${r.type.name}</h2>
        <p>${r.type.desc}</p>
        <div class="result-stats">
          <span>집중 ${r.focus}</span><span class="sep">·</span>
          <span>충동 ${r.impulse}</span><span class="sep">·</span>
          <span>에너지 ${r.energy}</span>
        </div>
        ${r.bonus.impulse > 0 || r.bonus.focus > 0 ? `<div class="result-stats" style="margin-top:8px;"><span>⚡ 반응·주의력 게임 결과 반영됨${r.bonus.impulse > 0 ? ` · 충동 +${r.bonus.impulse}` : ""}${r.bonus.focus > 0 ? ` · 집중 +${r.bonus.focus}` : ""}</span></div>` : ""}
      </div>

      <div class="result-tip">💡 ${r.type.tip}</div>

      <div class="share-block">
        <div class="share-title">친구는 무슨 유형일까? 👀</div>
        <div class="share-kakao">💬 카카오톡으로 결과 공유</div>
        <div class="share-row">
          <button class="share-mini active" id="copy-link-btn">🔗 링크 복사</button>
          <div class="share-mini">🖼️ 이미지 저장</div>
        </div>
        <p class="share-note">카카오톡 공유·이미지 저장은 준비 중이에요</p>
      </div>

      <div class="ad-slot rect">카카오 AdFit<br/>250×250</div>

      <div class="next-block">
        <div class="section-title" style="padding:0 0 9px;">이런 것도 해봤어? 🎲</div>
        <div class="next-row">
          <button class="next-card" data-nav="reaction-intro"><div class="icon">⚡</div><div class="label">반응속도 게임</div></button>
          <div class="next-card quiz"><div class="icon">💡</div><div class="label">상식 퀴즈</div></div>
        </div>
      </div>

      <button class="retry-btn" id="retry-btn">🔄 테스트 다시하기</button>
    </div>
  `));
  bindNav(app);
  app.querySelector("#retry-btn").addEventListener("click", () => {
    state.answers = [];
    go("test-intro");
  });
  const copyBtn = app.querySelector("#copy-link-btn");
  copyBtn.addEventListener("click", async () => {
    const original = copyBtn.textContent;
    try {
      await navigator.clipboard.writeText(location.href);
      copyBtn.textContent = "✅ 복사 완료!";
    } catch {
      copyBtn.textContent = "복사 실패, 직접 복사해주세요";
    }
    setTimeout(() => {
      copyBtn.textContent = original;
    }, 1500);
  });
}

function renderGameList() {
  app.appendChild(el(`
    <div>
      <div class="back-row">
        <button class="back-btn" data-nav="home">‹</button>
        <div class="back-title">미니게임</div>
      </div>
      <div class="empty-state">
        <div class="emoji">🛠️</div>
        <div class="msg">준비 중인 게임이 있어요<br/>조금만 기다려주세요!</div>
      </div>
    </div>
  `));
  bindNav(app);
}

function bestReactionTime() {
  const v = localStorage.getItem("gt_reaction_best");
  return v ? parseInt(v, 10) : null;
}

function renderReactionIntro() {
  const best = bestReactionTime();
  app.appendChild(el(`
    <div>
      <div class="back-row">
        <button class="back-btn" data-nav="test-result">‹</button>
        <div class="back-title">성인 ADHD 자가진단</div>
      </div>
      <div class="cover" style="background:linear-gradient(160deg,#2FCB86,#1B8F5C);">
        <div class="emoji">⚡</div>
        <div class="tag">충동억제 · 지속주의 측정</div>
        <h2>반응속도 게임</h2>
        <p>초록불엔 재빨리 탭, 주황불엔 참아보세요!<br/>${CPT_ROUNDS}라운드로 충동 조절과 집중력을 함께 측정해요.</p>
      </div>
      <div class="meta-chips">
        <div class="meta-chip"><div class="value">${CPT_ROUNDS}라운드</div><div class="label">측정 방식</div></div>
        <div class="meta-chip"><div class="value">${best !== null ? best + "ms" : "-"}</div><div class="label">내 평균 반응속도</div></div>
        <div class="meta-chip"><div class="value">${CPT_NOGO_COUNT}회</div><div class="label">참아야 할 신호</div></div>
      </div>
      <p class="disclaimer">너무 일찍 누르면 그 라운드만 다시 진행돼요(감점 없음). 주황불에서는 누르지 않는 게 정답이에요!</p>
      <div class="cta">
        <button class="cta-btn" id="start-btn" style="background:#1FAE6A; box-shadow:0 8px 20px rgba(31,174,106,.32);">게임 시작하기</button>
      </div>
    </div>
  `));
  bindNav(app);
  app.querySelector("#start-btn").addEventListener("click", () => go("reaction-play"));
}

function renderReactionPlay() {
  app.appendChild(el(`
    <div>
      <div class="back-row">
        <button class="back-btn" data-nav="test-result">‹</button>
        <div class="back-title">반응속도 게임</div>
      </div>
      <div class="progress-row">
        <div class="progress-track"><div class="progress-fill" id="round-fill" style="width:0%;"></div></div>
        <div class="progress-count" id="round-count">1<span class="total">/${CPT_ROUNDS}</span></div>
      </div>
      <div id="game-panel" class="game-panel">
        <div id="game-msg" class="game-msg">화면을 터치해서 시작하세요</div>
      </div>
    </div>
  `));
  bindNav(app);

  const panel = app.querySelector("#game-panel");
  const msg = app.querySelector("#game-msg");
  const fill = app.querySelector("#round-fill");
  const count = app.querySelector("#round-count");

  const noGoRounds = new Set(shuffle([...Array(CPT_ROUNDS).keys()]).slice(0, CPT_NOGO_COUNT));
  const results = [];
  let round = 0;
  let phase = "intro"; // intro -> waiting -> go/nogo -> feedback (-> waiting again on false start)
  let stimulusOnset = 0;

  function updateProgress() {
    fill.style.width = `${Math.round((round / CPT_ROUNDS) * 100)}%`;
    count.innerHTML = `${Math.min(round + 1, CPT_ROUNDS)}<span class="total">/${CPT_ROUNDS}</span>`;
  }

  function startRound() {
    phase = "waiting";
    panel.style.background = "#E3564C";
    msg.style.color = "#fff";
    msg.textContent = "곧 신호가 나타나요...\n집중하세요!";
    const delay = 900 + Math.random() * 1400;
    reactionTimer = setTimeout(() => {
      const isGo = !noGoRounds.has(round);
      phase = isGo ? "go" : "nogo";
      stimulusOnset = performance.now();
      if (isGo) {
        panel.style.background = "#1FAE6A";
        msg.textContent = "지금 클릭!";
      } else {
        panel.style.background = "#F5A623";
        msg.textContent = "누르지 마세요!";
      }
      reactionTimer = setTimeout(() => {
        results.push(isGo ? { type: "go", correct: false } : { type: "nogo", correct: true });
        nextRound();
      }, isGo ? CPT_GO_WINDOW : CPT_NOGO_WINDOW);
    }, delay);
  }

  function nextRound() {
    round++;
    updateProgress();
    if (round >= CPT_ROUNDS) {
      finish();
    } else {
      startRound();
    }
  }

  function finish() {
    const stats = summarizeGameResults(results);
    const best = bestReactionTime();
    const isBest = stats.avgRt !== null && (best === null || stats.avgRt < best);
    if (isBest) localStorage.setItem("gt_reaction_best", String(stats.avgRt));
    state.lastReaction = { ...stats, isBest };
    go("reaction-result");
  }

  panel.addEventListener("click", () => {
    if (phase === "intro") {
      startRound();
    } else if (phase === "waiting") {
      clearTimeout(reactionTimer);
      phase = "feedback";
      panel.style.background = "#FCE7E5";
      msg.style.color = "#C23B32";
      msg.textContent = "너무 빨랐어요!\n다시 준비할게요";
      reactionTimer = setTimeout(() => startRound(), 900);
    } else if (phase === "go") {
      clearTimeout(reactionTimer);
      const rt = Math.round(performance.now() - stimulusOnset);
      results.push({ type: "go", correct: true, rt });
      phase = "feedback";
      panel.style.background = "#DCF5E8";
      msg.style.color = "#1B8F5C";
      msg.textContent = `${rt}ms ✅`;
      reactionTimer = setTimeout(() => nextRound(), 500);
    } else if (phase === "nogo") {
      clearTimeout(reactionTimer);
      results.push({ type: "nogo", correct: false });
      phase = "feedback";
      panel.style.background = "#FCE7E5";
      msg.style.color = "#C23B32";
      msg.textContent = "앗, 참았어야 해요!";
      reactionTimer = setTimeout(() => nextRound(), 600);
    }
    // "feedback" 단계 클릭은 무시
  });

  updateProgress();
}

function renderReactionResult() {
  const r = state.lastReaction || {
    avgRt: null, rtSD: 0, omissionErrors: 0, commissionErrors: 0,
    goCount: 0, noGoCount: 0, accuracy: 0, isBest: false,
  };
  const bonus = gameBonuses();

  let comment;
  if (r.commissionErrors === 0 && r.omissionErrors === 0) comment = "완벽한 집중력과 충동 조절! 🎯";
  else if (r.commissionErrors >= 2) comment = "충동을 참는 게 오늘은 좀 어려웠나봐요 ⚡";
  else if (r.omissionErrors >= 2) comment = "잠깐씩 집중이 흐트러진 순간이 있었어요 💭";
  else comment = "전반적으로 안정적인 반응이었어요 👍";

  const bonusParts = [];
  if (bonus.impulse > 0) bonusParts.push(`충동 +${bonus.impulse}`);
  if (bonus.focus > 0) bonusParts.push(`집중 +${bonus.focus}`);
  const bonusNote = bonusParts.length
    ? `🎯 이 결과가 방금 본 ADHD 자가진단에 반영돼요 (${bonusParts.join(" · ")}). 결과로 돌아가면 갱신된 점수를 볼 수 있어요.`
    : "🎯 이번엔 추가로 반영된 점수가 없었어요 — 안정적인 결과였어요! 결과 화면은 그대로예요.";

  app.appendChild(el(`
    <div>
      <div class="result-card" style="background:linear-gradient(160deg,#2FCB86,#1B8F5C);">
        <div class="eyebrow">평균 반응속도(Go 라운드 기준)</div>
        <div class="emoji">⚡</div>
        <h2>${r.avgRt !== null ? r.avgRt + "ms" : "측정 안 됨"}</h2>
        <p>${comment}</p>
        ${r.isBest ? '<div class="result-stats"><span>🎉 새 최고기록!</span></div>' : ""}
      </div>
      <div class="meta-chips">
        <div class="meta-chip"><div class="value">${r.accuracy}%</div><div class="label">정확도</div></div>
        <div class="meta-chip"><div class="value">${r.rtSD}ms</div><div class="label">반응 일관성(SD)</div></div>
        <div class="meta-chip"><div class="value">${r.commissionErrors}/${r.noGoCount}</div><div class="label">충동억제 실패</div></div>
        <div class="meta-chip"><div class="value">${r.omissionErrors}/${r.goCount}</div><div class="label">주의력 누락</div></div>
      </div>
      <div class="result-tip">${bonusNote}</div>
      <p class="disclaimer">※ 이 수치는 재미로 보는 참고용이며, 실제 인지검사나 의학적 진단 결과가 아니에요.</p>
      <div class="cta" style="padding-top:10px;">
        <button class="cta-btn" id="retry-btn" style="background:#1FAE6A; box-shadow:0 8px 20px rgba(31,174,106,.32);">다시 도전하기</button>
      </div>
      <button class="retry-btn" data-nav="test-result">🎯 테스트 결과로 돌아가기</button>
    </div>
  `));
  bindNav(app);
  app.querySelector("#retry-btn").addEventListener("click", () => go("reaction-play"));
}

setScreen(pathToScreen(location.pathname), { replace: true });
