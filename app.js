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

// 결과 유형은 총점 합산이 아니라 집중/충동/에너지 3개 축 각각이 "높음/낮음"인지를
// 조합해서 정한다 (DSM-5가 부주의 우세형/과잉행동-충동 우세형/복합형으로 나누는 방식과 동일한 축).
// 한 축만 극단적으로 높아도 나머지 두 축에 묻혀 총점으로는 평범하게 나와버리는 문제를
// 이렇게 축별 프로필로 바꿔서 근본적으로 없앴다.
const AXIS_HIGH_THRESHOLD = 60; // 4문항 평균 응답이 "그렇다"(3점) 이상일 때 대략 나오는 퍼센트

function profileKey({ focus, impulse, energy }) {
  const f = focus >= AXIS_HIGH_THRESHOLD ? 1 : 0;
  const i = impulse >= AXIS_HIGH_THRESHOLD ? 1 : 0;
  const e = energy >= AXIS_HIGH_THRESHOLD ? 1 : 0;
  return `${f}${i}${e}`;
}

const RESULT_TYPES = {
  "000": {
    emoji: "🦉",
    name: "차분한 올빼미형",
    subtitle: "안정형",
    desc: "집중·충동·에너지 3가지 영역 모두 낮게 나왔어요.\n웬만한 자극에는 흔들리지 않고, 하던 일을 제 페이스대로\n끝까지 해내는 편이에요. 딴생각이나 충동적인 행동에\n크게 휘둘리지 않는 게 강점이에요.",
    tip: "지금처럼 안정적인 루틴을 유지하면서, 가끔은 새로운 자극도 즐겨보세요.",
  },
  "100": {
    emoji: "🌫️",
    name: "깜빡깜빡 안개형",
    subtitle: "부주의 우세형",
    desc: "충동적으로 저지르거나 몸이 들썩이진 않지만,\n집중력이 자꾸 흐려지는 게 눈에 띄어요. 물건을 어디 뒀는지\n까먹거나, 대화 중 딴생각에 빠지거나, 하던 일을 끝까지\n마무리하지 못하는 경우가 잦은 편이에요.",
    tip: "체크리스트를 눈에 보이는 곳에 적어두고, 할 일을 잘게 쪼개서 하나씩 지워나가 보세요.",
  },
  "010": {
    emoji: "🔥",
    name: "화끈한 불꽃형",
    subtitle: "충동 우세형",
    desc: "집중력이나 활동량은 평범한 편인데, 순간적인 충동을\n참는 게 유독 어려운 편이에요. 생각나면 바로 행동하거나,\n남의 말이 끝나기 전에 끼어들거나, 기다리는 상황을\n잘 못 견디는 모습이 자주 보여요.",
    tip: "결정하기 전 '10초만 멈추기'를 습관처럼 연습해보세요.",
  },
  "001": {
    emoji: "🐝",
    name: "들썩들썩 에너자이저형",
    subtitle: "과잉행동 우세형",
    desc: "생각이나 판단은 신중한 편인데, 몸이 가만히 있질 못해요.\n회의나 수업 중에도 계속 움직이고 싶고, 새로운 자극이\n없으면 금방 지루해져서 딴짓을 찾는 편이에요.",
    tip: "짧은 스트레칭이나 산책처럼, 에너지를 건강하게 발산할 시간을 일부러 만들어보세요.",
  },
  "110": {
    emoji: "🌀",
    name: "생각 폭주 소용돌이형",
    subtitle: "인지-충동 복합형",
    desc: "몸을 움직이는 건 평범한데, 머릿속은 늘 분주해요.\n집중이 잘 안 되는 동시에 떠오른 생각을 바로 행동에\n옮기는 편이라, 계획했던 것과 다르게 흘러가는 일이 잦아요.",
    tip: "행동하기 전에 딱 한 번, 종이에 적어보는 습관을 들여보세요. 생각을 붙잡아두는 데 도움이 돼요.",
  },
  "101": {
    emoji: "🍃",
    name: "정처 없는 나뭇잎형",
    subtitle: "인지-활동 복합형",
    desc: "충동적으로 저지르진 않지만, 집중력이 흐트러지는 동시에\n몸도 가만히 있질 못해요. 딴생각과 딴짓 사이를 오가느라\n하나에 오래 머무르기가 어려운 편이에요.",
    tip: "한 번에 한 가지 활동만 눈에 보이게 두고, 타이머로 짧게 끊어서 진행해보세요.",
  },
  "011": {
    emoji: "⚡",
    name: "번개 충동 폭풍형",
    subtitle: "충동-활동 복합형",
    desc: "생각이 떠오르면 재고 따지기 전에 먼저 움직이는\n추진력이 강해요. 가만히 있지 못하고 기다리는 상황을\n유독 못 참는 모습도 자주 보여요. 집중력 자체는 평범한\n편이라, 마음만 먹으면 몰입도 잘하는 타입이에요.",
    tip: "중요한 결정 앞에서는 '10초만 멈추기'를 연습하고, 몸을 움직이는 활동으로 에너지를 발산해보세요.",
  },
  "111": {
    emoji: "🌪️",
    name: "종합 태풍형",
    subtitle: "전영역 복합형",
    desc: "집중·충동·에너지 세 영역 모두에서 뚜렷한 특징이\n나타났어요. 생각이 자꾸 흩어지고, 충동적으로 움직이고,\n몸도 가만히 있질 못하는 모습이 함께 나타나는 편이에요.\n세 가지가 겹치면 일상에서 꽤 힘들게 느껴질 수 있어요.",
    tip: "혼자 다 해결하려 하기보다, 전문가와 함께 우선순위부터 정리해보는 것도 좋은 방법이에요.",
  },
};

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
  "test-intro": "성인 ADHD 성향 체크 | 과몰입구역",
  "test-question": "성인 ADHD 성향 체크 - 진행 중 | 과몰입구역",
  "test-result": "성인 ADHD 성향 체크 결과 | 과몰입구역",
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
            <div class="name">성인 ADHD 성향 체크</div>
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
        <div class="tag">집중력 성향 체크</div>
        <h2>성인 ADHD<br/>성향 체크</h2>
        <p>요즘 유독 집중이 안 되고<br/>깜빡깜빡한다면?</p>
      </div>
      <div class="meta-chips">
        <div class="meta-chip"><div class="value">${QUESTIONS.length}문항</div><div class="label">약 1분</div></div>
        <div class="meta-chip"><div class="value">${Object.keys(RESULT_TYPES).length}가지</div><div class="label">결과 유형</div></div>
      </div>
      <p class="disclaimer">본 테스트는 재미를 위한 성향 체크이며, 의학적 진단이 아닙니다.</p>
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
  const raw = { focus: 0, impulse: 0, energy: 0 };
  state.answers.forEach((a) => {
    raw[a.group] += a.value;
  });
  const bonus = gameBonuses();
  const toPct = (v) => Math.min(100, Math.round((v / 16) * 100));

  // 게임 보너스를 더하기 전/후 퍼센트를 따로 계산해서, 이미 100%라 더 올라갈 데가
  // 없는 축에는 실제로 반영되지 않은 보너스를 "반영됐다"고 표시하지 않는다.
  const prePct = { focus: toPct(raw.focus), impulse: toPct(raw.impulse), energy: toPct(raw.energy) };
  const pct = {
    focus: toPct(raw.focus + bonus.focus),
    impulse: toPct(raw.impulse + bonus.impulse),
    energy: prePct.energy,
  };
  const visibleBonus = {
    focus: pct.focus > prePct.focus ? bonus.focus : 0,
    impulse: pct.impulse > prePct.impulse ? bonus.impulse : 0,
  };

  const type = RESULT_TYPES[profileKey(pct)];
  return {
    type,
    focus: pct.focus,
    impulse: pct.impulse,
    energy: pct.energy,
    bonus: visibleBonus,
  };
}

