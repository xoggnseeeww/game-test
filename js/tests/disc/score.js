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

// 딜레마 게임: 문항과 같은 방식으로 상황마다 D/I/S/C 선택지 중 하나를 고른다.
// 예전엔 라운드마다 선택지가 2개(과제/사람)뿐이라 우선순위 축 하나만 내용으로 재고,
// 나머지(속도) 축은 클릭까지 걸린 시간으로 추론했다. 그 추론이 읽는 속도·기기 성능에
// 쉽게 흔들려서 "이번엔 안 기울었어요"로 끝나는 경우가 잦았다. 선택지를 4개로 늘려
// 한 축만 알아내지 않고 매 라운드가 네 축 다 직접 재게 했다 — 타이밍은 더 안 본다.
export function summarizeDilemma(picks) {
  const counts = emptyRaw();
  for (const p of picks) counts[p] += 1;
  return counts;
}

// 한 축에 절반 이상 몰려야 신호로 인정한다(8라운드 중 4개). 3/4 이상(6개)이면 더
// 뚜렷한 신호로 보고 +2. 고르게 흩어지면 보너스 없음 — 게임에서 억지로 신호를
// 만들어내지 않는다. 총점을 낮게 잡은 이유는 D-18과 같다: 박빙일 때 조합형을
// 갈라놓을 수는 있어도, 12문항에서 이미 뚜렷하게 갈린 1위를 뒤집지는 못해야 한다.
const LEAN_MIN = 0.5;
const LEAN_STRONG = 0.75;

export function dilemmaBonus(picks) {
  const bonus = emptyRaw();
  if (!picks || !picks.length) return bonus;
  const counts = summarizeDilemma(picks);
  const total = picks.length;
  for (const ax of AXES) {
    if (counts[ax] >= Math.ceil(total * LEAN_STRONG)) bonus[ax] = 2;
    else if (counts[ax] >= Math.ceil(total * LEAN_MIN)) bonus[ax] = 1;
  }
  return bonus;
}
