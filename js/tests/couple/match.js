// 부부 매칭 연산 (기획서 §7)과 배우자 결과를 링크로 실어 나르는 코덱.
// score.js와 마찬가지로 순수 함수만 둔다.
//
// ⚠ 이 사이트에는 백엔드가 없다. 기획서 §9.2의 페어링(서버 발급·7일 만료·세션 격리) 대신,
// 결합 계산에 필요한 값만 담은 짧은 코드를 주소에 실어 배우자에게 보낸다. 담기는 항목은
// 아래 PAYLOAD_FIELDS가 전부다. 앵커는 **개별 문항 응답값이 아니라 개념 점수(2문항 합)**로만
// 넘어가므로 원 문항값을 되돌릴 수 없다(합이 6이면 1+5인지 3+3인지 구분되지 않는다).
// 다만 R5·R6·K1~K5는 §7.4가 문항 단위 비교를 요구해 값 그대로 실린다. 화면에서는 배우자의
// 문항별 응답을 어디에도 표시하지 않지만, 코드 자체는 암호화된 것이 아니라서 §6.5.1의
// "영구 비공개"를 기술적으로 보장하지는 못한다. 사전 고지 문구도 이 사실에 맞춰 적었다.
import {
  COUPLE_TYPES,
  T_AXIS,
  R_AXIS,
  K_AXIS,
  ANCHOR_CONCEPTS,
  CONFLICT_STYLES,
  BEHAVIOR_LABELS,
} from "./data.js";
import {
  FACTOR_ITEMS,
  BEHAVIOR_AXES,
  normalize,
  seedFromRaw,
  resolveBehavior,
  resolveAttachment,
  resolveConflict,
} from "./score.js";

// ---------------------------------------------------------------- §7.2 성향 조합 해석

// 단일 "궁합 점수"를 만들지 않는다. "궁합 87점" 같은 값은 근거가 빈약한데도 확정적으로
// 들려서, 오분류 위험이 있는 정밀함의 대표 사례다. 대신 요인별로 세 구간만 나누고 어떤
// 조합도 "나쁜 궁합"으로 단정하지 않는다 — 모든 조합에 강점과 유의점이 함께 붙는다.
//
// 구간을 원점수 차로 정의하는 이유: 정규화 점수차는 6.25점 단위의 이산값이라 연속 구간으로
// 쓰면 경계값(예: 정확히 25)이 두 구간에 동시에 걸린다.
//
// 아래 두 표의 필드는 전부 level* 접두사를 쓴다. 이 객체들은 개념/축 객체 위에 펼쳐지는데,
// 같은 이름(label·desc)을 쓰면 개념명이 구간명으로 조용히 덮인다.
const DYNAMIC_LEVELS = [
  {
    max: 1,
    levelKey: "similar",
    levelLabel: "닮은 편",
    levelDesc: "비슷해서 서로를 빨리 이해해요. 대신 같은 걸 함께 놓칠 수 있어요.",
  },
  {
    max: 3,
    levelKey: "complement",
    levelLabel: "보완하는 편",
    levelDesc: "서로의 약한 지점을 메워주는 조합이에요.",
  },
  {
    max: Infinity,
    levelKey: "contrast",
    levelLabel: "많이 다른 편",
    levelDesc: "방식이 많이 달라서 부딪히기 쉬운 지점이에요.",
  },
];

export function behaviorDynamics(rawA, rawB) {
  return BEHAVIOR_AXES.map((ax) => {
    const diff = Math.abs(rawA[ax] - rawB[ax]);
    const level = DYNAMIC_LEVELS.find((l) => diff <= l.max);
    return { axis: ax, label: BEHAVIOR_LABELS[ax], diff, ...level };
  });
}

