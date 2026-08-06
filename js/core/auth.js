// 일반 방문자 로그인: NumPath 마을 동기화(D-55)가 쓰던 공유 Supabase Auth(Google 로그인)를
// 모든 방문자에게 연다 — 별도 로그인 수단을 새로 붙이지 않는다. 로그인한 이메일이
// ADMIN_EMAIL과 같은지는 isAdmin()에서만 별도로 판별한다("출시 예정" 도구 게이트용, D-56).
// 서버 쪽 권한 검증은 없다 — 관리자 게이트 용도로는 충분하지만, 로그인 자체는 학습 진행률
// 저장(js/learning/cloud.js) 같은 일반 기능의 전제가 된다(D-68).
import { loadCloudAuth } from "./cloud-auth-loader.js";

const ADMIN_EMAIL = "xogns022@gmail.com";
const STORAGE_KEY = "gt_user_email";
const NAME_STORAGE_KEY = "gt_user_name";

function readStored(key) {
  try {
    return localStorage.getItem(key);
  } catch (e) {
    console.error(e);
    return null;
  }
}

// NumPath 마을(village.js)과 같은 패턴(D-54) — 로컬 캐시를 우선 신뢰하고, Supabase 세션을
// 확인할 수 있으면(CDN 연결됨) 그걸로 맞춰 고친다. 오프라인·CDN 차단 상태에서도 직전
// 로그인 상태를 그대로 유지한다.
export let currentEmail = readStored(STORAGE_KEY);
// Google 계정의 표시 이름(user_metadata.full_name/name) — 로그인 UI에 이메일 대신
// 이름을 보여달라는 요청(D-71)으로 추가. 구글이 이름을 안 주는 계정도 있어 폴백은
// 항상 currentEmail이다.
export let currentName = readStored(NAME_STORAGE_KEY);

export function isAdmin() {
  return currentEmail === ADMIN_EMAIL;
}

function setCurrentUser(email, name) {
  currentEmail = email;
  currentName = name;
  try {
    if (email) localStorage.setItem(STORAGE_KEY, email);
    else localStorage.removeItem(STORAGE_KEY);
    if (name) localStorage.setItem(NAME_STORAGE_KEY, name);
    else localStorage.removeItem(NAME_STORAGE_KEY);
  } catch (e) {
    console.error(e);
  }
}

// 로그인/로그아웃으로 상태가 바뀔 때마다 구독자들(햄버거 메뉴, 마이페이지)에게 알려준다.
// cloud-auth.js의 pub-sub과 같은 이유로 Set을 쓴다 — 구독자가 하나뿐이던 시절엔 변수
// 하나로 충분했지만, 마이페이지(D-70)가 두 번째로 구독하면서 마지막 등록만 살아남는
// 버그가 될 뻔했다.
const changeListeners = new Set();
export function onAuthChange(fn) {
  changeListeners.add(fn);
  return () => changeListeners.delete(fn);
}

// 부팅 시 한 번 불러 지금 로그인된 계정을 확인한다 — 사이트 전체가 같은 Supabase 세션을
// 공유하므로, NumPath 마을에서 이미 로그인해 뒀을 수도 있다. CDN이 막혀 있으면 로컬 캐시를
// 그대로 둔다.
export function initAuth() {
  loadCloudAuth().then((cloud) => {
    if (!cloud) return;
    const sync = () => {
      const user = cloud.getCachedUser();
      const name = user && (user.user_metadata?.full_name || user.user_metadata?.name);
      setCurrentUser(user ? user.email : null, name || null);
      for (const fn of changeListeners) fn();
    };
    sync();
    cloud.onAuthChange(sync);
  });
}

export function logout() {
  setCurrentUser(null, null);
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
    // OAuth 콜백에서 돌아온 직후라 코드 교환이 아직 안 끝났을 수 있다 — 실패로
    // 확정되면(cloud-auth.js) 버튼을 에러 문구로 바꿔치기한다. 이 컨테이너는 헤더의
    // renderPanel()이 currentEmail 변화가 없으면 다시 그리지 않아(의도된 최적화) 이
    // 리스너 없이는 실패 사실이 메뉴를 다시 열어도 영영 안 보일 수 있다.
    const showErrorIfAny = () => {
      const err = cloud.getAuthError();
      if (!err) return false;
      container.textContent = `로그인 실패: ${err.message || "다시 시도해 주세요"}`;
      return true;
    };
    if (showErrorIfAny()) return;
    cloud.onAuthChange(() => {
      if (!cloud.getCachedUser()) showErrorIfAny();
    });
    const btn = document.createElement("button");
    btn.className = "hamburger-signin-btn";
    btn.textContent = "Google로 로그인";
    btn.addEventListener("click", () => {
      // signInWithOAuth()는 실패해도 보통 reject하지 않고 { error }를 담아 resolve한다
      // (provider 미설정 등) — catch만 걸어두면 이런 실패가 조용히 사라진다.
      btn.disabled = true;
      btn.textContent = "이동 중…";
      cloud
        .signInWithProvider("google", `${location.origin}/`)
        .then(({ error }) => {
          if (!error) return; // 성공하면 곧 페이지가 이동하므로 여기까지 안 옴
          console.error("로그인 실패", error);
          btn.disabled = false;
          btn.textContent = `로그인 실패: ${error.message || "다시 시도해 주세요"}`;
        })
        .catch((err) => {
          console.error("관리자 로그인 실패", err);
          btn.disabled = false;
          btn.textContent = "로그인 실패, 다시 시도해 주세요";
        });
    });
    container.appendChild(btn);
  });
}
