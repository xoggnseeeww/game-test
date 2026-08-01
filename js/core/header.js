// 사이트 전역 우상단 햄버거 메뉴: 로그인 상태 표시 + Google 로그인/로그아웃.
// #app 밖(document.body)에 한 번만 붙여서, 화면이 바뀌어도(render()가 #app을 통째로
// 지워도) 살아남게 한다 — showModal()과 같은 이유(router.js 참고).
import { el, goHome } from "./dom.js";
import { currentEmail, isAdmin, initAuth, logout, onAuthChange, renderSignInButton } from "./auth.js";

export function initHeader() {
  const root = el(`
    <div class="site-header-menu">
      <button class="hamburger-btn" aria-label="메뉴">☰</button>
      <div class="hamburger-panel">
        <button class="hamburger-home">🏠 홈으로 가기</button>
      </div>
    </div>
  `);
  document.body.appendChild(root);

  const panel = root.querySelector(".hamburger-panel");
  const accountBox = el(`<div class="hamburger-account-box"></div>`);
  panel.appendChild(accountBox);

  panel.querySelector(".hamburger-home").addEventListener("click", () => {
    root.classList.remove("open");
    goHome();
  });

  // initAuth()가 Supabase 세션을 확인하는 동안 sync()가 여러 번 불릴 수 있다(초기 확인 1회 +
  // onAuthStateChange의 INITIAL_SESSION 등). 상태가 실제로 안 바뀌었는데도 매번 로그인
  // 버튼을 통째로 지우고 새로 그리면, 사용자가 막 렌더된 버튼을 클릭하는 순간 그 버튼이
  // 이미 교체되어 클릭이 허공에 뜨는 경우가 생긴다 — 이전 렌더와 이메일이 같으면 건너뛴다.
  let lastRenderedEmail;
  function renderPanel() {
    if (lastRenderedEmail === currentEmail) return;
    lastRenderedEmail = currentEmail;
    accountBox.innerHTML = "";
    if (currentEmail) {
      accountBox.appendChild(el(`
        <div class="hamburger-account">
          <div class="hamburger-email">${currentEmail}${isAdmin() ? " · 관리자" : ""}</div>
          <button class="hamburger-logout">로그아웃</button>
        </div>
      `));
      accountBox.querySelector(".hamburger-logout").addEventListener("click", () => {
        logout();
        renderPanel();
      });
    } else {
      const box = el(`<div class="hamburger-signin"></div>`);
      accountBox.appendChild(box);
      renderSignInButton(box);
    }
  }

  root.querySelector(".hamburger-btn").addEventListener("click", () => {
    const opening = !root.classList.contains("open");
    root.classList.toggle("open", opening);
    if (opening) renderPanel();
  });

  document.addEventListener("click", (e) => {
    if (!root.contains(e.target)) root.classList.remove("open");
  });

  onAuthChange(renderPanel);
  initAuth();
}
