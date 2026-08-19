// 어휘 전용 간격 반복(SRS) 스케줄 — DOM도 state도 모르는 순수 함수만 둔다
// (js/learning/srs.js·score.js와 같은 규칙, node --test로 직접 검증된다).
//
// **왜 js/learning/srs.js를 재사용하지 않나**(D-98에서 정한 것): 그쪽은 "틀린 문장 몇 개"를
// 위한 Leitner 고정 간격 `[0,1,3,7,16]`이고 **마지막 칸을 넘기면 목록에서 지운다(졸업)**.
// 8000단어를 장기 보존하는 이 도구에서 그 규칙은 "한 번 맞힌 단어가 영구히 사라진다"가 된다.
// 여기서는 졸업이 없고, 잘 맞힐수록 간격이 길어질 뿐이다.
//
// 파일 위치가 도구 안(js/learning/civil-vocab/)인 이유: 이 스케줄은 어휘 카드에만 쓰인다.
// 문장 도구가 같이 쓰기 시작하면 그때 js/learning/으로 올린다(score.js가 걸어온 길과 같다).

export const EASE_START = 2.5;
export const EASE_MIN = 1.3;
export const MAX_INTERVAL_DAYS = 365;
const DAY = 24 * 60 * 60 * 1000;

// 평가는 셋이다. 화면에서 오는 입력은 두 갈래인데 둘 다 이 셋으로 좁혀 들어온다:
//  - 단어 카드 자가평가: 👍 알겠어요 = "good" / 😅 헷갈려요 = "again"
//  - 확인 문제·빈칸: 정답 = "good" / 오답 = "again"
//  - "hard"는 아직 화면에서 안 쓴다 — 3단계 버튼을 붙일 자리를 미리 비워둔 것이고,
//    쓰이지 않는 분기가 아니라 schedule()의 규칙 자체라 테스트가 직접 검증한다.
export const GRADES = ["again", "hard", "good"];

export function newEntry(now = Date.now()) {
  return { due: now, ivl: 0, ease: EASE_START, reps: 0, lapses: 0 };
}

// 옛 레코드·깨진 값도 항상 정상 엔트리로 읽는다(클라우드 저장이 붙는 M3에서 서버가 돌려주는
// 값을 그대로 믿지 않기 위해서다 — js/learning/srs.js의 normalizeEntry와 같은 이유).
function normalize(entry, now) {
  if (!entry || typeof entry !== "object") return newEntry(now);
  return {
    due: Number.isFinite(entry.due) ? entry.due : now,
    ivl: Number.isFinite(entry.ivl) && entry.ivl >= 0 ? entry.ivl : 0,
    ease: Number.isFinite(entry.ease) ? Math.max(EASE_MIN, entry.ease) : EASE_START,
    reps: Number.isInteger(entry.reps) && entry.reps >= 0 ? entry.reps : 0,
    lapses: Number.isInteger(entry.lapses) && entry.lapses >= 0 ? entry.lapses : 0,
  };
}

// SM-2 변형. 처음 두 번은 고정(1일 → 3일)이고 그 뒤부터 `간격 × ease`로 늘어난다 —
// 초반에 ease를 곱하면 간격이 아직 신뢰할 수 없는 상태에서 튀어버린다.
export function schedule(entry, grade, now = Date.now()) {
  const cur = normalize(entry, now);
  if (grade === "again") {
    // 틀리면 간격을 처음으로 되돌리고 ease를 깎는다. **삭제(졸업)는 없다** — 오늘 안에 다시 나온다.
    return { due: now, ivl: 0, ease: Math.max(EASE_MIN, cur.ease - 0.2), reps: 0, lapses: cur.lapses + 1 };
  }
  let ivl;
  if (grade === "hard") ivl = cur.ivl === 0 ? 1 : cur.ivl * 1.2;
  else if (cur.reps === 0) ivl = 1;
  else if (cur.reps === 1) ivl = 3;
  else ivl = cur.ivl * cur.ease;
  ivl = Math.min(MAX_INTERVAL_DAYS, Math.max(1, Math.round(ivl)));
  const ease = grade === "hard" ? Math.max(EASE_MIN, cur.ease - 0.15) : cur.ease;
  return { due: now + ivl * DAY, ivl, ease, reps: cur.reps + 1, lapses: cur.lapses };
}

export function isDue(entry, now = Date.now()) {
  return normalize(entry, now).due <= now;
}

// 오늘 볼 단어 id — 오래 밀린 것부터. 단어 내용은 모른다(loader가 DAY 파일을 열어 채운다).
export function dueIds(cards, now = Date.now()) {
  return Object.entries(cards || {})
    .filter(([, entry]) => isDue(entry, now))
    .sort((a, b) => normalize(a[1], now).due - normalize(b[1], now).due)
    .map(([id]) => id);
}

// 마이페이지·인트로 문구용 집계. `learned`는 "한 번이라도 맞혀서 일정에 올라간" 단어 수다.
export function summarize(cards, now = Date.now()) {
  const entries = Object.values(cards || {});
  return {
    seen: entries.length,
    due: entries.filter((e) => isDue(e, now)).length,
    learned: entries.filter((e) => normalize(e, now).reps > 0).length,
    leech: entries.filter((e) => normalize(e, now).lapses >= 5).length,
  };
}
