// 관리자 로그인: Google Identity Services로 로그인한 이메일이 관리자 이메일과 같은지만 본다.
// 서버가 없어서 토큰 서명 검증은 안 한다 — "출시 예정" 도구를 가리는 용도라, 그 이상의
// 보안(진짜 민감한 데이터 보호)이 필요해지면 그때 백엔드 검증을 새로 둬야 한다.
const ADMIN_EMAIL = "xogns022@gmail.com";
// TODO: Google Cloud Console에서 발급받은 실제 Client ID로 교체해야 로그인 버튼이 동작한다.
// 승인된 JavaScript 원본(Authorized JavaScript origins)에 https://fun.data-pantry.com과
// 로컬 개발 주소(예: http://localhost:8766, http://localhost:8788)를 등록해야 한다.
export const GOOGLE_CLIENT_ID = "REPLACE_WITH_GOOGLE_CLIENT_ID.apps.googleusercontent.com";

const STORAGE_KEY = "gt_admin_email";

function readStoredEmail() {
  if (typeof localStorage === "undefined") return null;
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch (e) {
    console.error(e);
    return null;
  }
}

export let currentEmail = readStoredEmail();

export function isAdmin() {
  return currentEmail === ADMIN_EMAIL;
}

export function logout() {
  currentEmail = null;
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (e) {
    console.error(e);
  }
}

function decodeVerifiedEmail(credential) {
  const payload = credential.split(".")[1];
  const json = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
  const data = JSON.parse(json);
  return data.email_verified ? data.email : null;
}

let onChange = null;

// 로그인/로그아웃으로 상태가 바뀔 때마다 UI(햄버거 메뉴)를 다시 그리도록 알려준다.
export function onAuthChange(fn) {
  onChange = fn;
}

function handleCredential(response) {
  const email = decodeVerifiedEmail(response.credential);
  if (!email) return;
  currentEmail = email;
  try {
    localStorage.setItem(STORAGE_KEY, email);
  } catch (e) {
    console.error(e);
  }
  if (onChange) onChange();
}

// Google 로그인 버튼을 container 안에 그린다. GIS 스크립트(index.html)가 아직 로드되기
// 전이면 실패 문구만 보여준다 — 메뉴를 열 때마다 다시 시도하므로 재시도는 자연스럽게 된다.
export function renderSignInButton(container) {
  if (typeof window === "undefined" || !window.google) {
    container.textContent = "로그인을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.";
    return;
  }
  window.google.accounts.id.initialize({ client_id: GOOGLE_CLIENT_ID, callback: handleCredential });
  window.google.accounts.id.renderButton(container, { theme: "outline", size: "medium" });
}
