// NumPath 마을 클라우드 동기화(D-35). data-pantry.com과 같은 Supabase 프로젝트를 쓴다 — 계정
// 체계를 새로 만들지 않고 이미 있는 걸 재사용한다. 로그인은 전적으로 선택 사항이다: 이 모듈이
// 아예 안 불려도(CDN 차단·오프라인) village.js의 localStorage 경로는 그대로 동작한다.
//
// **이 파일을 다른 모듈에서 static import하지 말 것** — supabase-js를 CDN에서 가져오는데,
// ES 모듈은 import 하나가 실패하면 그 모듈을 static import한 쪽까지 통째로 실패한다. CDN이
// 막히면 화면 전체(인트로·플레이·결과)가 깨질 수 있다는 뜻이라, 반드시 cloud-loader.js의
// loadCloud()로 동적 import해서 실패를 그 자리에서 흡수해야 한다.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.106.2";
import { loadVillage, saveVillage, mergeVillages } from "./village.js";

// anon key는 공개 키다(RLS가 실제 접근 제어를 한다) — data-pantry.com 클라이언트가 쓰는
// 것과 같은 값. 시크릿이 아니므로 여기 하드코딩해도 CLAUDE.md의 "시크릿 없음"과 배치되지 않는다.
const SUPABASE_URL = "https://duvpvwolgqurhgnhqezj.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR1dnB2d29sZ3F1cmhnbmhxZXpqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk3NzE0OTYsImV4cCI6MjA5NTM0NzQ5Nn0.nayk8WAkngmnt5dd8N2E7g1FqYD07zLO-otYAi2kPWk";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let cachedUser = null;
let lastSyncedUserId = null;
const changeListeners = new Set();

function notifyChange() {
  for (const cb of changeListeners) cb();
}

// 화면이 마운트돼 있는 동안만 알림을 받는다 — 반환값을 onLeave()에 등록해서 화면을 떠나면
// 구독을 해제한다(리스너가 쌓이거나, 이미 떠난 화면의 닫힌 렌더 클로저를 다시 부르는 것을 막는다).
export function onCloudChange(cb) {
  changeListeners.add(cb);
  return () => changeListeners.delete(cb);
}

// 지금까지 파악된 로그인 사용자(동기 접근용). 클라이언트 초기화가 끝나기 전에는 null일 수 있고,
// 그 뒤 onAuthStateChange의 최초 이벤트(INITIAL_SESSION)로 채워진다 — 화면은 onCloudChange로
// 그 갱신을 받아 다시 그리면 된다.
export function getCachedUser() {
  return cachedUser;
}

supabase.auth.onAuthStateChange((_event, session) => {
  const user = session?.user || null;
  cachedUser = user;

  if (!user) {
    lastSyncedUserId = null;
    notifyChange();
    return;
  }

  if (user.id === lastSyncedUserId) {
    notifyChange();
    return;
  }
  lastSyncedUserId = user.id;

  // 새로 로그인(또는 이미 로그인된 세션을 이번에 처음 인식)한 시점에 딱 한 번, 로컬과
  // 클라우드를 합친다. mergeVillages가 멱등이라 이 코드가 두 번 실행돼도 코인이 중복 적립되지
  // 않는다 — user.id 가드는 그 실행 횟수 자체를 줄이려는 최적화지 정확성을 위한 필수 조건은 아니다.
  fetchCloudVillage(user.id)
    .then((cloud) => {
      const merged = cloud ? mergeVillages(loadVillage(), cloud) : loadVillage();
      saveVillage(merged);
      return pushCloudVillage(user.id, merged);
    })
    .catch((err) => console.error("NumPath 클라우드: 로그인 동기화 실패", err))
    .finally(notifyChange);
});

export function signInWithProvider(provider) {
  return supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo: `${location.origin}/game/numpath/village` },
  });
}

export function signOutCloud() {
  return supabase.auth.signOut();
}

async function fetchCloudVillage(userId) {
  const { data, error } = await supabase.from("numpath_village").select("coins, built").eq("user_id", userId).maybeSingle();
  if (error) throw error;
  return data ? { coins: data.coins, built: data.built } : null;
}

async function pushCloudVillage(userId, village) {
  const { error } = await supabase.from("numpath_village").upsert({ user_id: userId, coins: village.coins, built: village.built });
  if (error) throw error;
}

// 로컬 상태가 바뀔 때마다(코인 획득·건설) 호출한다. 로그인 상태가 아니면 아무 일도 안 하고,
// 로그인 상태면 클라우드에 그대로 반영한다(fire-and-forget — 실패해도 게임 진행을 막지 않고
// console.error만 남긴다. 다음 변경 때 다시 시도되므로 재시도 로직을 따로 두지 않는다).
export function pushIfLoggedIn(village) {
  if (!cachedUser) return;
  pushCloudVillage(cachedUser.id, village).catch((err) => console.error("NumPath 클라우드: 저장 실패", err));
}
