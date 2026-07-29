// 부부 관계 성향 체크의 개인 채점 (기획서 §5). DOM을 모르는 순수 함수만 둔다 —
// 그래야 node --test로 브라우저 없이 채점 불변식을 검증할 수 있다.
import { BEHAVIOR_ITEMS, ATTACH_ITEMS, CONFLICT_ITEMS } from "./data.js";

// 역채점 대상(§4 v3.0). 모든 문항이 같은 방향이면 읽지 않고 한쪽으로만 찍는 응답을
// 걸러낼 수 없고 점수가 실제보다 부풀려진다. 요인마다 최소 1개씩 들어 있다.
export const REVERSE_CODES = new Set(["D4", "I4", "S4", "C4", "A4", "V4", "SC3", "OC3", "R6"]);

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
};

export const QC1_EXPECTED = 2;
const QC_CONSISTENCY_GAP = 3;
const STRAIGHT_LINE_RATIO = 0.8;
const MIN_ELAPSED_MS = 120000;

// ---------------------------------------------------------------- 원점수·정규화

export function scoreItem(code, value) {
  if (!(value >= 1 && value <= 5)) throw new Error(`${code}의 응답값이 범위를 벗어났다: ${value}`);
  return REVERSE_CODES.has(code) ? 6 - value : value;
}

