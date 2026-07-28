// 홈 · 심리테스트 목록 · 미니게임 목록.
import { app, listTests } from "../core/router.js";
import { el, bindNav } from "../core/dom.js";
import { adSlotMarkup } from "../core/ads.js";

export function renderHome() {
  app.appendChild(el(`
    <div>
      <div class="header">
        <div class="logo">
          <div class="logo-badge">과</div>
          <div class="logo-text">과몰입구역</div>
        </div>
        <div style="width:34px; height:34px; border-radius:11px; background:#fff; box-shadow:0 2px 8px rgba(0,0,0,.06); display:flex; align-items:center; justify-content:center; color:#75727B; font-size:16px;">☰</div>
      </div>
      ${adSlotMarkup("banner")}
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
      <div class="site-footer">
        <a href="https://data-pantry.com" target="_blank" rel="noopener">by 데이터팬트리</a>
      </div>
    </div>
  `));
  bindNav(app);
}

// 목록 카드는 등록된 테스트에서 뽑아 쓴다. 테스트를 추가할 때 이 파일을 고칠 필요가 없다.
export function renderPsychList() {
  app.appendChild(el(`
    <div>
      <div class="back-row">
        <button class="back-btn" data-nav="home">‹</button>
        <div class="back-title">심리테스트</div>
      </div>
      <div class="section-title">🔥 지금 인기</div>
      <div class="test-list">
        ${listTests().map((t) => `
          <button class="test-card" data-nav="${t.card.screen}">
            <div class="icon" style="background:${t.card.color};">${t.card.emoji}</div>
            <div class="body">
              <div class="name">${t.card.name}</div>
              <div class="desc">${t.card.desc}</div>
            </div>
            <div class="chevron">›</div>
          </button>
        `).join("")}
      </div>
    </div>
  `));
  bindNav(app);
}

export function renderGameList() {
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

export const commonScreens = [
  { id: "home", path: "/", title: "과몰입구역 - 심리테스트 · 미니게임", render: renderHome },
  { id: "psych-list", path: "/test", title: "심리테스트 | 과몰입구역", render: renderPsychList },
  { id: "game-list", path: "/game", title: "미니게임 | 과몰입구역", render: renderGameList },
];