// 유형 이름/부제가 이미 "어떤 축이 높은지"를 알려주지만, 실제 숫자로 한 번 더 짚어서
// 결과가 실제 답변에서 나온 것임을 보여준다. (버그였던 부분: 예전엔 1·2위 축의 차이만
// 봐서 [100,100,0]처럼 두 축이 동시에 극단일 때도 "고르다"고 잘못 말했다 — 이제 전체
// 축의 최댓값-최솟값 편차를 보고, 공동 1위가 있으면 그것도 그대로 알려준다.)
function dominantTraitNote(r) {
  const axes = [
    { label: "집중력", pct: r.focus, note: "특히 깜빡하거나 딴생각에 잘 빠지는 경향이 두드러졌어요." },
    { label: "충동성", pct: r.impulse, note: "특히 생각보다 행동이 앞서는 충동적인 경향이 두드러졌어요." },
    { label: "에너지", pct: r.energy, note: "특히 가만히 있지 못하고 움직이려는 에너지가 두드러졌어요." },
  ];
  const maxPct = Math.max(...axes.map((a) => a.pct));
  const minPct = Math.min(...axes.map((a) => a.pct));
  if (maxPct - minPct < 15) {
    return "이번 결과에서는 세 영역이 비교적 고르게 나타났어요.";
  }
  const top = axes.filter((a) => a.pct === maxPct);
  if (top.length > 1) {
    return `이번 결과에서는 ${top.map((a) => a.label).join(" · ")} 영역이 나란히 가장 두드러졌어요.`;
  }
  return `이번 결과에서는 ${top[0].label}(${top[0].pct}%) 영역이 가장 두드러졌어요. ${top[0].note}`;
}

