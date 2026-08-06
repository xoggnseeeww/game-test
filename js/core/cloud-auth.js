// 로그인 상태 공용 모듈 — Supabase Auth(Google·카카오 OAuth)를 쓰는 화면이 전부 이 클라이언트
// 하나를 공유한다(NumPath 마을 동기화 D-55 · 우상단 관리자 로그인 D-56). data-pantry.com과
// 같은 Supabase 프로젝트를 재사용한다 — 계정 체계를 새로 만들지 않는다.
//
// **이 파일을 static import하지 말 것** — supabase-js를 CDN(esm.sh)에서 가져오므로 네트워크가
// 필요하다. import 실패가 ES 모듈 그래프를 타고 올라가 화면 전체가 깨지는 걸 막으려면 반드시
// cloud-auth-loader.js의 loadCloudAuth()로 동적 import해서 실패를 그 자리에서 흡수해야 한다.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.106.2";

// anon key는 공개 키다(RLS가 실제 접근 제어를 한다) — data-pantry.com 클라이언트가 쓰는
// 것과 같은 값. 시크릿이 아니므로 여기 하드코딩해도 CLAUDE.md의 "시크릿 없음"과 배치되지 않는다.
const SUPABASE_URL = "https://duvpvwolgqurhgnhqezj.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR1dnB2d29sZ3F1cmhnbmhxZXpqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk3NzE0OTYsImV4cCI6MjA5NTM0NzQ5Nn0.nayk8WAkngmnt5dd8N2E7g1FqYD07zLO-otYAi2kPWk";

// NumPath 마을(cloud.js)과 관리자 로그인(auth.js)이 같은 인스턴스를 쓴다 — 프로젝트
// 자격증명을 두 곳에 복사해두지 않는다.
//
// flowType: "pkce" — 기본값인 implicit 플로우는 토큰이 URL 해시(#access_token=...)로
// 돌아오는데, 이 앱은 auth 클라이언트를 동적 import로 늦게 띄우는 구조라(위 주석) 그
// 사이에 해시가 사라지면 로그인이 조용히 실패한다(router.js의 replaceState가 해시를
// 보존하도록 고쳤어도, KakaoTalk 인앱 브라우저 등 리다이렉트 체인 중간에 해시를 흘리는
// 환경까지는 못 막는다 — D-76). PKCE는 토큰 대신 코드를 `?code=`(location.search)로
// 받는데, 이 값은 router.js가 애초부터 모든 replaceState에서 무조건 보존하던 값이라
// 이 구조에서 훨씬 안전하다.
//
// detectSessionInUrl: false — supabase-js의 "자동으로 URL의 code를 감지해 교환한다"는
// 동작이 이 앱처럼 순수 createClient(SSR 어댑터 아님)로 늦게(동적 import) 뜨는 구성에서도
// 실제로 항상 발동하는지 실기기로 확증할 방법이 없었다(D-76 배포 후에도 재현, D-77). 자동
// 처리에 기대는 대신 아래에서 `code`를 직접 읽어 `exchangeCodeForSession`을 명시적으로
// 호출한다 — 실패해도 최소한 console.error로 남고(에러 삼킴 금지), 로그인 버튼 쪽에도
// 보여줄 수 있다.
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { flowType: "pkce", detectSessionInUrl: false },
});

let cachedUser = null;
let authError = null;
const changeListeners = new Set();

function notifyChange() {
  for (const cb of changeListeners) cb();
}

// 로그인 상태가 바뀔 때마다 즉시 알림이 필요한 단순한 소비자용(관리자 로그인 등). 로그인
// 시점에 서버 데이터를 병합하는 등 알림 타이밍이 중요한 소비자(NumPath 마을)는 이 pub-sub
// 대신 위 supabase 클라이언트에 직접 자기만의 onAuthStateChange 리스너를 등록한다
// (js/games/numpath/cloud.js 참고) — 같은 이벤트라도 소비자마다 원하는 타이밍이 다를 수
// 있어서, 그런 경우까지 이 공용 알림 하나로 욱여넣지 않는다.
export function onAuthChange(cb) {
  changeListeners.add(cb);
  return () => changeListeners.delete(cb);
}

export function getCachedUser() {
  return cachedUser;
}

// OAuth 콜백 코드 교환이 실패했을 때만 채워진다(성공하면 onAuthStateChange가 알아서
// 처리하므로 null로 유지). 로그인 버튼이 "다시 로그인하라고만 뜨고 이유를 알 수 없는"
// 상태를 만들지 않도록 auth.js의 renderSignInButton()이 이 값을 읽어 보여준다.
export function getAuthError() {
  return authError;
}

supabase.auth.onAuthStateChange((_event, session) => {
  cachedUser = session?.user || null;
  notifyChange();
});

const oauthCode = new URLSearchParams(location.search).get("code");
if (oauthCode) {
  supabase.auth.exchangeCodeForSession(oauthCode).then(({ error }) => {
    // 성공하면 onAuthStateChange가 이미 cachedUser를 채우고 notifyChange()도 불렀다 —
    // 여기서 또 부르면 리스너가 두 번 실행될 뿐이라 실패했을 때만 직접 알린다.
    if (error) {
      authError = error;
      console.error("로그인 코드 교환 실패", error);
      notifyChange();
    }
    // 한 번 쓴 code는 재사용 불가(5분 유효, 1회용) — 새로고침·뒤로가기로 다시 교환을
    // 시도해 매번 실패하지 않도록 주소에서 지운다. history.state는 router.js가 채워둔
    // 값이라 그대로 보존한다.
    history.replaceState(history.state, "", location.pathname + location.hash);
  });
}

export function signInWithProvider(provider, redirectTo) {
  return supabase.auth.signInWithOAuth({ provider, options: { redirectTo } });
}

export function signOut() {
  return supabase.auth.signOut();
}
