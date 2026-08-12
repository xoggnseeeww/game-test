// 부부 관계 성향 체크의 개인 채점 (기획서 §5). DOM을 모르는 순수 함수만 둔다 —
// 그래야 node --test로 브라우저 없이 채점 불변식을 검증할 수 있다.
import { BEHAVIOR_ITEMS, ATTACH_ITEMS, CONFLICT_ITEMS, LOVE_ITEMS, LOVE_AXES, ANCHOR_CONCEPTS } from "./data.js";

// 역채점 대상(§4). 모든 문항이 같은 방향이면 읽지 않고 한쪽으로만 찍는 응답을
// 걸러낼 수 없고 점수가 실제보다 부풀려진다. 요인마다 최소 1개씩 들어 있다.
// 앵커에는 넣지 않는다 — 두 사람의 응답을 직접 빼는 용도라 방향 일관성이 더 중요하다(§4.4).
export const REVERSE_CODES = new Set([
  "D4", "I4", "S4", "C4", "A4", "V4", "SC3", "OC3", "R6",
  "LW2", "LT2", "LG2", "LS2", "LP2",
]);

export const BEHAVIOR_AXES = ["D", "I", "S", "C"];

// 요인별 문항 코드. 문항을 늘리거나 줄이면 여기가 자동으로 따라오고, 정규화 분모도
// 같이 움직인다 — "축당 4문항"을 상수로 박아두면 문항만 늘렸을 때 조용히 틀린다.
function codesOf(items, factor) {
  return items.filter((i) => i.factor === factor).map((i) => i.code);
}

export const FACTOR_ITEMS = {
  D: codesOf(BEHAVIOR_ITEMS, "D"),
  I: codesOf(BEHAVIOR_ITEMS, "I"),
  S: codesOf(BEHAVIOR_ITEMS, "S"),
  C: codesOf(BEHAVIOR_ITEMS, "C"),
  ANX: codesOf(ATTACH_ITEMS, "ANX"),
  AVO: codesOf(ATTACH_ITEMS, "AVO"),
  SC: codesOf(CONFLICT_ITEMS, "SC"),
  OC: codesOf(CONFLICT_ITEMS, "OC"),
  LW: codesOf(LOVE_ITEMS, "LW"),
  LT: codesOf(LOVE_ITEMS, "LT"),
  LG: codesOf(LOVE_ITEMS, "LG"),
  LS: codesOf(LOVE_ITEMS, "LS"),
  LP: codesOf(LOVE_ITEMS, "LP"),
};

const QC1_EXPECTED = 2;
const QC_CONSISTENCY_GAP = 3;
const STRAIGHT_LINE_RATIO = 0.8;
const MIN_ELAPSED_MS = 130000;
// 역채점 정합성: 요인 하나가 어긋나는 것은 우연일 수 있으므로 2개 요인 이상일 때만 센다.
// 임계값이 3이 아니라 3.5인 이유(§5.0 v3.3): 정방향 3문항에 5·5·5로 답하고 역채점 문항에
// 4점을 준 사람은 차이가 정확히 3.0이라 `>=3`에 걸린다. 자기모순이 있는 응답인 건 맞지만
// 검사가 원래 잡으려는 대상(안 읽고 찍기)과 겹친다고 단정하기는 어려워, 한 단계 보수화했다.
// 3.5가 맞는 값인지는 실제 응답 분포를 봐야 아는 것이라 잠정값이다.
const REVERSE_MISMATCH_GAP = 3.5;
const REVERSE_MISMATCH_MIN = 2;
// 같은 개념의 앵커 두 문항이 이만큼 벌어지면 본인 응답 자체가 흔들린 것으로 본다.
const ANCHOR_INCONSISTENT_GAP = 3;

// ---------------------------------------------------------------- 원점수·정규화

export function scoreItem(code, value) {
  if (!(value >= 1 && value <= 5)) throw new Error(`${code}의 응답값이 범위를 벗어났다: ${value}`);
  return REVERSE_CODES.has(code) ? 6 - value : value;
}

