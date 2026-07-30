// 홈 · 심리테스트 목록 · 미니게임 목록.
import { app, listTests, listGames } from "../core/router.js";
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
          <div class="sub">머리 쓰는 잠깐의 퍼즐</div>
        </button>
      </div>
      ${adSlotMarkup("banner", "margin-top:18px; margin-bottom:4px;")}
      <div class="site-footer">
        <a href="https://data-pantry.com" target="_blank" rel="noopener">by 데이터팬트리</a>
        <button class="footer-link-btn" data-nav="privacy">개인정보처리방침</button>
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
    </div>
  `));
  bindNav(app);
}

// 실제로 저장·처리하는 것만 적는다 — 아직 안 하는 걸(계정, 회원 데이터 등) 미리 적어두면
// 나중에 실제로 그 기능이 생겼을 때 방침이 먼저 거짓말이 된다. 부부 체크 짧은 코드
// 도입(D-45)으로 "영속 데이터 없음"이 깨진 예외 하나가 생겨서 이 화면을 만들었다.
export function renderPrivacy() {
  app.appendChild(el(`
    <div>
      <div class="back-row">
        <button class="back-btn" data-nav="home">‹</button>
        <div class="back-title">개인정보처리방침</div>
      </div>
      <div class="legal-block">
        <p class="legal-updated">시행일자: 2026년 7월 30일</p>

        <h3>회원가입이 없습니다</h3>
        <p>과몰입구역은 로그인·회원가입이 없는 서비스입니다. 이름, 이메일, 전화번호 등
        개인을 식별하는 정보를 별도로 수집하지 않습니다.</p>

        <h3>부부 관계 성향 체크의 짧은 매칭 코드 (유일한 예외)</h3>
        <p>부부 관계 성향 체크에서 검사를 마치면, 응답에서 계산된 점수 요약값이 이름 등
        식별자 없이 Cloudflare의 서버 저장소(KV)에 저장되고 8자리 코드로 발급됩니다.
        이 코드는 배우자가 결과를 합쳐 보는 용도로만 쓰입니다.</p>
        <p>이 값은 <b>발급 후 7일이 지나면 자동으로 삭제</b>됩니다. 이름·계정과 연결돼
        있지 않아 "누구의 것인지" 특정할 수 없는 값이라, 만료 전에 별도로 조회하거나
        지우는 절차는 두고 있지 않습니다.</p>

        <h3>그 외 저장하는 것</h3>
        <p>없습니다. 진행 중인 답변은 브라우저 메모리에만 있어서, 새로고침하면 함께
        사라집니다. 기기에 남는 저장값(로컬 스토리지)도 쓰지 않습니다.</p>

        <h3>광고</h3>
        <p>이 사이트는 카카오(다음) AdFit을 통해 광고를 게재합니다. 광고가 표시되는
        과정에서 광고 네트워크가 자체 정책에 따라 쿠키·기기 식별자를 이용할 수 있으며,
        이는 과몰입구역이 직접 수집·보관하는 정보가 아니라 광고 네트워크가 처리하는
        정보입니다.</p>

        <h3>방문 분석</h3>
        <p>Cloudflare Web Analytics로 방문 통계를 확인합니다. 쿠키를 쓰지 않고 개인을
        식별하지 않는 방식입니다.</p>

        <h3>호스팅 인프라 로그</h3>
        <p>Cloudflare Pages로 서비스를 운영하는 특성상, 접속 시 IP 주소 등 표준적인
        서버 로그가 인프라 차원에서 일시적으로 남을 수 있습니다. 과몰입구역이 이
        로그를 별도로 조회하거나 활용하지는 않습니다.</p>

        <h3>만 14세 미만 이용자</h3>
        <p>식별 정보를 수집하지 않으므로 별도의 법정대리인 동의 절차를 두고 있지
        않습니다.</p>

        <h3>문의</h3>
        <p>개인정보 관련 문의는 <a href="mailto:xogns022@gmail.com">xogns022@gmail.com</a>
        으로 연락해 주세요.</p>
      </div>
    </div>
  `));
  bindNav(app);
}

export const commonScreens = [
  { id: "home", path: "/", title: "과몰입구역 - 심리테스트 · 미니게임", render: renderHome },
  { id: "psych-list", path: "/test", title: "심리테스트 | 과몰입구역", render: renderPsychList },
  { id: "game-list", path: "/game", title: "미니게임 | 과몰입구역", render: renderGameList },
  { id: "privacy", path: "/privacy", title: "개인정보처리방침 | 과몰입구역", render: renderPrivacy },
];
