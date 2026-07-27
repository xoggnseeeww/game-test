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