function factorRaw(answers, codes) {
  let sum = 0;
  for (const code of codes) {
    const v = answers[code];
    if (v === undefined) throw new Error(`${code}에 응답이 없다`);
    sum += scoreItem(code, v);
  }
  return sum;
}

// 원점수를 0~100으로 옮긴다. 문항당 최소 1점·최대 5점이므로 분모는 문항 수에서 파생된다.
// 4문항이면 한 칸이 6.25점, 3문항이면 8.33점 — 이 칸 크기가 아래 경계 판정의 기준이다.
export function normalize(rawSum, itemCount) {
  return ((rawSum - itemCount) / (4 * itemCount)) * 100;
}

export function stepOf(itemCount) {
  return 100 / (4 * itemCount);
}

// ---------------------------------------------------------------- §5.0 응답 유효성 사전 검사

// 문항을 읽지 않고 한쪽으로만 찍으면 정방향 문항 평균과 역채점 문항의 변환값이 크게
// 어긋난다. 역채점 문항이 원래 잡아내도록 설계된 행동을 그대로 검사로 쓰는 것이라
// 문항을 새로 추가하지 않아도 되고, 특정 문항쌍이 아니라 여러 요인을 훑으므로
// 국소적 위양성에도 강하다(§5.0 응답 일관성 ②).
//
// 갈등 두 축(SC·OC)은 정방향이 2문항뿐이라 평균이 거칠어 위양성이 늘 수 있으므로
// 기획서가 지정한 6개 요인만 본다. 애정 표현 5유형(LW/LT/LG/LS/LP, D-102)은 정방향이
// **1문항뿐**이라 SC·OC보다도 더 거칠다 — 같은 이유로 여기 넣지 않는다.
const REVERSE_CHECK_FACTORS = ["D", "I", "S", "C", "ANX", "AVO"];

export function reverseMismatchCount(answers) {
  let count = 0;
  for (const factor of REVERSE_CHECK_FACTORS) {
    const codes = FACTOR_ITEMS[factor];
    const reverse = codes.filter((c) => REVERSE_CODES.has(c));
    const forward = codes.filter((c) => !REVERSE_CODES.has(c));
    if (reverse.length !== 1 || !forward.length) continue;
    const forwardMean = forward.reduce((acc, c) => acc + answers[c], 0) / forward.length;
    const reverseConv = 6 - answers[reverse[0]];
    if (Math.abs(forwardMean - reverseConv) >= REVERSE_MISMATCH_GAP) count += 1;
  }
  return count;
}

// 플래그 2개 이상이면 결과를 내지 않고 재응답을 유도한다. 부정확한 데이터로 산출된
// 성향 서술은 도움이 되기는커녕 자기 이해를 엉뚱한 쪽으로 굳힌다.
export function validityCheck(answers, elapsedMs) {
  const flags = [];
  if (answers.QC1 !== QC1_EXPECTED) flags.push("지시 이행 문항의 답이 안내와 다릅니다");
  if (Math.abs(answers.QC2 - answers.I1) >= QC_CONSISTENCY_GAP) {
    flags.push("비슷한 내용의 두 문항에 크게 다르게 답하셨습니다");
  }
  if (reverseMismatchCount(answers) >= REVERSE_MISMATCH_MIN) {
    flags.push("방향이 반대인 문항들의 답이 서로 엇갈립니다");
  }

  const counts = {};
  const values = Object.values(answers);
  for (const v of values) counts[v] = (counts[v] || 0) + 1;
  const topRatio = Math.max(...Object.values(counts)) / values.length;
  if (topRatio >= STRAIGHT_LINE_RATIO) flags.push("대부분의 문항에 같은 값으로 답하셨습니다");

  if (elapsedMs !== null && elapsedMs < MIN_ELAPSED_MS) flags.push("응답이 매우 빠르게 진행됐습니다");

  return {
    flags,
    count: flags.length,
    // blocked면 결과 자체를 내지 않고, warn이면 결과 상단에 정확도 고지를 붙인다.
    // 화면 고지 문구는 사유를 특정하지 않는다 — 속도 외의 사유로 플래그가 섰을 때
    // "빠르게 진행되어"라고 안내하면 사실과 다른 말이 나간다(§5.0 v3.1 교정 3).
    verdict: flags.length >= 2 ? "blocked" : flags.length === 1 ? "warn" : "ok",
  };
}

