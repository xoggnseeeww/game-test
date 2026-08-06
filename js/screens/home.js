// 홈 · 심리테스트 목록 · 미니게임 목록.
import { app, go, onLeave, listTests, listGames, listLearning } from "../core/router.js";
import { el, bindNav } from "../core/dom.js";
import { adSlotMarkup } from "../core/ads.js";
import { currentEmail, currentName, isAdmin, logout, onAuthChange, renderSignInButton } from "../core/auth.js";
import { state } from "../core/state.js";

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
        <button class="category-card" style="background:#FFF3E4;" data-nav="learning-list">
          <div class="icon" style="background:#FF9F45;">🗣️</div>
          <div class="title">학습</div>
          <div class="sub">듣고 따라 말하는 영어</div>
        </button>
      </div>
      <div class="site-footer">
        <a href="https://data-pantry.com" target="_blank" rel="noopener">by 데이터팬트리</a>
        <button class="footer-link-btn" data-nav="privacy">개인정보처리방침</button>
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
              <div class="name">${t.card.name}${t.card.comingSoon && !isAdmin() ? ` <span class="coming-soon-badge">출시 예정</span>` : ""}</div>
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

// 목록 카드는 등록된 학습 도구에서 뽑아 쓴다(renderGameList와 같은 패턴). 도구 하나(기초
// 영어회화)의 내부 챕터(목차)는 여기 안 나온다 — 그건 그 도구 화면 안에서 보여준다.
export function renderLearningList() {
  const tools = listLearning();
  app.appendChild(el(`
    <div>
      <div class="back-row">
        <button class="back-btn" data-nav="home">‹</button>
        <div class="back-title">학습</div>
      </div>
      ${adSlotMarkup("bannerTop", "margin-top:10px; margin-bottom:4px;")}
      ${
        tools.length === 0
          ? `
      <div class="empty-state">
        <div class="emoji">🛠️</div>
        <div class="msg">준비 중인 학습이 있어요<br/>조금만 기다려주세요!</div>
      </div>`
          : `
      <div class="section-title">🔥 지금 인기</div>
      <div class="test-list">
        ${tools.map((t) => `
          <button class="test-card" data-nav="${t.card.screen}">
            <div class="icon" style="background:${t.card.color};">${t.card.emoji}</div>
            <div class="body">
              <div class="name">${t.card.name}</div>
              <div class="desc">${t.card.desc}</div>
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

// 로그인 상태·학습 진행률을 한눈에 확인하는 화면(D-70) — "로그인이 됐는지 안 됐는지
// 확인이 안 된다"는 피드백으로 추가했다. 학습 도구가 늘어도 이 파일을 고칠 필요가 없도록
// (renderLearningList와 같은 이유) 챕터 제목까지는 안 보여주고 state.learning을 도구에
// 무관하게 집계만 한다 — 개별 학습 도구를 import하지 않는다.
export function renderMyPage() {
  app.appendChild(el(`
    <div>
      <div class="back-row">
        <button class="back-btn" data-nav="home">‹</button>
        <div class="back-title">마이페이지</div>
      </div>
      <div id="mypage-account" class="mypage-account"></div>
      <div class="section-title">📚 학습 진행</div>
      <div id="mypage-learning" class="legal-block"></div>
    </div>
  `));
  bindNav(app);

  const accountEl = app.querySelector("#mypage-account");
  const learningEl = app.querySelector("#mypage-learning");

  function renderAccount() {
    accountEl.innerHTML = "";
    if (currentEmail) {
      accountEl.appendChild(el(`
        <div class="hamburger-account">
          <div class="hamburger-email">${currentName || currentEmail}${isAdmin() ? " · 관리자" : ""}</div>
          ${currentName ? `<div class="hamburger-email-sub">${currentEmail}</div>` : ""}
          <button class="hamburger-logout" id="mypage-logout">로그아웃</button>
        </div>
      `));
      accountEl.querySelector("#mypage-logout").addEventListener("click", () => {
        logout();
        renderAccount();
        renderLearning();
      });
    } else {
      const box = el(`<div class="hamburger-signin"></div>`);
      accountEl.appendChild(box);
      renderSignInButton(box);
    }
  }

  function renderLearning() {
    const entries = Object.entries(state.learning);
    const total = entries.reduce((sum, [, ch]) => sum + ch.index, 0);
    // weak는 elementary-conversation처럼 "헷갈렸던 문장" 자가진단이 있는 도구만 채운다
    // (D-77 후속) — 그 챕터 완료 화면을 그냥 나가버리면 복습 진입로가 사라지는 문제라,
    // 도구에 무관하게 총합만 여기 한 번 더 보여준다. 개별 도구를 import하지 않고
    // state.learning 모양(weak가 있으면 { [문장id]: true })만 본다 — renderLearning의
    // "챕터 제목은 안 본다" 원칙과 같다.
    const weakTotal = entries.reduce((sum, [, ch]) => sum + Object.keys(ch.weak || {}).length, 0);
    learningEl.innerHTML = entries.length === 0
      ? `<div class="empty-state">
           <div class="emoji">📚</div>
           <div class="msg">아직 진행한 학습이 없어요</div>
         </div>
         <div class="cta"><button class="cta-btn" id="mypage-go-learning">학습하러 가기</button></div>`
      : `<p>진행 중인 챕터 ${entries.length}개 · 완료한 문장 총 ${total}개</p>
         ${weakTotal > 0 ? `<p>🔁 헷갈렸던 문장 ${weakTotal}개가 남아 있어요 — 해당 단계를 한 번 더 끝까지 풀면 "헷갈렸던 문장만 복습하기"가 다시 떠요.</p>` : ""}
         <p>${currentEmail ? "로그인 상태라 진행 상황이 계정에 저장돼요." : "로그인하면 진행 상황이 기기를 바꿔도 이어져요."}</p>
         <div class="cta"><button class="cta-btn" id="mypage-go-learning">이어하기</button></div>`;
    learningEl.querySelector("#mypage-go-learning").addEventListener("click", () => go("learning-list"));
  }

  renderAccount();
  renderLearning();
  // 로그인·로그아웃이 다른 경로(햄버거 메뉴)에서 일어나도 이 화면이 열려 있는 동안은
  // 같이 갱신되게 구독한다. onLeave에 등록해 화면을 떠나면 리스너가 쌓이지 않게 한다.
  onLeave(onAuthChange(() => {
    renderAccount();
    renderLearning();
  }));
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
        <p class="legal-updated">시행일자: 2026년 8월 4일</p>

        <h3>일반 이용자는 회원가입이 없습니다</h3>
        <p>과몰입구역의 테스트·게임 이용에는 로그인·회원가입이 필요 없습니다. 이름, 전화번호 등
        개인을 식별하는 정보를 별도로 수집하지 않습니다.</p>

        <h3>우측 상단 Google 로그인 (선택 사항)</h3>
        <p>우측 상단 메뉴의 Google 로그인은 선택 사항입니다. 로그인 없이도 모든 테스트·게임·
        학습 콘텐츠를 그대로 이용할 수 있습니다. 로그인하면 Google이 전달하는 이메일 주소가
        이용 중인 기기의 브라우저 저장소(로컬 스토리지)에 남고, 로그아웃하면 즉시 지워집니다.
        이 이메일 자체는 과몰입구역이 별도로 저장하지 않습니다 — 로그인 처리는 data-pantry.com과
        공유하는 Google 인증 서비스(Supabase Auth)가 담당합니다.</p>

        <h3>학습 진행률 저장 (로그인 시에만)</h3>
        <p>로그인한 상태로 학습 카테고리(예: 기초 영어회화)를 이용하면, 몇 번째 문장까지
        진행했는지가 계정에 연결돼 서버(Supabase)에 저장됩니다 — 다른 기기·다른 방문에서
        이어서 볼 수 있게 하기 위해서입니다. 저장되는 값은 챕터별 진행 위치뿐이고, 음성으로
        말한 내용이나 발음 점수는 저장되지 않습니다. 이 데이터는 본인 계정으로만 조회·수정
        가능하도록 접근이 제한돼 있습니다. 로그인하지 않으면 이 저장은 일어나지 않고, 진행
        상황은 새로고침하면 사라집니다.</p>

        <h3>부부 관계 성향 체크의 짧은 매칭 코드</h3>
        <p>부부 관계 성향 체크에서 검사를 마치면, 응답에서 계산된 점수 요약값이 이름 등
        식별자 없이 Cloudflare의 서버 저장소(KV)에 저장되고 8자리 코드로 발급됩니다.
        이 코드는 배우자가 결과를 합쳐 보는 용도로만 쓰입니다.</p>
        <p>이 값은 <b>발급 후 7일이 지나면 자동으로 삭제</b>됩니다. 이름·계정과 연결돼
        있지 않아 "누구의 것인지" 특정할 수 없는 값이라, 만료 전에 별도로 조회하거나
        지우는 절차는 두고 있지 않습니다.</p>

        <h3>그 외 저장하는 것</h3>
        <p>위에 적은 것(로그인 이메일, 로그인 시의 학습 진행률, 부부 체크 매칭 코드) 외에는
        없습니다. 로그인하지 않은 상태에서의 진행 중인 답변은 브라우저 메모리에만 있어서,
        새로고침하면 함께 사라집니다.</p>

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
  { id: "learning-list", path: "/learning", title: "학습 | 과몰입구역", render: renderLearningList },
  { id: "privacy", path: "/privacy", title: "개인정보처리방침 | 과몰입구역", render: renderPrivacy },
  { id: "mypage", path: "/mypage", title: "마이페이지 | 과몰입구역", render: renderMyPage },
];
