// DISC 채점. 전부 순수 함수로 두고 state를 읽지 않는다 — 그래야 node --test로 검증할 수 있다.
// (ADHD 쪽 computeResult는 state를 직접 읽어서 테스트가 불가능하다.)

export const AXES = ["D", "I", "S", "C"];

// DISC를 지탱하는 두 축:
//   속도    빠름 D·I  /  신중 S·C
//   우선순위 과제 D·C  /  사람 I·S
// 두 축 모두에서 정반대인 쌍이 대척점이다. 정통 12유형 분류에 DS/SD/IC/CI 조합이
// 없는 이유이기도 하다 — 서로 모순이라 한 사람 안에서 동시에 높을 수 없다.
export const OPPOSITE = { D: "S", S: "D", I: "C", C: "I" };

export const PACE = { D: "fast", I: "fast", S: "slow", C: "slow" };
export const PRIORITY = { D: "task", C: "task", I: "people", S: "people" };

// 응답 하나당 한 축이 +1, 다른 한 축이 -1이라 축별 원점수는 [-문항수, +문항수],
// 네 축의 합은 항상 0이다(ipsative). 무작위로 답하면 축별 표준편차가 √(문항수/2)라
// 12문항이면 약 2.45 — 아래 두 기준값은 이 분포를 기준으로 잡았다.
const SECONDARY_MIN = 2; // 1 SD에 못 미치는 2위는 노이즈와 구분되지 않는다
const SECONDARY_GAP = 3; // 1·2위 차이가 이보다 크면 조합형이 아니라 순수형
const FLAT_MAX = 2; // 1위가 이 정도면 "성향이 뚜렷하지 않음"으로 안내
const NEAR_TIE = 1; // 1·2위가 이 차이 이내면 "다시 하면 바뀔 수 있음"으로 안내

export function emptyRaw() {
  return { D: 0, I: 0, S: 0, C: 0 };
}

export function scoreTetrads(answers) {
  const raw = emptyRaw();
  const mostCount = emptyRaw();
  for (const a of answers) {
    if (!(a.most in raw) || !(a.least in raw)) throw new Error(`알 수 없는 축: ${a.most}/${a.least}`);
    if (a.most === a.least) throw new Error("가장 나 같은 것과 아닌 것이 같을 수 없다");
    raw[a.most] += 1;
    raw[a.least] -= 1;
    mostCount[a.most] += 1;
  }
  return { raw, mostCount };
}

export function addBonus(raw, bonus, itemCount) {
  const out = emptyRaw();
  for (const ax of AXES) {
    out[ax] = Math.max(-itemCount, Math.min(itemCount, raw[ax] + (bonus[ax] || 0)));
  }
  return out;
}

// 원점수를 0~100으로 옮긴다. 50%가 중립이고, 네 축의 합은 늘 200 근처다.
// "크기"가 아니라 "어느 쪽으로 기울었는지"를 읽는 값이라는 걸 결과 화면에서 밝혀준다.
export function toPct(rawValue, itemCount) {
  const pct = Math.round(((rawValue + itemCount) / (2 * itemCount)) * 100);
  return Math.max(0, Math.min(100, pct));
}

export function resolveDiscType(raw, mostCount = emptyRaw()) {
  const ranked = AXES.slice().sort(
    (a, b) =>
      raw[b] - raw[a] || // 1순위: 원점수
      mostCount[b] - mostCount[a] || // 2순위: 같은 점수면 "가장 나 같다"를 더 많이 받은 쪽
      AXES.indexOf(a) - AXES.indexOf(b) // 3순위: 고정 순서 (완전히 결정론적으로)
  );
  const primary = ranked[0];
  const secondary =
    ranked
      .slice(1)
      .find(
        (ax) =>
          ax !== OPPOSITE[primary] &&
          raw[ax] >= SECONDARY_MIN &&
          raw[primary] - raw[ax] <= SECONDARY_GAP
      ) || null;

  return {
    key: primary + (secondary || ""),
    primary,
    secondary,
    ranked,
    // 아래 두 플래그는 유형을 바꾸지 않고, 결과 화면에 덧붙일 안내를 고르는 데만 쓴다.
    flat: raw[primary] <= FLAT_MAX,
    nearTie: raw[primary] - raw[ranked[1]] <= NEAR_TIE,
  };
}