// 애착 조합 10태그(§7.2). 순서가 없는 조합이라 정렬한 키로 찾는다.
// "정답 조합"을 알려주려는 표가 아니라, 자주 부딪히는 지점을 미리 짚어 대화 스타터로
// 연결하기 위한 해석 보조 장치다.
export const ATTACH_PAIR_TAGS = {
  "AT1|AT1": {
    tag: "안정 기반형",
    desc: "서로에게 기댈 자리가 되어주는 조합이에요. 둘 다 확인하지 않아도 편안해하는 쪽이라 관계가 잔잔하게 흘러가기 쉬워요. 다만 편안함에 익숙해져 서로에게 마음을 표현하는 것 자체를 잊기 쉬우니, 가끔은 의식적으로 애정을 꺼내 보여주세요.",
  },
  "AT1|AT2": {
    tag: "균형 잡는형",
    desc: "한 분의 꾸준함이 다른 한 분의 불안을 가라앉혀 줘요. 확인받고 싶어하는 마음과 흔들리지 않는 마음이 짝을 이루면 관계가 안정적으로 자리잡기 쉬워요. 다만 그 꾸준함을 당연하게 여기면, 확인이 필요한 쪽은 계속 혼자 마음을 졸이게 됩니다.",
  },
  "AT1|AT3": {
    tag: "거리 조율형",
    desc: "먼저 다가가되 속도는 상대에 맞춰주세요. 한 분은 가까움에 크게 구애받지 않고, 다른 한 분은 자기만의 공간이 필요한 편이라 서로의 리듬이 다를 수 있어요. 거리를 두는 쪽의 속도를 존중해주면 관계가 오히려 더 편안해집니다.",
  },
  "AT1|AT4": {
    tag: "신뢰 축적형",
    desc: "꾸준함이 신뢰를 천천히 쌓아가는 조합이에요. 한 분의 흔들리지 않는 태도가, 다가가고 싶으면서도 신중해지는 다른 한 분의 마음을 서서히 안심시켜 줍니다. 신뢰가 자리잡기까지 시간이 걸리는 조합이니 조급해하지 않아도 괜찮아요.",
  },
  "AT2|AT2": {
    tag: "감정 증폭형",
    desc: "확인하고 싶은 마음이 서로 맞물려 커질 수 있어요. 둘 다 반응에 민감한 편이라, 한쪽이 조용해지면 다른 쪽도 덩달아 불안해지기 쉬워요. 그럴 땐 침묵을 나쁜 신호로 해석하기 전에, 지금 괜찮은지 먼저 물어봐 주세요.",
  },
  "AT2|AT3": {
    tag: "다가감-물러남형",
    desc: "한 분이 다가갈수록 다른 한 분이 물러나기 쉬워요. 가까움을 확인하고 싶은 마음과 거리를 두고 싶은 마음이 마주치면 서로 다른 신호로 오해하기 쉬운 조합이에요. 물러나는 것이 마음이 식어서가 아니라는 걸 알고 있으면 서운함이 훨씬 줄어듭니다.",
  },
  "AT2|AT4": {
    tag: "엇갈림형",
    desc: "둘 다 확인받고 싶은데 표현이 달라 서로 놓치기 쉬워요. 확인받고 싶은 마음은 같은데 표현하는 방식과 다가가는 속도가 달라서, 서로의 신호를 알아차리지 못하고 지나치기 쉬운 조합이에요. 상대가 보내는 방식 그대로의 신호를 알아차리는 연습이 필요합니다.",
  },
  "AT3|AT3": {
    tag: "평행 독립형",
    desc: "각자의 공간은 편하지만 대화가 줄어들기 쉬워요. 둘 다 혼자만의 시간에서 편안함을 찾는 편이라 서로를 방해하지 않는 관계가 되기 쉬워요. 다만 그 편안함이 길어지면 정작 나눠야 할 이야기까지 미뤄질 수 있으니, 대화 시간을 따로 정해두는 것도 방법이에요.",
  },
  "AT3|AT4": {
    tag: "이중 거리형",
    desc: "둘 다 거리를 두는 편이라 불편함이 속으로 쌓이기 쉬워요. 먼저 다가가는 쪽 없이 둘 다 한 발 물러나 있는 편이라, 작은 서운함도 표현되지 않은 채 오래 묵혀지기 쉬운 조합이에요. 누구든 먼저 작은 것부터 꺼내보는 쪽이 관계를 움직이게 만듭니다.",
  },
  "AT4|AT4": {
    tag: "서로 재는형",
    desc: "둘 다 신중한 편이에요. 작은 시도부터 서로 격려해보세요. 다가가고 싶은 마음과 신중해지는 마음을 함께 갖고 있어서, 먼저 움직이기를 서로 기다리다 시간이 흘러가기 쉬운 조합이에요. 큰 결심이 아니라 작은 시도부터 시작하면 부담이 훨씬 줄어듭니다.",
  },
};

