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

const state = {
  screen: "home",
  answers: [],
  lastReaction: null,
};

const app = document.getElementById("app");
let reactionTimer = null;

function render() {
  app.innerHTML = "";
  switch (state.screen) {
    case "home": return renderHome();
    case "psych-list": return renderPsychList();
    case "test-intro": return renderTestIntro();
    case "test-question": return renderQuestion();
    case "test-result": return renderResult();
    case "game-list": return renderGameList();
    case "reaction-intro": return renderReactionIntro();
    case "reaction-play": return renderReactionPlay();
    case "reaction-result": return renderReactionResult();
  }
}

function go(screen) {
  if (reactionTimer) {
    clearTimeout(reactionTimer);
    reactionTimer = null;
  }
  state.screen = screen;
  render();
  window.scrollTo(0, 0);
}

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
    state.answers = [];
    go("test-question");
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

function computeResult() {
  const totals = { focus: 0, impulse: 0, energy: 0 };
  state.answers.forEach((a) => {
    totals[a.group] += a.value;
  });
  const total = totals.focus + totals.impulse + totals.energy;
  const type = RESULT_TYPES.find((t) => total <= t.max) || RESULT_TYPES[RESULT_TYPES.length - 1];
  const toPct = (v) => Math.round((v / 16) * 100);
  return {
    type,
    focus: toPct(totals.focus),
    impulse: toPct(totals.impulse),
    energy: toPct(totals.energy),
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
      </div>

      <div class="result-tip">💡 ${r.type.tip}</div>

      <div class="share-block">
        <div class="share-title">친구는 무슨 유형일까? 👀</div>
        <div class="share-kakao">💬 카카오톡으로 결과 공유</div>
        <div class="share-row">
          <div class="share-mini">🔗 링크 복사</div>
          <div class="share-mini">🖼️ 이미지 저장</div>
        </div>
        <p class="share-note">공유 기능은 준비 중이에요</p>
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
}

function renderGameList() {
  app.appendChild(el(`
    <div>
      <div class="back-row">
        <button class="back-btn" data-nav="home">‹</button>
        <div class="back-title">미니게임</div>
      </div>
      <div class="section-title">🔥 지금 인기</div>
      <div class="test-list">
        <button class="test-card" data-nav="reaction-intro">
          <div class="icon" style="background:#1FAE6A;">⚡</div>
          <div class="body">
            <div class="name">반응속도 게임</div>
            <div class="desc">초록불이 뜨면 최대한 빨리 탭하기</div>
          </div>
          <div class="chevron">›</div>
        </button>
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
        <button class="back-btn" data-nav="game-list">‹</button>
        <div class="back-title">미니게임</div>
      </div>
      <div class="cover" style="background:linear-gradient(160deg,#2FCB86,#1B8F5C);">
        <div class="emoji">⚡</div>
        <div class="tag">반응속도 테스트</div>
        <h2>반응속도 게임</h2>
        <p>화면이 초록색으로 바뀌는 순간<br/>최대한 빨리 탭하세요!</p>
      </div>
      <div class="meta-chips">
        <div class="meta-chip"><div class="value">1회</div><div class="label">측정</div></div>
        <div class="meta-chip"><div class="value">${best !== null ? best + "ms" : "-"}</div><div class="label">내 최고기록</div></div>
        <div class="meta-chip"><div class="value">ms</div><div class="label">측정 단위</div></div>
      </div>
      <p class="disclaimer">너무 일찍 탭하면 반칙이에요. 초록색이 뜬 다음에 탭하세요!</p>
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
        <button class="back-btn" data-nav="game-list">‹</button>
        <div class="back-title">반응속도 게임</div>
      </div>
      <div id="game-panel" class="game-panel">
        <div id="game-msg" class="game-msg">화면을 터치해서 시작하세요</div>
      </div>
    </div>
  `));
  app.querySelector("[data-nav]").addEventListener("click", () => go("game-list"));

  const panel = app.querySelector("#game-panel");
  const msg = app.querySelector("#game-msg");
  let phase = "idle"; // idle -> waiting -> ready
  let startTime = 0;

  function toWaiting() {
    phase = "waiting";
    panel.style.background = "#E3564C";
    msg.style.color = "#fff";
    msg.textContent = "곧 초록색으로 바뀌어요...\n집중하세요!";
    const delay = 1200 + Math.random() * 2200;
    reactionTimer = setTimeout(() => {
      phase = "ready";
      startTime = performance.now();
      panel.style.background = "#1FAE6A";
      msg.textContent = "지금 클릭!";
    }, delay);
  }

  panel.addEventListener("click", () => {
    if (phase === "idle") {
      toWaiting();
    } else if (phase === "waiting") {
      clearTimeout(reactionTimer);
      reactionTimer = null;
      phase = "idle";
      panel.style.background = "#FCE7E5";
      msg.style.color = "#C23B32";
      msg.textContent = "너무 빨랐어요!\n다시 눌러서 도전하세요";
    } else if (phase === "ready") {
      const time = Math.round(performance.now() - startTime);
      const best = bestReactionTime();
      const isBest = best === null || time < best;
      if (isBest) localStorage.setItem("gt_reaction_best", String(time));
      state.lastReaction = { time, isBest };
      go("reaction-result");
    }
  });
}

function renderReactionResult() {
  const r = state.lastReaction || { time: 0, isBest: false };
  let comment;
  if (r.time < 200) comment = "치타 뺨치는 반사신경! 🐆";
  else if (r.time < 250) comment = "상위권 반응속도예요! 👏";
  else if (r.time < 320) comment = "평균적인 반응속도예요.";
  else if (r.time < 400) comment = "조금 여유로운 편이네요.";
  else comment = "다음엔 더 집중해볼까요?";

  app.appendChild(el(`
    <div>
      <div class="result-card" style="background:linear-gradient(160deg,#2FCB86,#1B8F5C);">
        <div class="eyebrow">내 반응속도는</div>
        <div class="emoji">⚡</div>
        <h2>${r.time}ms</h2>
        <p>${comment}</p>
        ${r.isBest ? '<div class="result-stats"><span>🎉 새 최고기록!</span></div>' : ""}
      </div>
      <div class="cta" style="padding-top:20px;">
        <button class="cta-btn" id="retry-btn" style="background:#1FAE6A; box-shadow:0 8px 20px rgba(31,174,106,.32);">다시 도전하기</button>
      </div>
      <button class="retry-btn" data-nav="game-list">🎮 다른 게임 보러가기</button>
    </div>
  `));
  bindNav(app);
  app.querySelector("#retry-btn").addEventListener("click", () => go("reaction-play"));
}

render();
