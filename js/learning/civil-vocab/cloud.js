// 단어별 학습 일정을 계정에 저장한다(D-100). 학습 진행률(js/learning/cloud.js)과 **저장 모양이
// 다르다**:
//
//   learning_progress : user_id 한 행 + progress JSONB 통째로 → 바뀔 때마다 전체를 업서트
//   vocab_progress    : (user_id, word_id) 한 행 = 단어 하나  → 그 단어만 업서트
//
// 왜 나눴나: 목표가 8000단어다. 통짜 JSON이면 카드 한 장 넘길 때마다 수백 KB를 올리게 되고,
// 두 기기에서 같이 공부하면 나중에 올린 쪽이 상대의 진행을 통째로 덮어쓴다. 행 단위면 응답
// 하나가 100바이트 남짓이고, 겹치는 건 같은 단어를 같은 시각에 공부한 경우뿐이다.
//
// CDN 의존(supabase-js)은 다른 모듈과 같이 cloud-auth-loader.js의 동적 import 뒤에 숨긴다 —
// 네트워크가 막혀도 로그인 관련 기능만 빠지고 학습 자체는 그대로 돈다.
import { loadCloudAuth } from "../../core/cloud-auth-loader.js";
import { state } from "../../core/state.js";
import { notifyLearningSync } from "../cloud.js";
import { normalizeNewPerDay, DEFAULT_NEW_PER_DAY } from "./manifest.js";

// 한 번에 올릴 최대 행 수와 지연. 카드를 넘길 때마다 요청을 보내면 세션 하나에 수백 번이
// 되므로 모아서 보낸다 — 대신 화면을 떠날 때·탭이 숨을 때 반드시 flush한다(아래).
const BATCH_SIZE = 10;
const BATCH_DELAY_MS = 4000;
// 서버가 한 번에 돌려주는 행 수 상한(Supabase 기본 1000). 8000단어면 여러 장이 된다.
const PAGE_SIZE = 1000;

let pending = new Map();
let timer = null;

// 같은 단어를 두 기기에서 공부하면 **마지막 응답이 이긴다**(entry.at = 서버의 updated_at).
// 순수 함수라 node --test로 직접 검증한다 — 병합이 조용히 틀리면 화면엔 아무 표시가 없고
// 공부한 일정만 사라진다(js/learning/cloud.js의 mergeProgress와 같은 이유).
export function mergeVocabCards(local, remote) {
  const merged = { ...(local || {}) };
  for (const [wordId, remoteEntry] of Object.entries(remote || {})) {
    const localEntry = merged[wordId];
    if (!localEntry) {
      merged[wordId] = remoteEntry;
      continue;
    }
    const localAt = Number.isFinite(localEntry.at) ? localEntry.at : 0;
    const remoteAt = Number.isFinite(remoteEntry.at) ? remoteEntry.at : 0;
    // 시각이 같으면(옛 레코드라 at이 없거나 같은 순간) 더 많이 진행된 쪽을 남긴다.
    if (remoteAt > localAt || (remoteAt === localAt && (remoteEntry.reps || 0) > (localEntry.reps || 0))) {
      merged[wordId] = remoteEntry;
    }
  }
  return merged;
}

// DB 행 ↔ state 엔트리 변환. 시각은 DB에서 timestamptz, 화면에서는 밀리초라 여기서만 오간다.
export function rowToEntry(row) {
  return {
    due: Date.parse(row.due),
    ivl: Number(row.ivl),
    ease: Number(row.ease),
    reps: Number(row.reps),
    lapses: Number(row.lapses),
    at: Date.parse(row.updated_at),
    first: Date.parse(row.first_seen ?? row.updated_at),
  };
}

export function entryToRow(userId, wordId, entry) {
  return {
    user_id: userId,
    word_id: wordId,
    due: new Date(entry.due).toISOString(),
    ivl: entry.ivl,
    ease: entry.ease,
    reps: entry.reps,
    lapses: entry.lapses,
    updated_at: new Date(entry.at ?? Date.now()).toISOString(),
    first_seen: new Date(entry.first ?? entry.at ?? Date.now()).toISOString(),
  };
}

// 응답 하나가 끝날 때마다 호출한다. 로그인하지 않았으면 아무 일도 일어나지 않는다 —
// 이 앱의 다른 진행률과 같은 성질이다(세션 한정).
export function queueVocabSave(wordId, entry) {
  pending.set(wordId, entry);
  if (pending.size >= BATCH_SIZE) return flushVocabSave();
  if (timer) return;
  timer = setTimeout(() => {
    timer = null;
    flushVocabSave();
  }, BATCH_DELAY_MS);
}

export function flushVocabSave() {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  if (pending.size === 0) return;
  const batch = pending;
  pending = new Map();
  loadCloudAuth().then((cloud) => {
    if (!cloud) return;
    const user = cloud.getCachedUser();
    if (!user) return;   // 비로그인 사용자의 응답은 서버로 나가지 않는다
    const rows = [...batch].map(([wordId, entry]) => entryToRow(user.id, wordId, entry));
    cloud.supabase
      .from("vocab_progress")
      .upsert(rows, { onConflict: "user_id,word_id" })
      .then(({ error }) => {
        if (error) console.error("단어 일정 저장 실패", error);
      });
  });
}

// 로그인 시 서버 값을 받아 로컬과 병합한다. 8000단어면 한 번에 다 안 오므로 페이지를 넘겨
// 전부 받는다 — "이미 만난 단어"를 알아야 오늘 큐가 새 단어를 고를 수 있어서 부분만 받으면
// 같은 단어를 다시 새 단어로 내보내게 된다.
async function fetchAll(cloud, userId) {
  const rows = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await cloud.supabase
      .from("vocab_progress")
      .select("word_id, due, ivl, ease, reps, lapses, updated_at, first_seen")
      .eq("user_id", userId)
      .order("word_id", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    rows.push(...data);
    if (data.length < PAGE_SIZE) break;
  }
  return rows;
}