export function attachPairTag(keyA, keyB) {
  return ATTACH_PAIR_TAGS[[keyA, keyB].sort().join("|")];
}

export function conflictPairText(a, b) {
  return `${CONFLICT_STYLES[a.conflict.style].name} × ${CONFLICT_STYLES[b.conflict.style].name}`;
}

// ---------------------------------------------------------------- §7.3 Gap Score (앵커 전용)

// 개념 점수 차(0~4.0, 0.5 단위)로 판정한다. 연속 구간 대신 이산 표를 쓰는 이유는
// 경계값이 두 구간에 동시에 걸리는 것을 막기 위해서다.
// 1점 차이까지 "격차"로 통보하면 격차 항목이 남발돼 정작 중요한 항목이 묻힌다.
const GAP_LEVELS = [
  { max: 1.0, levelKey: "low", levelLabel: "비슷함", levelText: "두 분이 비슷하게 느끼고 있어요." },
  { max: 2.0, levelKey: "mid", levelLabel: "조금 다름", levelText: "느끼는 정도가 조금 달라요." },
  {
    max: Infinity,
    levelKey: "high",
    levelLabel: "뚜렷하게 다름",
    levelText: "느끼는 정도가 꽤 달라요. 이야기 나눠볼 만한 지점입니다.",
  },
];

/**
 * 앵커 개념별 격차. 어느 한쪽이라도 개념 내부 일관성이 깨졌으면 `shown: false`로 표시해
 * 리포트에서 격차 항목으로 노출하지 않는다 — 본인 응답 자체가 흔들리는 개념을 부부 간
 * 격차로 제시하면 근거 없는 갈등을 만든다(§7.3).
 *
 * 노출되는 것은 **격차의 크기와 개념명뿐**이다. 누가 더 낮게 답했는지(방향)는 §6.5.1의
 * 개별 응답 비공개 원칙에 따라 끝까지 내보내지 않는다.
 */
export function gapScore(anchorsA, anchorsB) {
  const items = ANCHOR_CONCEPTS.map(({ key, label, desc }) => {
    const diff = Math.abs(anchorsA[key].score - anchorsB[key].score);
    const level = GAP_LEVELS.find((l) => diff <= l.max);
    return {
      key,
      label,
      desc,
      diff,
      shown: anchorsA[key].consistent && anchorsB[key].consistent,
      // 두 사람 다 높게 답한 개념은 격차가 없어도 따로 짚을 값이 있다(§7.3 절대 수준 활용).
      bothScore: (anchorsA[key].score + anchorsB[key].score) / 2,
      ...level,
    };
  });
  // 내부 정렬 전용. 사용자에게 "격차 점수 OO점"으로 노출하면 §7.2가 배제한 단일 스코어를
  // 뒷문으로 들이는 셈이 된다.
  const composite = items.reduce((acc, i) => acc + i.diff, 0) / items.length;
  return { items, composite };
}

// ---------------------------------------------------------------- §7.4 환경축 비교

