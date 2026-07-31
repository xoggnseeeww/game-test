// NumPath 마을 클라우드 동기화(D-55). 공유 Supabase 클라이언트는 core/cloud-auth.js
// 하나뿐이다(관리자 로그인 D-56과 같이 쓴다, 자격증명 중복 없음) — 이 파일은 그 위에
// "로그인 시 로컬·클라우드 마을을 병합한다"는 NumPath 전용 로직만 얹는다. 로그인은 전적으로
// 선택 사항이다: 이 파일이 아예 안 불려도(CDN 차단·오프라인) village.js의 localStorage
// 경로는 그대로 동작한다.
//
// **이 파일을 다른 모듈에서 static import하지 말 것** — core/cloud-auth.js를 거쳐 결국
// supabase-js를 CDN에서 가져온다. ES 모듈은 import 하나가 실패하면 그 모듈을 static
// import한 쪽까지 통째로 실패한다. CDN이 막히면 화면 전체(인트로·플레이·결과)가 깨질 수
// 있다는 뜻이라, 반드시 cloud-loader.js의 loadCloud()로 동적 import해서 실패를 그 자리에서
// 흡수해야 한다.
import { supabase, getCachedUser, signInWithProvider as signInCore, signOut } from "../../core/cloud-auth.js";
import { loadVillage, saveVillage, mergeVillages } from "./village.js";

export { getCachedUser };
export { signOut as signOutCloud };

// 로그인 후 다시 마을 화면으로 돌아오게 고정 경로를 준다(D-55) — 관리자 로그인(core/auth.js)은
// 아무 화면에서나 눌릴 수 있어 redirectTo를 직접 받지만, 이 화면은 항상 여기로 돌아와야 한다.
export function signInWithProvider(provider) {
  return signInCore(provider, `${location.origin}/game/numpath/village`);
}

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

// core/cloud-auth.js도 같은 클라이언트에 자기 리스너를 등록해 getCachedUser()를 갱신한다 —
// 이 리스너는 그것과 별개로, NumPath만의 병합 타이밍(로그인 시 병합이 끝난 뒤에만 알림)을
// 관리한다. 그래서 session.user를 직접 쓰고 getCachedUser()에는 기대지 않는다(등록 순서에
// 의존하지 않기 위해서다).
supabase.auth.onAuthStateChange((_event, session) => {
  const user = session?.user || null;

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
  const user = getCachedUser();
  if (!user) return;
  pushCloudVillage(user.id, village).catch((err) => console.error("NumPath 클라우드: 저장 실패", err));
}
