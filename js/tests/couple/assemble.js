// 문항지 조립 (기획서 §3.2). 순수 함수라 브라우저 없이 node --test로 검증된다.
//
// 세 축(호칭·역할·자녀단계) 중 역할·자녀단계만 문장을 갈아끼운다. 조합이 무엇이든 문항
// 수는 항상 같다 — 체감 소요시간을 고정하기 위해서다. "같은 코드 = 같은 개념"이 유지되므로
// 서로 다른 조합을 고른 두 사람도 같은 개념에 답한 것으로 해석할 수 있다. 다만 개념이 같다고
// 수치 비교가 되는 것은 아니라서, 부부 간 비교는 양쪽에 **문장까지 같은** 문항으로만 한다(§3.3).
import { shuffle } from "../../core/util.js";
import {
  BEHAVIOR_ITEMS,
  ATTACH_ITEMS,
  CONFLICT_ITEMS,
  ANCHOR_ITEMS,
  ANCHOR_CONCEPTS,
  QC_ITEMS,
  ROLE_ITEMS,
  CHILD_ITEMS,
} from "./data.js";
import { REVERSE_CODES } from "./score.js";

// 앵커 6개를 놓는 자리(1-based). 35~49번 15칸 안에서, 아래 두 제약을 동시에 만족한다.
//
//  - 앵커끼리 붙지 않는다(사이에 일반 문항 최소 1개). 붙어 나오면 "여기가 배우자와 비교되는
//    구간이구나"를 알아차리고 그 구간에서만 방어적으로 답하게 된다.
//  - 같은 개념의 a·b는 4문항 이상 떨어진다. 앞 문항을 기억하고 똑같이 맞추는 응답을 억제한다.
//
// 앵커 사이 이격을 2가 아니라 1로 두는 이유(§3.2 v3.3 교정): 6개를 2칸 이격으로 놓으려면
// 6 + 5×2 = 16칸이 필요한데 구간은 15칸뿐이라 배치가 성립하지 않는다. 실질적으로 중요한
// 제약은 같은 개념 a·b의 4문항 이격 쪽이고, 앵커-앵커는 1칸만 띄워도 "덩어리로 보이지 않게"
// 하려던 목적은 달성된다.
const ANCHOR_ZONE_START = 35;
// 구간 안에서의 상대 위치(0-based). 앞 두 칸(35·36번)은 비워둔다 — 35번이 재고지 자리이고,
// 재고지 **바로 다음**이 앵커여도 "이 문항이 민감하다"는 신호가 되므로 한 칸 더 띄운다.
// 같은 개념 짝은 슬롯 (0,2)·(1,4)·(3,5)에 놓이므로 실제 간격은 4·6·5문항이 된다.
const ANCHOR_OFFSETS = [2, 4, 6, 8, 10, 13];

// 비공개 재고지를 띄우는 자리(1-based). **앵커 문항이 아닌 자리**여야 한다 — 특정 문항
// 바로 앞에 안내를 붙이면 그 문항이 민감하다는 신호가 되어, 그 구간에서만 방어적으로
// 답하게 만든다(§6.5.2 v3.2). 구간 첫 칸을 비워둔 것이 이 자리다.
export const NOTICE_POSITION = ANCHOR_ZONE_START;

// 같은 요인 문항이 연달아 나오면 앞 문항의 답이 다음 답을 끌어당긴다. 역채점 문항끼리
// 붙어도 마찬가지로 "이번엔 반대로 답해야 한다"는 감각이 이어져, 역채점이 잡으려던
// 묵종 편향을 오히려 못 잡는다. 두 규칙을 한 번의 선택 루프에서 같이 본다 — 이격을
// 맞춘 뒤에 역채점만 따로 스왑하면 그 스왑이 방금 맞춘 이격을 다시 깨뜨린다.
//
// 후보 중에서는 **남은 문항이 가장 많은 요인**을 먼저 놓는다. 앞에서부터 아무거나
// 고르면 문항 수가 많은 요인(ROLE 6문항)이 뒤로 몰려서, 끝에 가면 같은 요인만 남고
// 규칙이 통째로 깨진다. 그래도 후보가 없으면 규칙을 포기한다 — 조립 실패보다 낫다.
function orderItems(items, minGap) {
  const out = [];
  const pool = items.slice();
  const remaining = {};
  for (const item of pool) remaining[item.factor] = (remaining[item.factor] || 0) + 1;

  while (pool.length) {
    const recent = out.slice(-minGap).map((i) => i.factor);
    const lastWasReverse = out.length > 0 && REVERSE_CODES.has(out[out.length - 1].code);

    let best = -1;
    let bestRank = null;
    for (let i = 0; i < pool.length; i++) {
      if (recent.includes(pool[i].factor)) continue;
      // 정렬 기준: (1) 역채점 연속을 피하고 (2) 남은 문항이 많은 요인 먼저
      const rank = [lastWasReverse && REVERSE_CODES.has(pool[i].code) ? 1 : 0, -remaining[pool[i].factor]];
      if (best === -1 || rank[0] < bestRank[0] || (rank[0] === bestRank[0] && rank[1] < bestRank[1])) {
        best = i;
        bestRank = rank;
      }
    }
    if (best === -1) best = 0;

    const [picked] = pool.splice(best, 1);
    remaining[picked.factor] -= 1;
    out.push(picked);
  }
  return out;
}

function isReverse(item) {
  return Boolean(item) && REVERSE_CODES.has(item.code);
}