export const ENV_ITEMS = [
  { code: "R5", label: "역할 분담의 자발성", desc: "지금의 역할 분담이 함께 상의한 결과라고 느끼는 정도" },
  { code: "R6", label: "역할 전환 여지", desc: "상황이 바뀌면 역할을 조정할 수 있다고 느끼는 정도" },
  { code: "K1", label: "자녀 관련 대화", desc: "자녀 이야기를 서로 편하게 꺼낼 수 있다고 느끼는 정도" },
  { code: "K2", label: "부부 단둘 시간", desc: "둘만의 시간이 확보되고 있다고 느끼는 정도" },
  { code: "K3", label: "자녀 관련 의사결정", desc: "자녀 관련 결정을 함께 상의하고 있다고 느끼는 정도" },
  { code: "K4", label: "자녀로 인한 부담", desc: "자녀 관련 스트레스가 관계에 영향을 준다고 느끼는 정도" },
  { code: "K5", label: "자녀 관련 가치관", desc: "자녀에 대한 생각이 서로 맞는다고 느끼는 정도" },
];

// 단일 문항이라 앵커(2문항 평균)보다 해상도가 낮다. 같은 구간 표를 쓰되, 정수 차이만
// 나오므로 실질적으로 0~1 비슷함 / 2 조금 다름 / 3~4 뚜렷하게 다름으로 갈린다.
export function envCompare(comparableA, comparableB) {
  return ENV_ITEMS.map(({ code, label, desc }) => {
    const diff = Math.abs(comparableA[code] - comparableB[code]);
    const level = GAP_LEVELS.find((l) => diff <= l.max);
    return { code, label, desc, diff, ...level };
  });
}

// ---------------------------------------------------------------- §7.4 역할 인식 불일치

// R축은 객관적 사실이 아니라 각자의 자기 인식이라, 두 사람이 같은 값을 고를 수 있다.
// 오류로 막지 않는다 — 둘 다 자신이 주된 몫을 지고 있다고 느끼는 상태는 그 자체로
// 의미 있는 신호이기 때문이다. (자녀 단계 K는 객관적 사실이라 §7.6에서 다르게 다룬다.)
export function roleOverlap(setupA, setupB) {
  if (setupA.r !== setupB.r) return null;
  if (setupA.r === "R-S") return null; // 둘 다 동등 분담 = 인식이 일치한 정상 상태
  const label = R_AXIS.find((x) => x.code === setupA.r).label;
  return {
    role: setupA.r,
    label,
    text:
      "두 분 다 스스로가 가정의 주된 몫을 맡고 있다고 느끼고 계세요. 이건 누가 착각한 게 아니라, 서로가 지고 있는 무게를 상대가 다 보지는 못하고 있다는 뜻일 수 있어요.",
  };
}

// ---------------------------------------------------------------- §7.3 분담 인식 일치 (D-51/D-53)

