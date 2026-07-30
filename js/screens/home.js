// 홈 · 심리테스트 목록 · 미니게임 목록.
import { app, listTests, listGames } from "../core/router.js";
import { el, bindNav } from "../core/dom.js";
import { adSlotMarkup } from "../core/ads.js";

// 하단 배너(bannerBottom)는 폰 화면에서 뷰포트 맨 아래에 고정된다(.home-ad-dock,
// styles.css) — 모바일 앱의 "하단 고정 배너"처럼 스크롤과 무관하게 항상 보이는
// 자리다. 가려지는 콘텐츠가 없도록 .home-screen에 그 높이만큼 하단 여백을 미리 둔다.
// 데스크톱(카드 레이아웃)에서는 카드 폭 밖으로 삐져나가 보이므로 일반 흐름으로 되돌린다.
export function renderHome() {
  app.appendChild(el(`
    <div class="home-screen">
      <div class="header">
        <div class="logo">
          <div class="logo-badge">과</div>
          <div class="logo-text">과몰입구역</div>
        </div>
      </div>
      ${adSlotMarkup("bannerTop")}
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
          <div class="sub">머리 쓰는 잠깐의 퍼즐</div>
        </button>
      </div>
      <div class="site-footer">
        <a href="https://data-pantry.com" target="_blank" rel="noopener">by 데이터팬트리</a>
      </div>
      <div class="home-ad-dock">${adSlotMarkup("bannerBottom")}</div>
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
      ${adSlotMarkup("bannerTop", "margin-top:10px; margin-bottom:4px;")}
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
      ${adSlotMarkup("bannerBottom", "margin-top:6px; margin-bottom:22px;")}
    </div>
  `));
  bindNav(app);
}

// 목록 카드는 등록된 게임에서 뽑아 쓴다(renderPsychList와 같은 패턴) — 게임을 추가할 때
// 이 파일을 고칠 필요가 없다. 반응속도·딜레마 게임은 테스트 점수에 반영되는 하위 단계라
// 여기 넣지 않는다(guard가 테스트 인트로로 되돌려버린다) — registerGame()된 것만 나온다.
export function renderGameList() {
  const games = listGames();
  app.appendChild(el(`
    <div>
      <div class="back-row">
        <button class="back-btn" data-nav="home">‹</button>
        <div class="back-title">미니게임</div>
      </div>
      ${adSlotMarkup("bannerTop", "margin-top:10px; margin-bottom:4px;")}
      ${
        games.length === 0
          ? `
      <div class="empty-state">
        <div class="emoji">🛠️</div>
        <div class="msg">준비 중인 게임이 있어요<br/>조금만 기다려주세요!</div>
      </div>`
          : `
      <div class="section-title">🔥 지금 인기</div>
      <div class="test-list">
        ${games.map((g) => `
          <button class="test-card" data-nav="${g.card.screen}">
            <div class="icon" style="background:${g.card.color};">${g.card.emoji}</div>
            <div class="body">
              <div class="name">${g.card.name}</div>
              <div class="desc">${g.card.desc}</div>
            </div>
            <div class="chevron">›</div>
          </button>
        `).join("")}
      </div>`
      }
      ${adSlotMarkup("bannerBottom", "margin-top:6px; margin-bottom:22px;")}
    </div>
  `));
  bindNav(app);
}

export const commonScreens = [
  { id: "home", path: "/", title: "과몰입구역 - 심리테스트 · 미니게임", render: renderHome },
  { id: "psych-list", path: "/test", title: "심리테스트 | 과몰입구역", render: renderPsychList },
  { id: "game-list", path: "/game", title: "미니게임 | 과몰입구역", render: renderGameList },
];