export function factorRaw(answers, codes) {
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

// 플래그 2개 이상이면 결과를 내지 않고 재응답을 유도한다. 부정확한 데이터로 산출된
// 인지 격차는 부부에게 도움이 되기는커녕 다툼거리만 만든다.
export function validityCheck(answers, elapsedMs) {
  const flags = [];
  if (answers.QC1 !== QC1_EXPECTED) flags.push("지시 이행 문항의 답이 안내와 다릅니다");
  if (Math.abs(answers.QC2 - answers.I1) >= QC_CONSISTENCY_GAP) {
    flags.push("비슷한 내용의 두 문항에 크게 다르게 답하셨습니다");
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
    verdict: flags.length >= 2 ? "blocked" : flags.length === 1 ? "warn" : "ok",
  };
}

// ---------------------------------------------------------------- §5.3 행동성향 유형

// 동점이면 이 순서로 앞선 요인이 이긴다. 무작위로 고르면 같은 응답이 새로고침마다
// 다른 유형을 내놓는다.
const TIE_BREAK = ["D", "C", "S", "I"];

export function resolveBehavior(norm) {
  const ranked = BEHAVIOR_AXES.slice().sort(
    (a, b) => norm[b] - norm[a] || TIE_BREAK.indexOf(a) - TIE_BREAK.indexOf(b)
  );
  const primary = ranked[0];
  const secondary = ranked[1];
  const margin = norm[primary] - norm[secondary];
  const step = stepOf(FACTOR_ITEMS[primary].length);

  // 유형 라벨은 언제나 primary 하나로만 정한다. 경계 사례를 감추는 대신 확신도로 드러내는
  // 것이 v3.0의 방침이다 — 유형을 더 잘게 쪼개면 오분류만 늘어난다.
  let confidence = "edge";
  if (margin >= step * 2) confidence = "clear";
  else if (margin >= step) confidence = "moderate";

  return { primary, secondary, ranked, margin, confidence };
}

// ---------------------------------------------------------------- §5.4 애착 4분류

const ATTACH_MIDPOINT = 50;

// 중앙값 절단은 편의적 기준이고 애착은 원래 연속 변인이다. 원점수가 중앙값 ±1점이면
// 그 축을 단정하지 않고 "중간 정도"로 서술하도록 mixed를 세워둔다.
function axisState(raw, itemCount) {
  const mid = itemCount * 3; // 문항당 3점 = 척도 중앙값
  return { raw, norm: normalize(raw, itemCount), mixed: Math.abs(raw - mid) <= 1 };
}

export function resolveAttachment(anxRaw, avoRaw) {
  const anx = axisState(anxRaw, FACTOR_ITEMS.ANX.length);
  const avo = axisState(avoRaw, FACTOR_ITEMS.AVO.length);
  const anxHigh = anx.norm >= ATTACH_MIDPOINT;
  const avoHigh = avo.norm >= ATTACH_MIDPOINT;
  const key = anxHigh ? (avoHigh ? "Fe" : "An") : avoHigh ? "Av" : "Se";
  return { key, anx, avo, anxHigh, avoHigh, midpoint: ATTACH_MIDPOINT };
}

// ---------------------------------------------------------------- §5.5 갈등 대처 2축 → 5스타일

const CONFLICT_LOW = 40;
const CONFLICT_HIGH = 60;

export function resolveConflict(scNorm, ocNorm) {
  const scHigh = scNorm >= CONFLICT_HIGH;
  const ocHigh = ocNorm >= CONFLICT_HIGH;
  const scLow = scNorm < CONFLICT_LOW;
  const ocLow = ocNorm < CONFLICT_LOW;

  let style = "compromise";
  if (scHigh && ocLow) style = "compete";
  else if (scLow && ocHigh) style = "accommodate";
  else if (scLow && ocLow) style = "avoid";
  else if (scHigh && ocHigh) style = "collaborate";

  // 기획서는 경계 판정 폭을 6.25로 적어뒀지만 그 값은 4문항 척도(§5.3)의 한 칸이다.
  // 갈등 두 축은 3문항이라 한 칸이 8.33점이고, 6.25를 쓰면 원점수 1점 차이로 스타일이
  // 바뀌는 경우의 절반(33.3점·66.7점 쪽)이 경계로 잡히지 않는다. 척도에서 파생된
  // 칸 크기를 쓴다 — 규칙의 의도가 "한 칸 차이로 뒤집히면 인접 스타일도 같이 언급"이다.
  const step = stepOf(FACTOR_ITEMS.SC.length);
  const dist = Math.min(
    Math.abs(scNorm - CONFLICT_LOW),
    Math.abs(scNorm - CONFLICT_HIGH),
    Math.abs(ocNorm - CONFLICT_LOW),
    Math.abs(ocNorm - CONFLICT_HIGH)
  );

  return { style, confidence: dist < step ? "edge" : "clear", sc: scNorm, oc: ocNorm };
}

// ---------------------------------------------------------------- 전체 채점

/**
 * 응답 전체를 받아 개인 결과를 만든다.
 * @param {Object} answers 문항 코드 → 1~5
 * @param {{elapsedMs?:number|null, setup?:Object}} opts
 *        elapsedMs가 null이면 속도 검사를 건너뛴다. setup은 결과에 그대로 실려
 *        배우자 코드(match.js)와 리포트 서사에 쓰인다.
 */
export function computeCouple(answers, { elapsedMs = null, setup = null } = {}) {
  const validity = validityCheck(answers, elapsedMs);

  const raw = {};
  const norm = {};
  for (const [factor, codes] of Object.entries(FACTOR_ITEMS)) {
    raw[factor] = factorRaw(answers, codes);
    norm[factor] = normalize(raw[factor], codes.length);
  }

  const behavior = resolveBehavior(norm);
  const attachment = resolveAttachment(raw.ANX, raw.AVO);
  const conflict = resolveConflict(norm.SC, norm.OC);

  return {
    setup,
    validity,
    raw,
    norm,
    behavior,
    attachment,
    conflict,
    typeKey: `${behavior.primary}-${attachment.key}`,
    // 부부 비교에 쓰이는 개별 문항값. 문장이 양쪽에 동일한 것만 담는다(§5.6) —
    // R1~R4는 역할마다 문장이 달라 측정 동등성이 없으므로 여기 들어오면 안 된다.
    comparable: {
      AN1: answers.AN1,
      AN2: answers.AN2,
      AN3: answers.AN3,
      R5: answers.R5,
      R6: answers.R6,
      K2: answers.K2,
      K4: answers.K4,
    },
  };
}
