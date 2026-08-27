// 학습 진행률 병합 규칙 — `js/learning/cloud.js`의 mergeProgress만 순수 함수라 여기서 검증한다.
// 나머지(saveLearningProgress/initLearningSync)는 Supabase 클라이언트에 묶여 브라우저에서만 돈다.
import test from "node:test";
import assert from "node:assert/strict";
import { mergeProgress, makeSyncHandler } from "../js/learning/cloud.js";
import { state } from "../js/core/state.js";

test("진도(index)는 더 나간 쪽을 남긴다", () => {
  const merged = mergeProgress({ a: { index: 2, weak: {} } }, { a: { index: 5, weak: {} } });
  assert.equal(merged.a.index, 5);
  const merged2 = mergeProgress({ a: { index: 7, weak: {} } }, { a: { index: 3, weak: {} } });
  assert.equal(merged2.a.index, 7);
});

test("weak은 진도와 무관하게 합집합으로 남는다 (A-5: 복습 목록 유실 방지)", () => {
  // 원격이 진도가 앞서지만, 로컬에만 있던 weak 표시가 사라지면 안 된다.
  const merged = mergeProgress(
    { a: { index: 2, weak: { s1: true } } },
    { a: { index: 9, weak: { s2: true } } }
  );
  assert.equal(merged.a.index, 9);
  assert.deepEqual(merged.a.weak, { s1: true, s2: true });

  // 반대 방향(로컬이 앞설 때)도 같다.
  const merged2 = mergeProgress(
    { a: { index: 9, weak: { s1: true } } },
    { a: { index: 2, weak: { s2: true } } }
  );
  assert.equal(merged2.a.index, 9);
  assert.deepEqual(merged2.a.weak, { s1: true, s2: true });
});

test("weak 필드가 없는 옛 레코드도 항상 객체로 채워진다 (A-5: markWeak 크래시 방지)", () => {
  const merged = mergeProgress({ a: { index: 1 } }, { a: { index: 4 } });
  assert.deepEqual(merged.a.weak, {}, "weak이 undefined면 화면에서 st.weak[id] 대입이 터진다");
});

test("원격에만 있는 챕터는 그대로 들어오고, 로컬 전용 챕터는 보존된다", () => {
  const merged = mergeProgress({ mine: { index: 3, weak: {} } }, { theirs: { index: 1, weak: {} } });
  assert.equal(merged.mine.index, 3);
  assert.equal(merged.theirs.index, 1);
});

test("remote가 비어 있어도(null/undefined) 로컬을 그대로 돌려준다", () => {
  const local = { a: { index: 3, weak: { s1: true } } };
  assert.deepEqual(mergeProgress(local, null), local);
  assert.deepEqual(mergeProgress(local, undefined), local);
});