// 딜레마 게임 결과를 축 보너스로 환산한다.
//   선택 내용   → 우선순위(과제/사람)
//   결정 지연시간 → 속도(빠름/신중)
// 두 신호가 겹치는 한 사분면이 곧 한 축이다. 다만 지연시간은 읽는 속도·기기 성능에
// 쉽게 오염되므로, 응답이 일관될 때만 쓰고 축당 +1을 넘지 않게 묶었다. 문항 12개짜리
// 검사에서 +1은 문항 하나 분량이라, 박빙일 때 조합형을 갈라놓을 수는 있어도
// 뚜렷하게 갈린 1위를 뒤집지는 못한다.
export function dilemmaBonus(summary) {
  const bonus = emptyRaw();
  if (!summary) return bonus;
  const total = summary.taskCount + summary.peopleCount;
  if (!total) return bonus;

  const need = Math.ceil(total * 0.75); // 3/4 이상 한쪽으로 몰려야 "경향"으로 인정
  const taskLean = summary.taskCount >= need;
  const peopleLean = summary.peopleCount >= need;
  if (!taskLean && !peopleLean) return bonus;

  const priority = taskLean ? "task" : "people";
  if (!summary.paceBand) {
    // 속도 신호가 못 미더우면 우선순위만 반영한다 (해당 우선순위의 두 축에 +1씩)
    for (const ax of AXES) if (PRIORITY[ax] === priority) bonus[ax] = 1;
    return bonus;
  }
  for (const ax of AXES) {
    if (PRIORITY[ax] === priority && PACE[ax] === summary.paceBand) bonus[ax] = 1;
  }
  return bonus;
}

// 라운드 로그를 요약한다.
//
// 지연시간은 밀리초 그대로 쓰지 않고 선택지 글자 수로 나눈다. 글자가 많으면 읽는 데
// 오래 걸리는 게 당연해서, 그대로 두면 "긴 문장이 나온 사람 = 신중한 사람"이 돼버린다.
//
// 처음엔 사용자 자신의 중앙값으로 빠름/느림을 나누려 했는데, 중앙값 분할은 정의상
// 항상 절반씩 갈린다. 일관되게 빠른 사람일수록 값이 촘촘히 모여서 오히려 어느 쪽도
// 아닌 걸로 나오는, 잡으려던 신호를 스스로 지우는 방식이었다. 그래서 글자당 시간을
// 고정 기준과 비교하고, 8라운드 중 6라운드 이상이 같은 쪽일 때만 인정한다.
const FAST_MS_PER_CHAR = 70; // 선택지 글자당 이 시간 미만이면 "빠른 결정"
const PACE_CONSISTENCY = 6; // 8라운드 중 이만큼 한쪽으로 몰려야 경향으로 인정

export function summarizeDilemma(rounds) {
  const answered = rounds.filter((r) => !r.timedOut);
  const timeouts = rounds.length - answered.length;
  const taskCount = rounds.filter((r) => r.choice === "task").length;
  const peopleCount = rounds.filter((r) => r.choice === "people").length;

  let paceBand = null;
  // 시간초과가 잦으면 신중한 게 아니라 딴 데 정신이 팔린 것에 가깝다 — 속도 신호를 버린다.
  if (answered.length >= PACE_CONSISTENCY && timeouts < 3) {
    const perChar = answered.map((r) => r.ms / Math.max(1, r.length));
    const fast = perChar.filter((v) => v < FAST_MS_PER_CHAR).length;
    const slow = perChar.length - fast + timeouts; // 시간초과는 신중 쪽 신호로만 센다
    if (fast >= PACE_CONSISTENCY) paceBand = "fast";
    else if (slow >= PACE_CONSISTENCY) paceBand = "slow";
  }

  return { rounds: rounds.length, answered: answered.length, timeouts, taskCount, peopleCount, paceBand };
}
