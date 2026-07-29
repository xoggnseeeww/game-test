// 문항지 조립 (기획서 §3.2). 순수 함수라 브라우저 없이 node --test로 검증된다.
//
// 세 축(호칭·역할·자녀단계) 중 역할·자녀단계만 문장을 갈아끼운다. 조합이 무엇이든 문항
// 수는 항상 같다 — 체감 소요시간을 고정하기 위해서다. "같은 코드 = 같은 개념"이 유지되므로
// 서로 다른 조합을 고른 두 사람도 요인 점수 기준으로는 같은 척도 위에 놓인다(§3.3).
import { shuffle } from "../../core/util.js";
import {
  BEHAVIOR_ITEMS,
  ATTACH_ITEMS,
  CONFLICT_ITEMS,
  ANCHOR_ITEMS,
  QC_ITEMS,
  ROLE_ITEMS,
  CHILD_ITEMS,
} from "./data.js";
import { REVERSE_CODES } from "./score.js";

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
// 어쩔 수 없이 붙여 놓는다(41문항 중 9문항이 역채점이라 가끔 실제로 일어난다).
// 남은 붙은 쌍을 뒤쪽의 정방향 문항과 맞바꿔 떼어놓되, 그 교환이 요인 이격을 깨뜨리면
// 건너뛴다 — 한쪽 규칙을 지키려고 다른 쪽을 깨면 남는 게 없다.
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

function variantOf(item, axisCode) {
  const text = item.variants[axisCode];
  if (!text) throw new Error(`${item.code}에 ${axisCode} 버전 문장이 없다`);
  return { code: item.code, factor: item.factor, concept: item.concept, text };
}

/**
 * 46문항 배열을 만든다. 각 원소는 { code, factor, text }.
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

  // 앵커 문항은 셔플 대상에서 빼고 맨 뒤에 연속 배치한다(§3.2 v3.0). 앞 문항들에 답하며
  // 자기 상황을 충분히 떠올린 상태에서 답해야 회상 정확도가 올라가고, 이 구간 직전에
  // 비공개 재고지를 한 번 더 띄울 수 있다(§6.5.2).
  return [...withQc, ...ANCHOR_ITEMS.map(({ code, factor, concept, text }) => ({ code, factor, concept, text }))];
}

// 앵커 구간이 시작되는 인덱스. 화면이 이 지점에서 비공개 재고지를 띄운다.
export function anchorStartIndex(items) {
  return items.findIndex((i) => i.factor === "AN");
}
