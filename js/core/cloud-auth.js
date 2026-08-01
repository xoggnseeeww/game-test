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
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let cachedUser = null;
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

supabase.auth.onAuthStateChange((_event, session) => {
  cachedUser = session?.user || null;
  notifyChange();
});

export function signInWithProvider(provider, redirectTo) {
  return supabase.auth.signInWithOAuth({ provider, options: { redirectTo } });
}

export function signOut() {
  return supabase.auth.signOut();
}
