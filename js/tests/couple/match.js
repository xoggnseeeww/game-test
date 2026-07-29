// 부부 매칭 연산 (기획서 §7·§8.2)과 배우자 결과를 링크로 실어 나르는 코덱.
// score.js와 마찬가지로 순수 함수만 둔다.
//
// ⚠ 이 사이트에는 백엔드가 없다. 기획서 §10의 페어링 코드(서버 발급·72시간 만료·1회 매칭)
// 대신, 결과 계산에 필요한 값만 담은 짧은 코드를 주소에 실어 배우자에게 보낸다. 코드에
// 담기는 항목은 아래 PAYLOAD_FIELDS가 전부이고, 그중 앵커·K2·K4·R5·R6은 개별 문항 응답값이다
// (인지 격차와 게이지가 문항 단위 차이에서 나오므로 뺄 수 없다). 화면에서는 배우자의
// 문항별 응답을 어디에도 표시하지 않지만, 코드 자체는 암호화된 것이 아니라서 기획서 §6.5.1의
// "영구 비공개"를 기술적으로 보장하지는 못한다. 사전 고지 문구도 이 사실에 맞춰 적었다.
import { COUPLE_TYPES, T_AXIS, R_AXIS, K_AXIS, CONFLICT_LABELS } from "./data.js";
import { FACTOR_ITEMS, normalize, resolveBehavior, resolveAttachment, resolveConflict } from "./score.js";

// ---------------------------------------------------------------- §7.1 ΔDISC

// 4차원 벡터의 이론적 최대 거리가 200이라 2로 나눠 0~100으로 맞춘다. 이렇게 하지 않으면
// ΔDISC만 값 범위가 두 배라 가중치 0.3의 실제 영향력이 설계 의도보다 커진다.
export function deltaBehavior(normA, normB) {
  const sq = ["D", "I", "S", "C"].reduce((acc, ax) => acc + (normA[ax] - normB[ax]) ** 2, 0);
  return Math.sqrt(sq) / 2;
}

// ---------------------------------------------------------------- §7.2 애착 조합 Risk Matrix

// 집착형×거리두기형(추격자-도망자)에 최고 위험도를 주는 것은 애착이론 문헌에서 가장 잘
// 알려진 고갈등 패턴이라서다. 다만 구체적 수치는 실증값이 아니라 배정값이다 — 그래서
// 이 값에서 나온 점수를 숫자 그대로 노출하지 않는다(§7.4).
export const RISK_MATRIX = {
  Se: { Se: 0, An: 4, Av: 4, Fe: 6 },
  An: { Se: 4, An: 8, Av: 18, Fe: 14 },
  Av: { Se: 4, An: 18, Av: 10, Fe: 12 },
  Fe: { Se: 6, An: 14, Av: 12, Fe: 16 },
};

export function riskOf(keyA, keyB) {
  return RISK_MATRIX[keyA][keyB];
}

// ---------------------------------------------------------------- §7.3 Gap Score (앵커 전용)

export function itemNorm(raw) {
  return ((raw - 1) / 4) * 100;
}

export const GAP_ITEMS = [
  { code: "AN1", label: "인정 격차", desc: "우리가 하고 있는 일을 서로 알아준다고 느끼는 정도의 차이" },
  { code: "AN2", label: "부담 격차", desc: "지금 짊어진 몫이 버겁다고 느끼는 정도의 차이" },
  { code: "AN3", label: "공정성 격차", desc: "지금의 분담이 공정하다고 느끼는 정도의 차이" },
];

// 절대값만 쓰면 "누가 더 크게 느끼는지"가 사라진다. 부호를 살린 방향값도 같이 돌려줘서
// "한 분이 부담을 더 크게 느끼고 있다"처럼 방향까지 서술할 수 있게 한다.
export function gapScore(comparableA, comparableB) {
  const items = GAP_ITEMS.map(({ code, label, desc }) => {
    const a = itemNorm(comparableA[code]);
    const b = itemNorm(comparableB[code]);
    return { code, label, desc, gap: Math.abs(a - b), direction: a - b };
  });
  const total = items.reduce((acc, i) => acc + i.gap, 0) / items.length;
  return { total, items };
}

// 역할 배분의 자발성 인식 차이. R5·R6은 세 역할 버전의 문장이 같아 비교가 가능하다.
export function volitionGap(comparableA, comparableB) {
  return {
    R5: Math.abs(itemNorm(comparableA.R5) - itemNorm(comparableB.R5)),
    R6: Math.abs(itemNorm(comparableA.R6) - itemNorm(comparableB.R6)),
  };
}

// ---------------------------------------------------------------- §7.4 종합 매칭 점수

export const WEIGHTS = { delta: 0.3, risk: 1.0, gap: 0.3 };

