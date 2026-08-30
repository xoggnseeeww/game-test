// 학습 진행률(state.learning)을 Supabase에 동기화한다 — NumPath 마을(D-55)과 같은 패턴
// (CDN 의존은 cloud-auth-loader.js의 동적 import 뒤로 숨긴다), 코인/마을 같은 보상 체계는
// 없다(D-54/55에서 되돌린 건 그 부분뿐, 계정 재사용 자체는 유효하다 — D-68).
// 로그인 시 서버 값을 로컬과 병합하고, 이후 진행이 바뀔 때마다 업서트한다.
import { loadCloudAuth } from "../core/cloud-auth-loader.js";
import { state } from "../core/state.js";

// 서버에서 받아온 값이 state에 병합된 순간을 알리는 pub-sub. 로그인 동기화는 **화면이 이미
// 그려진 뒤에** 끝나기 때문에(CDN 동적 import + 네트워크), 알림이 없으면 마이페이지·학습
// 목록이 "아직 아무것도 안 한 상태"를 계속 보여준다 — 실제로 사용자가 겪은 증상이다(D-101).
// 어휘 도구(js/learning/civil-vocab/cloud.js)도 자기 병합이 끝나면 이 알림을 쓴다 — 도구별로
// 알림 채널을 따로 두면 구독하는 쪽이 도구를 알아야 해서 D-70 경계가 깨진다.
const syncListeners = new Set();

export function onLearningSync(cb) {
  syncListeners.add(cb);
  return () => syncListeners.delete(cb);
}

export function notifyLearningSync() {
  for (const cb of syncListeners) cb();
}

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

// 로그인 이벤트가 올 때마다 부르는 실제 로직 — cloud 클라이언트를 인자로 받는다. 실제
// 부팅에서는 initLearningSync()가 CDN에서 받아온 진짜 클라이언트를 넘기지만, 이 함수
// 자체는 그 사실을 모른다 — 그래서 node --test에서 가짜 cloud로도 검증할 수 있다
// (아래 D-104 로그아웃 초기화가 여기 있다).
//
// syncedForUser를 클로저 안에 둔 이유: 예전엔 모듈 전역이라 실제 부팅(단 한 번의
// initLearningSync 호출)에서는 문제가 없었지만, 그러면 테스트에서 handler를 여러 번 만들
// 때마다 이전 테스트의 상태가 새 handler로 새어 들어간다 — 핸들러 인스턴스마다 독립적인
// "누구와 동기화됐는지"를 갖게 했다.
export function makeSyncHandler(cloud) {
  let syncedForUser = null;
  return () => {
    const user = cloud.getCachedUser();
    if (!user) {
      // **로그아웃 감지(D-104)**: syncedForUser가 null이 아니었다는 건 방금 전까지 어떤
      // 계정의 진행률이 로컬(state.learning)에 실려 있었다는 뜻이다. 지우지 않으면, 같은
      // 브라우저 탭에서 다른 계정으로 로그인했을 때 mergeProgress()가 그 계정의 서버 값과
      // **방금 로그아웃한 계정의 로컬 진행률**을 합쳐 버린다 — index가 더 큰 쪽이 이기는
      // 규칙이라 방금 나간 계정의 진도가 더 앞서 있으면 새 계정 서버에 그대로 업서트돼
      // 남의 진행률이 내 계정에 섞여 들어가는 것과 같다. 처음부터 로그인한 적 없는 세션
      // (syncedForUser가 원래부터 null)까지 지우면 "로그인 전에 해둔 공부를 로그인해서
      // 이어 올린다"는 의도된 흐름이 깨지므로, **정말 로그아웃한 경우에만** 비운다.
      if (syncedForUser !== null) {
        state.learning = {};
        notifyLearningSync();
      }
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
        notifyLearningSync();
      });
  };
}

// 부팅 시 한 번 불러 로그인 이벤트를 구독한다 — 로그인할 때마다(최초 1회만) 서버 값을 받아와
// 병합한다. 같은 사용자로 중복 병합하지 않도록 makeSyncHandler의 syncedForUser로 막는다.
export function initLearningSync() {
  loadCloudAuth().then((cloud) => {
    if (!cloud) return;
    const sync = makeSyncHandler(cloud);
    sync();
    cloud.onAuthChange(sync);
  });
}
