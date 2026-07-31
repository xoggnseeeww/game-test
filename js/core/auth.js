// 관리자 로그인: NumPath 마을 동기화(D-55)가 이미 쓰고 있는 공유 Supabase Auth(Google 로그인)를
// 그대로 재사용한다 — 별도 로그인 수단을 새로 붙이지 않는다(D-56). 로그인한 이메일이
// ADMIN_EMAIL과 같은지만 본다. 서버 쪽 권한 검증은 없다(이 프로젝트에 관리자용 백엔드가
// 없다) — "출시 예정" 도구를 가리는 용도로는 충분하고, 실제 민감한 데이터를 지키는
// 용도라면 그때 서버 검증을 새로 둬야 한다.
import { loadCloudAuth } from "./cloud-auth-loader.js";

const ADMIN_EMAIL = "xogns022@gmail.com";
const STORAGE_KEY = "gt_admin_email";

function readStoredEmail() {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch (e) {
    console.error(e);
    return null;
  }
}

// NumPath 마을(village.js)과 같은 패턴(D-54) — 로컬 캐시를 우선 신뢰하고, Supabase 세션을
// 확인할 수 있으면(CDN 연결됨) 그걸로 맞춰 고친다. 오프라인·CDN 차단 상태에서도 직전
// 로그인 상태를 그대로 유지한다.
export let currentEmail = readStoredEmail();

export function isAdmin() {
  return currentEmail === ADMIN_EMAIL;
}

function setCurrentEmail(email) {
  currentEmail = email;
  try {
    if (email) localStorage.setItem(STORAGE_KEY, email);
    else localStorage.removeItem(STORAGE_KEY);
  } catch (e) {
    console.error(e);
  }
}

let onChange = null;

// 로그인/로그아웃으로 상태가 바뀔 때마다 UI(햄버거 메뉴)를 다시 그리도록 알려준다.
export function onAuthChange(fn) {
  onChange = fn;
}

// 부팅 시 한 번 불러 지금 로그인된 계정을 확인한다 — 사이트 전체가 같은 Supabase 세션을
// 공유하므로, NumPath 마을에서 이미 로그인해 뒀을 수도 있다. CDN이 막혀 있으면 로컬 캐시를
// 그대로 둔다.
export function initAuth() {
  loadCloudAuth().then((cloud) => {
    if (!cloud) return;
    const sync = () => {
      const user = cloud.getCachedUser();
      setCurrentEmail(user && user.email === ADMIN_EMAIL ? user.email : null);
      if (onChange) onChange();
    };
    sync();
    cloud.onAuthChange(sync);
  });
}

export function logout() {
  setCurrentEmail(null);
  loadCloudAuth().then((cloud) => cloud && cloud.signOut().catch((err) => console.error("로그아웃 실패", err)));
}

// 햄버거 메뉴의 로그인 버튼을 container 안에 그린다. CDN이 아직 안 붙었거나 막혀 있으면
// 실패 문구만 보여준다 — 메뉴를 열 때마다 다시 시도하므로 재시도는 자연스럽게 된다.
export function renderSignInButton(container) {
  loadCloudAuth().then((cloud) => {
    if (!cloud) {
      container.textContent = "로그인을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.";
      return;
    }
    const btn = document.createElement("button");
    btn.className = "hamburger-signin-btn";
    btn.textContent = "Google로 로그인";
    btn.addEventListener("click", () => {
      cloud.signInWithProvider("google", `${location.origin}/`).catch((err) => console.error("관리자 로그인 실패", err));
    });
    container.appendChild(btn);
  });
}