export function matchScore({ delta, risk, gap }) {
  const penalty = WEIGHTS.delta * delta + WEIGHTS.risk * risk + WEIGHTS.gap * gap;
  return Math.max(0, 100 - penalty);
}

// ---------------------------------------------------------------- §7.5 등급 구간

// 사용자에게는 점수도 등급명도 보여주지 않는다 — 가중치와 Risk Matrix가 실증 데이터가
// 아니라 이론적 배정값이라, "62점"이라는 숫자가 근거 없는 낙인이 될 수 있어서다.
const BANDS = [
  { min: 85, tone: "두 분은 서로를 이해하는 방식이 잘 맞습니다", lead: "strength" },
  { min: 70, tone: "두 분은 대체로 잘 맞고, 몇 가지 다듬을 지점이 있습니다", lead: "balanced" },
  { min: 50, tone: "두 분이 함께 이야기 나눠볼 지점이 몇 가지 보입니다", lead: "growth" },
  { min: 0, tone: "두 분만으로 풀기 어려운 부분이 있어 보입니다. 전문가와 함께 이야기해보시면 도움이 될 수 있어요", lead: "support" },
];

// 구간 경계 ±3점은 측정 오차 범위 안이므로 더 완만한(높은) 쪽 문구를 쓴다.
// 오차 때문에 부부가 불필요하게 낙담하는 것을 막기 위한 완충이다.
const BAND_BUFFER = 3;

export function matchBand(score) {
  return BANDS.find((b) => score >= b.min - BAND_BUFFER) || BANDS[BANDS.length - 1];
}

// ---------------------------------------------------------------- §8.2 부모 역할 vs 연인 역할

// K2(단둘 시간)는 높을수록 연인 역할이 강하고, K4(양육 스트레스의 관계 침식)는 높을수록
// 약하다. 자녀 단계는 부부 공통 사실이라 두 사람이 같은 문장을 받으므로 평균을 낼 수 있다.
export function romanceRatio(comparableA, comparableB) {
  const k2 = (itemNorm(comparableA.K2) + itemNorm(comparableB.K2)) / 2;
  const k4 = (itemNorm(comparableA.K4) + itemNorm(comparableB.K4)) / 2;
  const romance = 0.5 * k2 + 0.5 * (100 - k4);
  return { romance, parenting: 100 - romance };
}

// ---------------------------------------------------------------- 결합 결과

/**
 * 두 사람의 결과를 합친다. 어느 한쪽이라도 응답 품질 플래그가 2개 이상이면 호출하지 않는다
 * (§5.0) — 부정확한 데이터로 나온 인지 격차는 부부에게 도움이 아니라 다툼거리가 된다.
 */
export function combine(a, b) {
  const delta = deltaBehavior(a.norm, b.norm);
  const risk = riskOf(a.attachment.key, b.attachment.key);
  const gap = gapScore(a.comparable, b.comparable);
  const score = matchScore({ delta, risk, gap: gap.total });

  return {
    score,
    band: matchBand(score),
    // 무엇 때문에 이 결과가 나왔는지를 알아야 부부가 실제로 개선할 지점을 찾는다.
    // 점수를 감추는 대신 구성 요소는 반드시 함께 보여준다(§7.4 규칙 2).
    components: {
      delta: { value: delta, weighted: WEIGHTS.delta * delta, max: WEIGHTS.delta * 100 },
      risk: { value: risk, weighted: WEIGHTS.risk * risk, max: WEIGHTS.risk * 18 },
      gap: { value: gap.total, weighted: WEIGHTS.gap * gap.total, max: WEIGHTS.gap * 100 },
    },
    gap,
    volition: volitionGap(a.comparable, b.comparable),
    // 자녀 단계가 서로 다르면 K문항의 문장이 갈라져 비교 근거가 사라진다. 억지로 계산해서
    // 보여주는 대신 게이지를 빼고 이유를 말한다.
    romance: a.setup.k === b.setup.k ? romanceRatio(a.comparable, b.comparable) : null,
    // 플래그가 1개인 쪽이 있으면 결과에 오차 가능 문구를 병기한다.
    lowConfidence: a.validity.count === 1 || b.validity.count === 1,
  };
}

// §8.1 부부 페르소나. 두 사람이 같은 호칭을 골랐으면(기획서가 다루지 않는 조합) 호칭 대신
// 순서 표기로 떨어뜨린다 — 결과를 못 보게 막을 이유는 없다.
export function personaName(a, b) {
  const typeA = COUPLE_TYPES[a.typeKey];
  const typeB = COUPLE_TYPES[b.typeKey];
  const labelA = T_AXIS.find((t) => t.code === a.setup.t).label;
  const labelB = T_AXIS.find((t) => t.code === b.setup.t).label;
  const stage = K_AXIS.find((k) => k.code === a.setup.k).label;
  const [nameA, nameB] =
    labelA === labelB
      ? [`${typeA.name} (나)`, `${typeB.name} (배우자)`]
      : [`${typeA.name} ${labelA}`, `${typeB.name} ${labelB}`];
  return `${nameA} × ${nameB} · ${stage}`;
}