// AN3(분담 공정성)를 자기참조형("나는 더 많이 짊어진다고 느낀다")으로 바꾸면서 생긴 새
// 인사이트. roleOverlap()과 같은 방식이다 — 두 점수를 비교해서 "누가 더 짊어진다"고
// 말하지 않는다. 대신 **둘 다 같은 자기인식(나는 더 짊어진다)에 도달했다**는 일치만
// 짚는다. 이건 상대적 비교가 아니라 "당신도 그렇게 느끼고, 배우자도 그렇게 느낀다"는
// 대칭 정보라, 방향을 전혀 드러내지 않고도 실제로 흔한 인지 격차(둘 다 자기 몫이 더
// 크다고 느끼는 현상)를 보여줄 수 있다.
//
// 문구는 "불리하다"·"서로 다른 이유로 같은 결론" 같은 다소 대립적인 표현을 걷어내고,
// **각자 자기 몫은 잘 보이고 상대 몫은 잘 안 보인다는, 흔하고 자연스러운 인지 편향**으로
// 프레이밍했다(D-53). "누가 맞다/틀리다"가 아니라 "그럴 수 있다"는 톤을 유지해야 이
// 인사이트가 서로를 탓하는 근거가 아니라 대화를 여는 계기로 읽힌다.
//
// 한쪽만 높은 "엇갈림" 경우는 여기서 다루지 않는다 — 그 경우까지 뭔가 말하려 들면 "한쪽만
// 그렇게 느낀다"는 게 곧 방향 노출이 된다(n=2 설문에서는 내 답을 아는 사람이 이 말만 듣고도
// 상대 답을 역산한다). 그 경우는 기존 Gap Score(크기만 노출)에 그대로 맡긴다.
const BURDEN_HIGH = 3; // 개념 점수 중앙값(1~5 척도) — score.js axisState()의 관례와 동일
export function burdenOverlap(anchorsA, anchorsB) {
  const a = anchorsA.AN3;
  const b = anchorsB.AN3;
  // 내부 일관성이 깨진 응답은 짚지 않는다 — 흔들리는 응답을 인사이트의 근거로 쓰면
  // 근거 없는 이야기가 된다(§7.3 앵커 내부 일관성과 같은 기준).
  if (!a.consistent || !b.consistent) return null;
  if (a.score >= BURDEN_HIGH && b.score >= BURDEN_HIGH) {
    return {
      pattern: "both-carry-more",
      text: "두 분 다 지금 자신이 맡은 몫이 크다고 느끼고 있어요. 흔히 있는 일이에요 — 내가 하는 건 잘 보이고 상대가 하는 건 잘 안 보이기 때문이에요. 서로 어떤 부분이 힘든지 편하게 이야기해보면 좋을 것 같아요.",
    };
  }
  return null;
}

// ---------------------------------------------------------------- 결합 결과

/**
 * 두 사람의 결과를 합친다. 발급 조건은 coupleReportBlock()이 따로 본다(§7.6).
 */
export function combine(a, b) {
  const gap = gapScore(a.anchors, b.anchors);
  const env = envCompare(a.comparable, b.comparable);

  // 긍정 항목 우선 배치(§8.2): 격차가 작은 항목을 먼저 보여주고, 큰 항목은 그 뒤에
  // "대화해볼 지점"으로 전환해 배치한다. 부정적인 내용으로 리포트를 시작하지 않는다.
  const shownGaps = gap.items.filter((i) => i.shown);
  const byDiffAsc = (x, y) => x.diff - y.diff;

  return {
    dynamics: behaviorDynamics(a.raw, b.raw),
    attachTag: attachPairTag(a.attachment.key, b.attachment.key),
    gap,
    // 노출 순서까지 여기서 정해둔다 — 화면이 정렬을 다시 하면 §8.2 규칙이 두 군데로 흩어진다.
    gapOrdered: shownGaps.slice().sort(byDiffAsc),
    gapHidden: gap.items.filter((i) => !i.shown),
    // 환경축은 항목이 많아 전부 보여주면 정보 과부하가 된다. 격차가 있는 것만 위에서부터.
    envTop: env.filter((i) => i.levelKey !== "low").sort((x, y) => y.diff - x.diff),
    env,
    roleOverlap: roleOverlap(a.setup, b.setup),
    burdenOverlap: burdenOverlap(a.anchors, b.anchors),
    // 플래그가 1개인 쪽이 있으면 결과에 오차 가능 문구를 병기한다.
    lowConfidence: a.validity.count === 1 || b.validity.count === 1,
  };
}

// §7.6 결합 리포트 발급 조건. 막아야 하는 사유를 돌려주고, 없으면 null.
//
// 자녀 단계 불일치를 응답 품질보다 먼저 본다. 둘 다 걸린 경우 "다시 천천히 답해 주세요"를
// 먼저 안내하면, 문항을 다시 다 풀고 나서도 축이 여전히 어긋나 또 막힌다. 축 불일치는
// 재응답으로 풀리지 않는 문제라 그쪽을 먼저 알려주는 것이 사용자에게 실제로 도움이 된다.
export function coupleReportBlock(a, b) {
  // 자녀 단계는 객관적 사실이라 두 사람이 다를 수 없다. 다르면 K문항의 문장 자체가
  // 갈라져 비교 근거가 사라진다.
  if (a.setup.k !== b.setup.k) return "childStage";
  if (a.validity.verdict === "blocked" || b.validity.verdict === "blocked") return "validity";
  return null;
}

