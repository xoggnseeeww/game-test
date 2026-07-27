// DOM 생성·이벤트 바인딩·모달 같은 화면 공통 부품.
import { go } from "./router.js";

export function el(html) {
  const t = document.createElement("template");
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

export function bindNav(root) {
  root.querySelectorAll("[data-nav]").forEach((b) => {
    b.addEventListener("click", () => go(b.dataset.nav));
  });
}

// 진행 중인 테스트·게임 화면의 .exit-btn(있으면)을 홈으로 나가는 확인 모달에 연결한다.
// 뒤로가기를 문항 수만큼 눌러야 홈에 갈 수 있던 것의 대안 — 한 번에 나간다.
// onExit은 화면별로 어떤 state를 비울지 다르므로 호출부가 넘긴다.
export function bindExit(root, onExit) {
  const btn = root.querySelector(".exit-btn");
  if (!btn) return;
  btn.addEventListener("click", () => {
    showModal({
      title: "테스트를 그만둘까요?",
      body: "지금까지 답한 내용은 저장되지 않고 사라져요.",
      confirmLabel: "홈으로 나가기",
      cancelLabel: "계속 진행",
      onConfirm: () => {
        onExit();
        go("home");
      },
    });
  });
}

export function showModal({ title, body, confirmLabel = "확인", cancelLabel = "취소", onConfirm }) {
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
