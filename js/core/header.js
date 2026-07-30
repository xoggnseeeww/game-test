// 사이트 전역 우상단 햄버거 메뉴: 로그인 상태 표시 + Google 로그인/로그아웃.
// #app 밖(document.body)에 한 번만 붙여서, 화면이 바뀌어도(render()가 #app을 통째로
// 지워도) 살아남게 한다 — showModal()과 같은 이유(router.js 참고).
import { el } from "./dom.js";
import { currentEmail, isAdmin, logout, onAuthChange, renderSignInButton } from "./auth.js";

export function initHeader() {
  const root = el(`
    <div class="site-header-menu">
      <button class="hamburger-btn" aria-label="메뉴">☰</button>
      <div class="hamburger-panel"></div>
    </div>
  `);
  document.body.appendChild(root);

  const panel = root.querySelector(".hamburger-panel");

  function renderPanel() {
    panel.innerHTML = "";
    if (currentEmail) {
      panel.appendChild(el(`
        <div class="hamburger-account">
          <div class="hamburger-email">${currentEmail}${isAdmin() ? " · 관리자" : ""}</div>
          <button class="hamburger-logout">로그아웃</button>
        </div>
      `));
      panel.querySelector(".hamburger-logout").addEventListener("click", () => {
        logout();
        renderPanel();
      });
    } else {
      const box = el(`<div class="hamburger-signin"></div>`);
      panel.appendChild(box);
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
}