function renderResult() {
  const r = computeResult();
  app.appendChild(el(`
    <div>
      <div class="result-card">
        <div class="eyebrow">나의 집중 유형은</div>
        <div class="emoji">${r.type.emoji}</div>
        <h2>${r.type.name}</h2>
        <div class="result-subtitle">${r.type.subtitle}</div>
        <p>${r.type.desc}</p>
        <div class="result-stats">
          <span>집중 ${r.focus}</span><span class="sep">·</span>
          <span>충동 ${r.impulse}</span><span class="sep">·</span>
          <span>에너지 ${r.energy}</span>
        </div>
        ${r.bonus.impulse > 0 || r.bonus.focus > 0 ? `<div class="result-stats" style="margin-top:8px;"><span>⚡ 반응·주의력 게임 결과 반영됨${r.bonus.impulse > 0 ? ` · 충동 +${r.bonus.impulse}` : ""}${r.bonus.focus > 0 ? ` · 집중 +${r.bonus.focus}` : ""}</span></div>` : ""}
      </div>

      <p class="result-dominant">🔍 ${dominantTraitNote(r)}</p>

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

// 프라이버시 모드 등에서 localStorage 접근 자체가 throw할 수 있어 방어한다.
function bestReactionTime() {
  try {
    const v = localStorage.getItem("gt_reaction_best");
    return v ? parseInt(v, 10) : null;
  } catch {
    return null;
  }
}

function saveBestReactionTime(ms) {
  try {
    localStorage.setItem("gt_reaction_best", String(ms));
  } catch {
    // 저장 실패는 무시 — 이번 세션 결과 표시에는 영향 없음
  }
}

function renderReactionIntro() {
  const best = bestReactionTime();
  app.appendChild(el(`
    <div>
      <div class="back-row">
        <button class="back-btn" data-nav="test-result">‹</button>
        <div class="back-title">성인 ADHD 성향 체크</div>
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
    if (isBest) saveBestReactionTime(stats.avgRt);
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

// 억제 실패(commissionErrors)와 누락(omissionErrors)을 각각 따로만 보지 않고
// 두 축의 조합으로 코멘트를 골라서, 단순 반응속도 하나보다 더 구체적인 피드백을 준다.
function reactionComment(r) {
  const highCommission = r.commissionErrors >= 2;
  const someCommission = r.commissionErrors === 1;
  const highOmission = r.omissionErrors >= 2;
  const someOmission = r.omissionErrors === 1;

  if (!highCommission && !someCommission && !highOmission && !someOmission) {
    return "완벽한 집중력과 충동 조절! 참을 때 참고, 반응할 때 반응했어요 🎯";
  }
  if (highCommission && highOmission) {
    return "참아야 할 때 못 참고, 반응해야 할 땐 놓치고… 오늘따라 컨디션이 안 맞았나봐요 😅";
  }
  if (highCommission) {
    return "반응은 빠른 편인데, 멈춰야 할 때 브레이크가 잘 안 걸리는 편이에요 ⚡";
  }
  if (highOmission) {
    return "신중한 편이지만, 그만큼 놓치는 순간도 좀 있었어요 💭";
  }
  if (someCommission) {
    return "대체로 안정적인데, 딱 한 번 성급하게 반응했어요";
  }
  if (someOmission) {
    return "대체로 안정적인데, 딱 한 번 반응을 놓쳤어요";
  }
  return "전반적으로 안정적인 반응이었어요 👍";
}

function renderReactionResult() {
  const r = state.lastReaction || {
    avgRt: null, rtSD: 0, omissionErrors: 0, commissionErrors: 0,
    goCount: 0, noGoCount: 0, accuracy: 0, isBest: false,
  };
  const bonus = gameBonuses();

  const comment = reactionComment(r);

  const bonusParts = [];
  if (bonus.impulse > 0) bonusParts.push(`충동 +${bonus.impulse}`);
  if (bonus.focus > 0) bonusParts.push(`집중 +${bonus.focus}`);
  const bonusNote = bonusParts.length
    ? `🎯 이 결과가 방금 본 ADHD 성향 체크에 반영돼요 (${bonusParts.join(" · ")}). 결과로 돌아가면 갱신된 점수를 볼 수 있어요.`
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
      <p class="result-dominant">정확도: 알맞게 반응한 비율 · 일관성(SD): 반응속도가 얼마나 고르게 나왔는지(낮을수록 안정적) · 억제 실패: 참아야 할 때 누른 횟수 · 누락: 반응해야 할 때 놓친 횟수</p>
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