// ── 로그아웃 시 로컬 진행률 초기화(D-104) ────────────────────────────────────
// 배경: 같은 브라우저 탭에서 계정 A로 공부하다 로그아웃하고 계정 B로 로그인하면, 예전에는
// state.learning에 A의 진행률이 그대로 남아 있어 mergeProgress()가 그걸 B의 서버 값과
// 합쳐버렸다(index가 큰 쪽이 이기는 규칙이라 A가 더 앞서 있으면 그대로 B 계정에 업서트된다).
// 실제 Supabase 클라이언트 없이도 검증할 수 있게, makeSyncHandler가 받는 cloud를 최소한의
// 가짜로 흉내낸다(get/set 가능한 로그인 상태 + learning_progress 테이블 하나).
function fakeLearningCloud({ rows = {} } = {}) {
  let currentUser = null;
  const listeners = new Set();
  return {
    getCachedUser: () => currentUser,
    onAuthChange(cb) {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    _login(id) {
      currentUser = { id };
      for (const cb of listeners) cb();
    },
    _logout() {
      currentUser = null;
      for (const cb of listeners) cb();
    },
    supabase: {
      from(table) {
        assert.equal(table, "learning_progress");
        // select()/eq()는 체이닝만 흉내내면 되므로 자기 자신을 돌려준다 — 화살표 함수로
        // `this`를 쓰면 이 객체가 아니라 바깥 from()의 `this`(=supabase)를 가리켜 체인이
        //끊긴다. 미리 만든 참조를 클로저로 캡처하는 쪽이 안전하다.
        const query = {
          select: () => query,
          eq: () => query,
          maybeSingle: () => Promise.resolve({ data: { progress: rows[currentUser.id] || null }, error: null }),
          upsert: () => Promise.resolve({ error: null }),
        };
        return query;
      },
    },
  };
}

// 마이크로태스크 큐가 몇 번 돌 시간을 준다 — sync()의 .then() 체인이 다 풀릴 때까지 기다린다.
const flush = () => new Promise((r) => setTimeout(r, 0));

test("로그아웃하면 로컬 진행률이 지워져 다음 계정에 안 섞인다", async () => {
  const remoteB = { chapB: { index: 1, weak: {} } };
  const cloud = fakeLearningCloud({ rows: { userB: remoteB } });
  const sync = makeSyncHandler(cloud);
  sync();                       // 부팅 시 1회 — 아직 로그인 전이라 아무 일도 없어야 한다
  cloud.onAuthChange(sync);     // initLearningSync()가 실제로 하는 배선(sync(); cloud.onAuthChange(sync);)
  assert.deepEqual(state.learning, {}, "로그인 전인데 뭔가 지워지거나 채워졌다");

  cloud._login("userA");
  await flush();
  // A 계정으로 로그인한 상태에서 이 기기에서 진도가 많이 나갔다고 하자(예: 서버보다 훨씬 앞섬)
  state.learning.chapA = { index: 99, weak: {} };

  cloud._logout();
  await flush();
  assert.deepEqual(state.learning, {}, "로그아웃했는데 A의 진행률이 그대로 남아 있다(D-104)");

  cloud._login("userB");
  await flush();
  assert.deepEqual(
    state.learning,
    { chapB: remoteB.chapB },
    "B로 로그인했는데 A의 로컬 진행률이 섞여 들어왔다 — 계정 간 데이터 누출(D-104)"
  );

  delete state.learning.chapB;   // 다른 테스트에 영향 안 주게 정리
});

test("한 번도 로그인한 적 없는 세션은 로그아웃 처리에서 아무것도 안 지운다", async () => {
  const cloud = fakeLearningCloud({});
  const sync = makeSyncHandler(cloud);
  cloud.onAuthChange(sync);
  state.learning.beforeLogin = { index: 3, weak: {} };   // 로그인 전에 해둔 공부
  sync();   // 로그인한 적 없는 상태에서 "로그아웃" 신호와 동치인 최초 호출
  await flush();
  assert.deepEqual(
    state.learning.beforeLogin,
    { index: 3, weak: {} },
    "로그인 전에 해둔 진행률까지 지워버리면 '나중에 로그인해서 이어 올리기'가 깨진다"
  );
  delete state.learning.beforeLogin;
});

test("makeSyncHandler 인스턴스끼리 syncedForUser가 서로 안 샌다", async () => {
  const cloudA = fakeLearningCloud({ rows: { u1: { c: { index: 1, weak: {} } } } });
  const cloudB = fakeLearningCloud({ rows: { u1: { c: { index: 1, weak: {} } } } });
  const syncA = makeSyncHandler(cloudA);
  const syncB = makeSyncHandler(cloudB);
  cloudA.onAuthChange(syncA);
  cloudB.onAuthChange(syncB);
  cloudA._login("u1");
  await flush();
  // syncB는 아직 한 번도 안 불렸으니, syncA가 이미 u1으로 동기화됐어도 독립적으로 동작해야 한다
  cloudB._login("u1");
  await flush();
  assert.deepEqual(state.learning.c, { index: 1, weak: {} });
});