export function conflictPairText(a, b) {
  return `${CONFLICT_LABELS[a.conflict.style]} × ${CONFLICT_LABELS[b.conflict.style]}`;
}

// ---------------------------------------------------------------- 배우자 코드 (백엔드 없음)

// 필드 순서가 곧 코드의 자리다. 순서를 바꾸거나 항목을 끼워넣으면 이미 공유된 링크가
// 조용히 다른 값으로 해석된다 — 늘리려면 VERSION을 올리고 분기해야 한다.
const VERSION = "1";
const PAYLOAD_FIELDS = [
  "t", "r", "k",
  "D", "I", "S", "C",
  "ANX", "AVO",
  "SC", "OC",
  "AN1", "AN2", "AN3",
  "R5", "R6",
  "K2", "K4",
  "flags",
];

const B36 = "0123456789abcdefghijklmnopqrstuvwxyz";

function checksum(body) {
  let sum = 0;
  for (const ch of body) sum += B36.indexOf(ch);
  return B36[sum % 36];
}

export function encodePartner(result) {
  const values = {
    t: T_AXIS.findIndex((x) => x.code === result.setup.t),
    r: R_AXIS.findIndex((x) => x.code === result.setup.r),
    k: K_AXIS.findIndex((x) => x.code === result.setup.k),
    D: result.raw.D,
    I: result.raw.I,
    S: result.raw.S,
    C: result.raw.C,
    ANX: result.raw.ANX,
    AVO: result.raw.AVO,
    SC: result.raw.SC,
    OC: result.raw.OC,
    ...result.comparable,
    flags: result.validity.count,
  };
  const body = PAYLOAD_FIELDS.map((f) => {
    const v = values[f];
    if (!Number.isInteger(v) || v < 0 || v >= 36) throw new Error(`코드에 담을 수 없는 값: ${f}=${v}`);
    return B36[v];
  }).join("");
  return VERSION + body + checksum(body);
}

// 잘못된 코드는 조용히 홈으로 보내는 대신 null을 돌려주고, 화면이 "링크가 잘못됐다"고
// 말하게 한다. 카카오톡에서 링크 끝이 잘려 붙는 경우가 실제로 있다.
export function decodePartner(code) {
  if (typeof code !== "string") return null;
  const trimmed = code.trim().toLowerCase();
  if (trimmed.length !== PAYLOAD_FIELDS.length + 2) return null;
  if (trimmed[0] !== VERSION) return null;
  const body = trimmed.slice(1, -1);
  if (checksum(body) !== trimmed[trimmed.length - 1]) return null;

  const values = {};
  for (let i = 0; i < PAYLOAD_FIELDS.length; i++) {
    const v = B36.indexOf(body[i]);
    if (v < 0) return null;
    values[PAYLOAD_FIELDS[i]] = v;
  }

  const setup = {
    t: (T_AXIS[values.t] || {}).code,
    r: (R_AXIS[values.r] || {}).code,
    k: (K_AXIS[values.k] || {}).code,
  };
  if (!setup.t || !setup.r || !setup.k) return null;

  const raw = {
    D: values.D, I: values.I, S: values.S, C: values.C,
    ANX: values.ANX, AVO: values.AVO, SC: values.SC, OC: values.OC,
  };
  for (const [factor, codes] of Object.entries(FACTOR_ITEMS)) {
    const n = codes.length;
    if (raw[factor] < n || raw[factor] > n * 5) return null;
  }
  const comparable = {
    AN1: values.AN1, AN2: values.AN2, AN3: values.AN3,
    R5: values.R5, R6: values.R6, K2: values.K2, K4: values.K4,
  };
  if (Object.values(comparable).some((v) => v < 1 || v > 5)) return null;

  const norm = {};
  for (const [factor, codes] of Object.entries(FACTOR_ITEMS)) {
    norm[factor] = normalize(raw[factor], codes.length);
  }
  const behavior = resolveBehavior(norm);
  const attachment = resolveAttachment(raw.ANX, raw.AVO);
  const conflict = resolveConflict(norm.SC, norm.OC);

  return {
    setup,
    raw,
    norm,
    behavior,
    attachment,
    conflict,
    typeKey: `${behavior.primary}-${attachment.key}`,
    comparable,
    validity: { count: values.flags, flags: [], verdict: values.flags >= 2 ? "blocked" : values.flags === 1 ? "warn" : "ok" },
  };
}