// ---------------------------------------------------------------- §4.4·§7.3 앵커 개념 점수

// 개념 점수 = 같은 개념 두 문항의 평균(1.0~5.0, 0.5 단위). 두 문항이 3점 이상 벌어지면
// 본인 응답 자체가 흔들린 것이므로 점수는 내되 격차 항목으로는 노출하지 않는다 —
// 흔들리는 응답을 부부 간 격차로 제시하면 근거 없는 갈등을 만든다(§7.3 앵커 내부 일관성).
export function anchorScores(answers) {
  const out = {};
  for (const { key } of ANCHOR_CONCEPTS) {
    const a = answers[`${key}a`];
    const b = answers[`${key}b`];
    out[key] = { score: (a + b) / 2, consistent: Math.abs(a - b) < ANCHOR_INCONSISTENT_GAP };
  }
  return out;
}

// ---------------------------------------------------------------- §5.3 행동성향 유형

// 동점 처리(§5.3 v3.3 재설계). 예전에는 `D > C > S > I` 고정 순서로 갈랐다. 개인에게는 큰
// 영향이 없지만(완전 동점이면 확신도가 늘 "경계"로 표기되고 리포트도 두 성향을 함께 서술한다),
// **집계에서는 동점 사례 전원이 D로 코드화되어 D형 비중이 실제보다 부풀려진다.** 문항 자체가
// 사회적 바람직성 편향을 이미 안고 있는데 타이브레이크가 그 위에 한 방향으로 더 얹는 구조였다.
//
// 시드는 요인 원점수에서 뽑는다. 같은 응답이면 새로고침해도 같은 결과가 나오고(재현성),
// 사용자 간에는 고르게 흩어진다. (원점수에서 뽑는 이유는 원래 "배우자 기기에서 다시
// 채점해도 같은 순서가 나오게" 하기 위해서였다 — 그 흐름은 D-99에서 없어졌지만, 응답
// 원본이 아니라 원점수를 쓰는 편이 여전히 단순하다.)
export function seedFromRaw(raw) {
  let h = 2166136261;
  for (const factor of Object.keys(FACTOR_ITEMS)) {
    h ^= raw[factor];
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// 축 배열을 시드로 섞는다. `tieBreakOrder(seed)`는 이 로직을 BEHAVIOR_AXES에 고정해
// 쓰던 기존 시그니처를 그대로 유지한다(외부에서 `tieBreakOrder(seed)`로 호출하는
// 기존 코드·테스트를 안 건드리기 위해서) — 애정 표현 5유형(D-102)처럼 다른 축 배열에도
// 같은 셔플이 필요해지면서 내부 로직만 `shuffleAxes()`로 뽑아냈다.
function shuffleAxes(axes, seed) {
  const order = axes.slice();
  let s = seed >>> 0;
  for (let i = order.length - 1; i > 0; i--) {
    s = (Math.imul(s, 1103515245) + 12345) >>> 0;
    const j = s % (i + 1);
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order;
}

export function tieBreakOrder(seed) {
  return shuffleAxes(BEHAVIOR_AXES, seed);
}

// 요인 배열 하나에서 최댓값 하나를 primary로 뽑는다. resolveBehavior(4요인)와
// resolveLoveLanguage(5요인, D-102)가 축 개수만 다르고 로직은 완전히 같아서 공유한다.
//
// 유형 라벨은 언제나 primary 하나로만 정한다. 경계 사례를 감추는 대신 확신도로 드러낸다 —
// 유형을 더 잘게 쪼개면 오분류만 늘어난다.
//
// 임계값이 3칸/2칸인 이유(§5.3 v3.1 재조정): 정규화 점수가 한 칸 단위의 이산값이라
// "1칸 이상이면 보통"으로 두면 원점수 1점 차이 — 문항 하나에 4점 대신 5점을 누른 것 —
// 까지 단정적으로 서술하게 된다. 가장 불안정한 사례를 오히려 확신 있게 전달하는 구조라,
// 1칸 차이는 "경계"로 흡수한다.
function resolveTopFactor(axes, norm, seed) {
  const tieBreak = shuffleAxes(axes, seed);
  const ranked = axes.slice().sort(
    (a, b) => norm[b] - norm[a] || tieBreak.indexOf(a) - tieBreak.indexOf(b)
  );
  const primary = ranked[0];
  const secondary = ranked[1];
  const margin = norm[primary] - norm[secondary];
  const step = stepOf(FACTOR_ITEMS[primary].length);

  let confidence = "edge";
  if (margin >= step * 3) confidence = "clear";
  else if (margin >= step * 2) confidence = "moderate";

  return { primary, secondary, ranked, margin, confidence };
}

export function resolveBehavior(norm, seed = 0) {
  return resolveTopFactor(BEHAVIOR_AXES, norm, seed);
}

// ---------------------------------------------------------------- §5.4 애착 4분류

const ATTACH_MIDPOINT = 50;

// 중앙값 절단은 편의적 기준이고 애착은 원래 연속 변인이다.
//  - 라벨: 원점수 ≥ 중앙값(12점) → "높음". 16유형 체계가 라벨을 반드시 하나 요구하므로
//    경계 구간에서도 규칙 하나로 확정한다(§5.4 v3.1 — 이 규칙이 없으면 구현자 임의 판단이 된다).
//  - 확신도: 원점수가 중앙값 ±1점(11~13)이면 그 축은 "경계". 라벨은 주되 단정하지 않는다.
function axisState(raw, itemCount) {
  const mid = itemCount * 3; // 문항당 3점 = 척도 중앙값
  return { raw, norm: normalize(raw, itemCount), high: raw >= mid, edge: Math.abs(raw - mid) <= 1 };
}

export function resolveAttachment(anxRaw, avoRaw) {
  const anx = axisState(anxRaw, FACTOR_ITEMS.ANX.length);
  const avo = axisState(avoRaw, FACTOR_ITEMS.AVO.length);
  const key = anx.high ? (avo.high ? "AT4" : "AT2") : avo.high ? "AT3" : "AT1";
  return {
    key,
    anx,
    avo,
    midpoint: ATTACH_MIDPOINT,
    // 유형 전체의 확신도는 두 축 중 더 낮은 쪽을 따른다(§5.4).
    confidence: anx.edge || avo.edge ? "edge" : "clear",
  };
}

// ---------------------------------------------------------------- §5.5 갈등 대처 2축 → 5스타일

// 절단점을 정규화 점수(40/60)가 아니라 **원점수**로 정의한다. SC·OC는 3문항 척도라
// 정규화 점수가 8.33점 단위의 이산값만 갖고, 40점·60점은 어떤 응답 조합으로도 도달할 수
// 없는 값이다(가능한 값은 … 33.33, 41.67, 50, 58.33, 66.67 …). 문서에 40/60이라 적고
// 실제로는 33.33/66.67에서 갈리면 읽는 사람이 다른 분포를 예상하게 된다.
const CONFLICT_LOW_MAX = 7; // 3~7 낮음
const CONFLICT_HIGH_MIN = 11; // 11~15 높음
// 절단점 바로 옆 값. 원점수 1점 차이로 스타일이 뒤집히는 자리라 인접 스타일도 함께 언급한다.
const CONFLICT_EDGE_RAWS = [7, 8, 10, 11];

function conflictLevel(raw) {
  if (raw <= CONFLICT_LOW_MAX) return "low";
  if (raw >= CONFLICT_HIGH_MIN) return "high";
  return "mid";
}

export function resolveConflict(scRaw, ocRaw) {
  const sc = conflictLevel(scRaw);
  const oc = conflictLevel(ocRaw);

  // 절충형(CS5)은 "양축이 모두 중간"이 아니라 **한 축만 중간인 조합까지 포함**하는
  // 나머지 전부다. 그래서 실제 분포에서 비중이 커질 수 있다.
  let style = "CS5";
  if (sc === "high" && oc === "low") style = "CS1"; // 관철형
  else if (sc === "low" && oc === "high") style = "CS2"; // 맞춰주기형
  else if (sc === "low" && oc === "low") style = "CS3"; // 보류형
  else if (sc === "high" && oc === "high") style = "CS4"; // 조율형

  return {
    style,
    confidence:
      CONFLICT_EDGE_RAWS.includes(scRaw) || CONFLICT_EDGE_RAWS.includes(ocRaw) ? "edge" : "clear",
    scRaw,
    ocRaw,
  };
}

// ---------------------------------------------------------------- 애정 표현 5유형 (D-102)

// 성향(§5.3)과 로직이 완전히 같다 — 축이 4개에서 5개로 바뀌었을 뿐이라 `resolveTopFactor()`를
// 그대로 재사용한다. 다른 세 유형 체계(성향·애착·갈등)와 곱해서 COUPLE_TYPES 같은 조합
// 유형을 만들지 않는다 — 16 × 5 = 80개는 이 방식(문구 손수 작성)으로 감당할 수 없는
// 규모라, 완전히 독립된 결과로만 낸다(§6 참고, `docs/couple-architecture.md`).
export function resolveLoveLanguage(norm, seed = 0) {
  return resolveTopFactor(LOVE_AXES, norm, seed);
}

// ---------------------------------------------------------------- 개인 읽을거리 (§7.3·§7.4를 1인용으로)

// 앵커(AN)·역할(R)·자녀(K) 문항은 예전엔 **부부 결합 리포트에서만** 쓰였다. 그 흐름을
// 없애면서(D-99) 이 문항들이 전부 죽은 문항이 될 뻔했다 — 답은 하는데 결과에는 안 나오는
// 문항이 절반 가까이 되는 셈이라, 그 자체로 결과가 부실해 보이는 원인이다. 두 사람의 답을
// 빼는 대신 **내 답을 그대로 읽어주는** 쪽으로 옮겼다.
//
// 부부 비교가 아니라 자기보고라서 §6.5.3(격차의 방향·지목 금지)과 충돌하지 않는다 —
// 비교 대상이 없으니 지목할 상대도 없다.
//
// `watch`는 "이 방향으로 나오면 눈여겨볼 값"이다. 그 방향일 때만 대화 문장을 붙인다 —
// 전부 붙이면 조언이 배경음이 되고, 정작 지금 필요한 한 줄이 묻힌다(§8.4의 취지).
export const SELF_READINGS = [
  { key: "AN1", group: "feel", codes: ["AN1a", "AN1b"], watch: "low" },
  { key: "AN2", group: "feel", codes: ["AN2a", "AN2b"], watch: "high" },
  { key: "AN3", group: "feel", codes: ["AN3a", "AN3b"], watch: "high" },
  { key: "ROLE_LOAD", group: "role", codes: ["R1", "R2"], watch: "high" },
  { key: "ROLE_FIT", group: "role", codes: ["R4", "R5"], watch: "low" },
  // R6은 역채점 대상(REVERSE_CODES)이라 scoreItem을 거치면 "바꾸기 어렵다"가 뒤집혀
  // **바꿀 여지가 있다**가 높은 쪽이 된다. 다른 항목과 방향을 맞추기 위한 것이다.
  { key: "ROLE_FLEX", group: "role", codes: ["R6"], watch: "low" },
  { key: "CHILD_TALK", group: "child", codes: ["K1", "K3"], watch: "low" },
  { key: "CHILD_TIME", group: "child", codes: ["K2"], watch: "low" },
  { key: "CHILD_STRAIN", group: "child", codes: ["K4"], watch: "high" },
  { key: "CHILD_VALUES", group: "child", codes: ["K5"], watch: "low" },
];

// 구간 경계. 1~5 척도의 중앙값 3을 가운데 두고 위아래로 반 칸씩 둔다 — 3.0은 "보통이다"를
// 고른 상태라 어느 쪽으로도 읽지 않는 게 맞다. 이 폭을 ±1로 넓히면 2점대 후반이 "낮음"에서
// 빠져서, 실제로 힘들다고 답한 사람에게 아무 말도 안 하게 된다.
export const READING_LOW_MAX = 2.5;
export const READING_HIGH_MIN = 3.5;

export function readingLevel(score) {
  if (score <= READING_LOW_MAX) return "low";
  if (score >= READING_HIGH_MIN) return "high";
  return "mid";
}

/**
 * 자기보고 항목을 구간으로 읽는다.
 * @returns {Array<{key,group,score,level,watched,consistent}>}
 *   score는 1.0~5.0(문항 평균), watched는 "지금 눈여겨볼 방향으로 나왔는가",
 *   consistent는 같은 개념을 두 문항으로 묻는 앵커에서만 의미가 있다(§7.3).
 */
export function selfReadings(answers) {
  const anchors = anchorScores(answers);
  return SELF_READINGS.map((r) => {
    const score = r.codes.reduce((sum, c) => sum + scoreItem(c, answers[c]), 0) / r.codes.length;
    const level = readingLevel(score);
    return {
      key: r.key,
      group: r.group,
      score,
      level,
      watched: level === r.watch,
      // 두 문항이 3점 이상 벌어진 앵커는 본인 응답 자체가 흔들린 것이라 단정하지 않는다.
      consistent: anchors[r.key] ? anchors[r.key].consistent : true,
    };
  });
}

// ---------------------------------------------------------------- 전체 채점

/**
 * 응답 전체를 받아 개인 결과를 만든다.
 * @param {Object} answers 문항 코드 → 1~5
 * @param {{elapsedMs?:number|null, setup?:Object}} opts
 *        elapsedMs가 null이면 속도 검사를 건너뛴다. setup은 결과에 그대로 실려
 *        역할·자녀 서사를 고르는 데 쓰인다.
 */
export function computeCouple(answers, { elapsedMs = null, setup = null } = {}) {
  const validity = validityCheck(answers, elapsedMs);

  const raw = {};
  const norm = {};
  for (const [factor, codes] of Object.entries(FACTOR_ITEMS)) {
    raw[factor] = factorRaw(answers, codes);
    norm[factor] = normalize(raw[factor], codes.length);
  }

  const seed = seedFromRaw(raw);
  const behavior = resolveBehavior(norm, seed);
  const attachment = resolveAttachment(raw.ANX, raw.AVO);
  const conflict = resolveConflict(raw.SC, raw.OC);
  const love = resolveLoveLanguage(norm, seed);

  return {
    setup,
    validity,
    raw,
    norm,
    behavior,
    attachment,
    conflict,
    love,
    typeKey: `${behavior.primary}-${attachment.key}`,
    anchors: anchorScores(answers),
    // 앵커·역할·자녀 문항을 개인 결과에서 읽어주는 구간 값(D-99). 예전의 `comparable`
    // (부부 비교용 문항값 묶음)은 결합 리포트와 함께 사라졌다 — 내보낼 곳이 없는 값을
    // 결과 객체에 남겨두면, 다음 사람이 "이건 어디에 쓰이지"를 매번 다시 추적하게 된다.
    readings: selfReadings(answers),
    // 역할이 정체성에서 차지하는 비중(R3)만 막대가 아니라 한 줄 덧말로 쓴다 —
    // 높고 낮음이 좋고 나쁨이 아니라 서술의 결을 바꾸는 값이라서다.
    roleIdentity: answers.R3,
  };
}