// §8.1 부부 페르소나. 두 사람이 같은 호칭을 골랐으면(동성 부부 등 — 오류가 아니다)
// 인칭을 중립 표기로 떨어뜨린다.
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

// ---------------------------------------------------------------- 배우자 코드 (백엔드 없음)

// 필드 순서가 곧 코드의 자리다. 순서를 바꾸거나 항목을 끼워넣으면 이미 공유된 링크가
// 조용히 다른 값으로 해석된다 — 늘리려면 VERSION을 올리고 분기해야 한다.
// v1(기획서 v3.0 기준)은 앵커 개별 응답값 3개를 실었다. v2는 앵커를 개념 점수 3개 +
// 내부 일관성 비트로 바꾸고 K1~K5를 추가했다.
const VERSION = "2";
const PAYLOAD_FIELDS = [
  "t", "r", "k",
  "D", "I", "S", "C",
  "ANX", "AVO",
  "SC", "OC",
  "AN1", "AN2", "AN3",
  "anchorFit",
  "R5", "R6",
  "K1", "K2", "K3", "K4", "K5",
  "flags",
];

const B36 = "0123456789abcdefghijklmnopqrstuvwxyz";

function checksum(body) {
  let sum = 0;
  for (const ch of body) sum += B36.indexOf(ch);
  return B36[sum % 36];
}

export function encodePartner(result) {
  // 개념 점수는 0.5 단위라 그대로는 base36 한 자리에 안 들어간다. 두 문항의 합(2~10)으로
  // 실어 보내고 받는 쪽에서 다시 반으로 나눈다 — 합만으로는 원 문항값을 되돌릴 수 없다.
  const anchorSum = {};
  let anchorFit = 0;
  ANCHOR_CONCEPTS.forEach(({ key }, i) => {
    anchorSum[key] = result.anchors[key].score * 2;
    if (result.anchors[key].consistent) anchorFit |= 1 << i;
  });

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
    ...anchorSum,
    anchorFit,
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

  const anchors = {};
  for (let i = 0; i < ANCHOR_CONCEPTS.length; i++) {
    const { key } = ANCHOR_CONCEPTS[i];
    const sum = values[key];
    if (sum < 2 || sum > 10) return null;
    anchors[key] = { score: sum / 2, consistent: Boolean(values.anchorFit & (1 << i)) };
  }

  const comparable = {};
  for (const code of ["R5", "R6", "K1", "K2", "K3", "K4", "K5"]) {
    if (values[code] < 1 || values[code] > 5) return null;
    comparable[code] = values[code];
  }

  const norm = {};
  for (const [factor, codes] of Object.entries(FACTOR_ITEMS)) {
    norm[factor] = normalize(raw[factor], codes.length);
  }
  // 시드를 원점수에서 뽑으므로, 배우자 기기에서 다시 채점해도 본인 기기와 같은 유형이 나온다.
  const behavior = resolveBehavior(norm, seedFromRaw(raw));
  const attachment = resolveAttachment(raw.ANX, raw.AVO);
  const conflict = resolveConflict(raw.SC, raw.OC);

  return {
    setup,
    raw,
    norm,
    behavior,
    attachment,
    conflict,
    typeKey: `${behavior.primary}-${attachment.key}`,
    anchors,
    comparable,
    validity: {
      count: values.flags,
      flags: [],
      verdict: values.flags >= 2 ? "blocked" : values.flags === 1 ? "warn" : "ok",
    },
  };
}
