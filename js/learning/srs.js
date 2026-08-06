// 간격 반복(SRS) 스케줄. DOM도 state도 모르는 순수 함수만 둔다 — score.js·cloud.js의
// mergeProgress와 같은 이유로 `node --test`에서 직접 검증된다(js-modules 규칙).
//
// §3-3이 "나중에 붙일 때"로 남겨둔 걸 실제로 붙인 것(D-92). 그때 적어둔 전제를 그대로 따랐다:
// **불리언 `weak`로는 부족하고 문장별 시각/간격 필드가 필요하다**, 그리고 **세션이 끝나도
// 남아야 의미가 있다**(D-68의 `learning_progress` 영속 저장에 그대로 얹힌다).
//
// 저장 모양을 새로 만들지 않고 기존 `weak`의 **값**만 바꿨다:
//     이전: state.learning[key].weak = { [문장id]: true }
//     지금: state.learning[key].weak = { [문장id]: { due, step } }
// 키는 그대로라서 기존에 `weak`를 읽던 코드(마이페이지의 `Object.keys(weak).length` 집계,
// "헷갈렸던 문장만 복습하기"의 `weak[s.id]` 진리값 검사)가 **한 줄도 안 바뀌고 그대로 돈다** —
// 객체는 truthy이고 키 개수도 같다. 옛 값(`true`)이 클라우드에서 돌아와도 아래 함수들이
// 전부 방어한다(`normalizeEntry`).

// Leitner box식 고정 간격(일). step 0 = 오늘 다시, 이후 1일 → 3일 → 7일 → 16일.
// SM-2 같은 가변 계수는 쓰지 않았다 — 정답률 말고는 입력이 없고(문항당 응답 이력을 안 쌓는다),
// 어린이 대상이라 "며칠 뒤"가 정확할수록 좋은 종류의 학습도 아니다. 필요해지면 이 배열만 바꾼다.
export const INTERVALS_DAYS = [0, 1, 3, 7, 16];
const DAY = 24 * 60 * 60 * 1000;

// 옛 형식(`true`)이나 깨진 값도 항상 { due, step }으로 읽는다 — 클라우드에 이미 저장된
// 불리언 weak가 돌아와도 터지지 않아야 한다(A-5에서 겪은 것과 같은 종류의 함정).
function normalizeEntry(entry, now) {
  if (!entry || typeof entry !== "object") return { due: now, step: 0 };
  const step = Number.isInteger(entry.step) ? entry.step : 0;
  const due = Number.isFinite(entry.due) ? entry.due : now;
  return { due, step };
}

// 틀렸을 때: 항상 처음(step 0, 오늘 다시)으로 되돌린다. 한 번 틀린 문장을 "조금만" 뒤로
// 미루는 건 이 나이대 학습에서 의미가 약하고, 규칙이 단순해야 예측 가능하다.
export function markWrong(entry, now = Date.now()) {
  return { due: now, step: 0 };
}

// 맞혔을 때: 다음 칸으로 올린다. 마지막 칸을 넘기면 `null`을 돌려주고, 호출부는 그 문장을
// weak에서 **지운다**(졸업) — 계속 남겨두면 복습 목록이 끝없이 길어진다.
export function markCorrect(entry, now = Date.now()) {
  const { step } = normalizeEntry(entry, now);
  const next = step + 1;
  if (next >= INTERVALS_DAYS.length) return null;
  return { due: now + INTERVALS_DAYS[next] * DAY, step: next };
}

export function isDue(entry, now = Date.now()) {
  return normalizeEntry(entry, now).due <= now;
}

// `state.learning` 전체를 훑어 지금 복습할 항목을 모은다. 이 함수는 문장 내용을 모른다 —
// 어느 챕터(key)의 어느 문장(id)인지만 돌려주고, 실제 문장으로 되돌리는 건 각 학습 도구의
// `resolveReview`가 한다(review.js). 그래야 이 파일이 도구를 import하지 않는다.
export function collectDue(learning, now = Date.now()) {
  const out = [];
  for (const [key, chapter] of Object.entries(learning || {})) {
    for (const [id, entry] of Object.entries((chapter && chapter.weak) || {})) {
      if (isDue(entry, now)) out.push({ key, id, ...normalizeEntry(entry, now) });
    }
  }
  // 오래 밀린 것부터 — 같은 날 여러 개가 몰리면 가장 오래된 것이 먼저 나와야 한다.
  return out.sort((a, b) => a.due - b.due);
}

// 아직 때가 안 된 것까지 포함한 전체 복습 대기 수(마이페이지 문구용).
export function countPending(learning) {
  let n = 0;
  for (const chapter of Object.values(learning || {})) {
    n += Object.keys((chapter && chapter.weak) || {}).length;
  }
  return n;
}
