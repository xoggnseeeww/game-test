// 학습 진행률(state.learning)을 Supabase에 동기화한다 — NumPath 마을(D-55)과 같은 패턴
// (CDN 의존은 cloud-auth-loader.js의 동적 import 뒤로 숨긴다), 코인/마을 같은 보상 체계는
// 없다(D-54/55에서 되돌린 건 그 부분뿐, 계정 재사용 자체는 유효하다 — D-68).
// 로그인 시 서버 값을 로컬과 병합하고, 이후 진행이 바뀔 때마다 업서트한다.
import { loadCloudAuth } from "../core/cloud-auth-loader.js";
import { state } from "../core/state.js";

let syncedForUser = null;

// 챕터별로 더 진행된 쪽(index가 큰 쪽)을 남긴다 — 로그인이 여러 번 일어나도(재로그인, 다른
// 탭) 멱등해야 한다는 게 NumPath 마을 병합(mergeVillages, D-55)과 같은 이유다.
function mergeProgress(local, remote) {
  const merged = { ...local };
  for (const [chapterId, remoteEntry] of Object.entries(remote || {})) {
    const localEntry = merged[chapterId];
    if (!localEntry || remoteEntry.index > localEntry.index) merged[chapterId] = remoteEntry;
  }
  return merged;
}

export function saveLearningProgress() {
  loadCloudAuth().then((cloud) => {
    if (!cloud) return;
    const user = cloud.getCachedUser();
    if (!user) return;
    cloud.supabase
      .from("learning_progress")
      .upsert({ user_id: user.id, progress: state.learning, updated_at: new Date().toISOString() })
      .then(({ error }) => {
        if (error) console.error("학습 진행률 저장 실패", error);
      });
  });
}

// 부팅 시 한 번 불러 로그인 이벤트를 구독한다 — 로그인할 때마다(최초 1회만) 서버 값을 받아와
// 병합한다. 같은 사용자로 중복 병합하지 않도록 syncedForUser로 막는다.
export function initLearningSync() {
  loadCloudAuth().then((cloud) => {
    if (!cloud) return;
    const sync = () => {
      const user = cloud.getCachedUser();
      if (!user) {
        syncedForUser = null;
        return;
      }
      if (syncedForUser === user.id) return;
      syncedForUser = user.id;
      cloud.supabase
        .from("learning_progress")
        .select("progress")
        .eq("user_id", user.id)
        .maybeSingle()
        .then(({ data, error }) => {
          if (error) {
            console.error("학습 진행률 불러오기 실패", error);
            return;
          }
          Object.assign(state.learning, mergeProgress(state.learning, data?.progress));
        });
    };
    sync();
    cloud.onAuthChange(sync);
  });
}
