// 학습 진행률(state.learning)을 Supabase에 동기화한다 — NumPath 마을(D-55)과 같은 패턴
// (CDN 의존은 cloud-auth-loader.js의 동적 import 뒤로 숨긴다), 코인/마을 같은 보상 체계는
// 없다(D-54/55에서 되돌린 건 그 부분뿐, 계정 재사용 자체는 유효하다 — D-68).
// 로그인 시 서버 값을 로컬과 병합하고, 이후 진행이 바뀔 때마다 업서트한다.
import { loadCloudAuth } from "../core/cloud-auth-loader.js";
import { state } from "../core/state.js";

let syncedForUser = null;

// 챕터별로 더 진행된 쪽(index가 큰 쪽)을 남긴다 — 로그인이 여러 번 일어나도(재로그인, 다른
// 탭) 멱등해야 한다는 게 NumPath 마을 병합(mergeVillages, D-55)과 같은 이유다.
// export하는 이유: 이 함수만 순수 함수(DOM·CDN을 모른다)라 `node --test`로 직접 검증할 수
// 있다 — 나머지(saveLearningProgress/initLearningSync)는 Supabase 클라이언트에 묶여 있어
// 브라우저에서만 돈다. weak 합집합 규칙(A-5)이 조용히 깨지면 복습 목록이 사라지는데 화면엔
// 아무 표시가 안 나므로, 여기만이라도 테스트로 묶어둔다.
export function mergeProgress(local, remote) {
  const merged = { ...local };
  for (const [chapterId, remoteEntry] of Object.entries(remote || {})) {
    const localEntry = merged[chapterId];
    const remoteIsAhead = !localEntry || remoteEntry.index > localEntry.index;
    // 진도(index)는 더 나간 쪽을 남기지만, weak(헷갈렸다고 표시한 문장)는 **합집합**으로
    // 따로 남긴다 — 엔트리를 통째로 갈아끼우면 진도가 조금 뒤진 기기에서 표시해둔 복습
    // 목록이 조용히 사라진다. weak가 아예 없는 옛 레코드(이 필드가 생기기 전 저장분)도
    // 여기서 항상 객체로 채워지므로, 화면 쪽에서 `st.weak[id]`가 터지지 않는다.
    const weak = { ...(localEntry && localEntry.weak), ...remoteEntry.weak };
    merged[chapterId] = { ...(remoteIsAhead ? remoteEntry : localEntry), weak };
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