// idx 자리에 factor 요인의 문항을 놓아도 앞뒤 이격이 지켜지는가.
function spacingOkAt(items, idx, factor, minGap) {
  for (let d = 1; d <= minGap; d++) {
    const before = items[idx - d];
    const after = items[idx + d];
    if (before && before.factor === factor) return false;
    if (after && after.factor === factor) return false;
  }
  return true;
}

// orderItems는 역채점 연속을 피하려 하지만, 이격 조건을 만족하는 후보가 전부 역채점이면
// 어쩔 수 없이 붙여 놓는다. 남은 붙은 쌍을 뒤쪽의 정방향 문항과 맞바꿔 떼어놓되, 그
// 교환이 요인 이격을 깨뜨리면 건너뛴다 — 한쪽 규칙을 지키려고 다른 쪽을 깨면 남는 게 없다.
function repairReverseRuns(items, minGap) {
  const out = items.slice();
  for (let i = 1; i < out.length; i++) {
    if (!isReverse(out[i]) || !isReverse(out[i - 1])) continue;
    for (let j = 0; j < out.length; j++) {
      if (Math.abs(j - i) <= minGap) continue;
      if (isReverse(out[j]) || isReverse(out[j - 1]) || isReverse(out[j + 1])) continue;
      const trial = out.slice();
      trial[i] = out[j];
      trial[j] = out[i];
      if (!spacingOkAt(trial, i, trial[i].factor, minGap)) continue;
      if (!spacingOkAt(trial, j, trial[j].factor, minGap)) continue;
      out[i] = trial[i];
      out[j] = trial[j];
      break;
    }
  }
  return out;
}

// 앵커 6개를 후반부 구간에 **흩어서** 놓는다.
//
// v3.1까지는 검사 맨 끝에 연속 배치했는데, 기여 인정·부담·공정성을 묻는 문항이 한 덩어리로
// 붙어 나오면 "여기가 배우자와 비교되는 구간이구나"를 쉽게 알아차리고 그 구간에서만
// 방어적으로 답하게 된다. 앵커의 존재 이유가 정직한 비교인데 배치가 그걸 방해하는 셈이다.
//
// 슬롯 순서는 [c1a, c2a, c1b, c3a, c2b, c3b] — 같은 개념의 짝 사이에 다른 개념의 앵커가
// 끼어들어, 4문항 이상 이격이 자연스럽게 만들어진다. 어느 개념이 c1/c2/c3 자리를 맡을지와
// a·b 중 어느 쪽이 먼저 나올지는 세션마다 섞는다.
function scatterAnchors(base, anchors, shuffleFn) {
  const order = shuffleFn(ANCHOR_CONCEPTS.map((c) => c.key));
  const byConcept = {};
  for (const key of order) {
    byConcept[key] = shuffleFn(anchors.filter((a) => a.concept === key));
  }
  const [c1, c2, c3] = order;
  const sequence = [
    byConcept[c1][0],
    byConcept[c2][0],
    byConcept[c1][1],
    byConcept[c3][0],
    byConcept[c2][1],
    byConcept[c3][1],
  ];

  const out = base.slice();
  // 앞에서부터 끼워 넣는다. 목표 자리는 **완성본 기준**이고, i번째를 넣을 시점에는 그보다
  // 앞에 놓일 앵커 i개가 이미 들어가 있으므로 그 자리에 그대로 splice하면 맞는다.
  // (뒤에서부터 넣으면 아직 짧은 배열의 범위를 넘어 전부 끝에 붙는다.)
  for (let i = 0; i < sequence.length; i++) {
    out.splice(ANCHOR_ZONE_START - 1 + ANCHOR_OFFSETS[i], 0, sequence[i]);
  }
  return out;
}

function variantOf(item, axisCode) {
  const text = item.variants[axisCode];
  if (!text) throw new Error(`${item.code}에 ${axisCode} 버전 문장이 없다`);
  return { code: item.code, factor: item.factor, concept: item.concept, text };
}

/**
 * 문항지 배열을 만든다. 각 원소는 { code, factor, concept?, text }.
 * @param {{r:string, k:string}} setup 축2(역할)·축3(자녀단계) 선택값
 * @param {{shuffleFn?:Function}} opts 테스트에서 순서를 고정하려고 주입한다
 */
export function assembleQuestionnaire(setup, { shuffleFn = shuffle } = {}) {
  const scored = [
    ...BEHAVIOR_ITEMS,
    ...ATTACH_ITEMS,
    ...CONFLICT_ITEMS,
    ...ROLE_ITEMS.map((i) => variantOf(i, setup.r)),
    ...CHILD_ITEMS.map((i) => variantOf(i, setup.k)),
  ].map(({ code, factor, concept, text }) => ({ code, factor, concept, text }));

  const ordered = repairReverseRuns(orderItems(shuffleFn(scored), 2), 2);

  // 품질검사 문항은 중반부에 고정 삽입한다(§3.2). 셔플에 맡기면 맨 앞이나 맨 뒤로
  // 밀려서, 정작 집중력이 흐트러지는 구간을 못 본다.
  const withQc = ordered.slice();
  withQc.splice(Math.round(ordered.length * 0.66), 0, QC_ITEMS[1]);
  withQc.splice(Math.round(ordered.length * 0.33), 0, QC_ITEMS[0]);

  return scatterAnchors(withQc, ANCHOR_ITEMS, shuffleFn);
}