// 로그인 이벤트가 올 때마다 부르는 실제 로직 — cloud 클라이언트를 인자로 받는다. 실제 부팅은
// initVocabSync()가 CDN 클라이언트로 이 함수를 호출하지만, 이 함수 자체는 그 사실을 모른다 —
// node --test에서 가짜 cloud로도 검증할 수 있다(js/learning/cloud.js의 makeSyncHandler와
// 같은 이유·같은 이름). syncedForUser를 클로저에 두는 이유도 같다 — 핸들러 인스턴스마다
// 독립적이어야 테스트끼리 상태가 새지 않는다.
export function makeSyncHandler(cloud) {
  let syncedForUser = null;
  return () => {
    const user = cloud.getCachedUser();
    if (!user) {
      // **로그아웃 감지(D-104)**: syncedForUser가 null이 아니었다는 건 방금 전까지 어떤
      // 계정의 단어 일정이 로컬(state.vocab)에 실려 있었다는 뜻이다. 지우지 않으면, 같은
      // 탭에서 다른 계정으로 로그인했을 때 mergeVocabCards()가 그 계정의 서버 값과 **방금
      // 로그아웃한 계정의 로컬 일정**을 합쳐 버린다 — 최신 응답이 이기는 규칙이라 방금
      // 나간 계정이 더 최근에 공부했으면 그 사람의 단어 진행이 새 계정에 그대로 올라간다.
      // 처음부터 로그인한 적 없는 세션(syncedForUser가 원래부터 null)까지 지우면
      // "로그인 전에 공부한 걸 로그인해서 이어 올린다"는 의도된 흐름이 깨지므로,
      // **정말 로그아웃한 경우에만** 비운다. newPerDay도 같이 되돌린다 — 안 그러면 서버에
      // 자기 설정이 없는 다음 계정이 방금 나간 계정의 하루 목표를 그대로 물려받는다.
      if (syncedForUser !== null) {
        state.vocab.days = {};
        state.vocab.cards = {};
        state.vocab.newPerDay = DEFAULT_NEW_PER_DAY;
        notifyLearningSync();
      }
      syncedForUser = null;
      return;
    }
    if (syncedForUser === user.id) return;   // 같은 사용자로 중복 병합하지 않는다
    syncedForUser = user.id;

    const settingsDone = fetchSettings(cloud, user.id)
      .then((row) => {
        // 서버에 저장해 둔 목표가 있으면 그걸 쓴다. 없으면 이 기기에서 고른 값을 그대로 둔다
        // (로그인 전에 고른 값이 로그인하면서 기본값으로 되돌아가면 안 된다).
        if (row) state.vocab.newPerDay = normalizeNewPerDay(row.new_per_day);
      })
      .catch((err) => console.error("어휘 학습 설정 불러오기 실패", err));

    const cardsDone = fetchAll(cloud, user.id)
      .then((rows) => {
        const remote = {};
        for (const row of rows) remote[row.word_id] = rowToEntry(row);
        state.vocab.cards = mergeVocabCards(state.vocab.cards, remote);
        // 로그인 전에 이 기기에서 공부한 것은 서버에 없다 — 병합 결과를 그대로 올려준다.
        for (const [wordId, entry] of Object.entries(state.vocab.cards)) {
          if (!remote[wordId]) pending.set(wordId, entry);
        }
        flushVocabSave();
      })
      .catch((err) => console.error("단어 일정 불러오기 실패", err));

    // 화면이 이미 그려진 뒤에 도착하므로 알려야 한다 — 안 그러면 마이페이지·도구 인트로가
    // 로그인 전 상태를 계속 보여준다(D-101). **둘 다 끝난 뒤 한 번만** 알린다 — 설정과
    // 일정 중 하나만 기다렸다가 알리면(예전엔 일정 쪽에만 붙어 있었다), 그게 더 느리게
    // 응답할 때 방금 도착한 값이 화면에 반영 안 된 채로 남는다(D-103).
    Promise.allSettled([settingsDone, cardsDone]).then(notifyLearningSync);
  };
}

export function initVocabSync() {
  loadCloudAuth().then((cloud) => {
    if (!cloud) return;
    const sync = makeSyncHandler(cloud);
    sync();
    cloud.onAuthChange(sync);

    // 탭을 닫거나 백그라운드로 보낼 때 모아둔 것을 넘긴다 — 안 그러면 마지막 몇 개가 사라진다.
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "hidden") flushVocabSave();
      });
    }
  });
}

// ── 학습자 설정(하루 목표) ─────────────────────────────────────────────────
// 일정(vocab_progress)과 테이블을 나눈 이유: 저 테이블은 한 행이 단어 하나라 사용자 단위
// 설정을 넣을 자리가 없다. 값이 하나뿐이라 배치도 필요 없다 — 바꿀 때마다 바로 올린다.
export function saveVocabSettings() {
  loadCloudAuth().then((cloud) => {
    if (!cloud) return;
    const user = cloud.getCachedUser();
    if (!user) return;
    cloud.supabase
      .from("vocab_settings")
      .upsert({ user_id: user.id, new_per_day: state.vocab.newPerDay, updated_at: new Date().toISOString() })
      .then(({ error }) => {
        if (error) console.error("어휘 학습 설정 저장 실패", error);
      });
  });
}

async function fetchSettings(cloud, userId) {
  const { data, error } = await cloud.supabase
    .from("vocab_settings")
    .select("new_per_day")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}
