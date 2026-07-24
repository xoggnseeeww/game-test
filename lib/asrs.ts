/**
 * WHO Adult ADHD Self-Report Scale (ASRS v1.1), Part A — 6 item screener.
 * English source cross-checked against Harvard NCS / CADDRA / ADD.org reproductions.
 * Continuous (0–24) scoring variant: sum of raw 0–4 responses, banded into
 * four strata (0-9 / 10-13 / 14-17 / 18-24). This is a validated alternative
 * to the original dichotomous "shaded box" scoring — chosen here because it
 * avoids binary positive/negative language and carries more information.
 */

export type AsrsAnswerValue = 0 | 1 | 2 | 3 | 4;

export interface AsrsItem {
  id: string;
  text: string;
}

export const ASRS_RESPONSE_OPTIONS: { value: AsrsAnswerValue; label: string }[] = [
  { value: 0, label: "전혀 없다" },
  { value: 1, label: "거의 없다" },
  { value: 2, label: "가끔 있다" },
  { value: 3, label: "자주 있다" },
  { value: 4, label: "매우 자주 있다" },
];

export const ASRS_PART_A_ITEMS: AsrsItem[] = [
  {
    id: "a1",
    text: "어떤 일의 어려운 부분을 다 끝내놓고, 마무리 짓는 데 어려움을 겪는 경우가 얼마나 자주 있나요?",
  },
  {
    id: "a2",
    text: "체계적으로 정리해야 하는 일을 할 때, 순서를 정리하는 데 어려움을 겪는 경우가 얼마나 자주 있나요?",
  },
  {
    id: "a3",
    text: "약속이나 해야 할 일을 깜빡 잊어버리는 경우가 얼마나 자주 있나요?",
  },
  {
    id: "a4",
    text: "많은 생각이 필요한 일을 시작하는 것을 피하거나 미루는 경우가 얼마나 자주 있나요?",
  },
  {
    id: "a5",
    text: "오래 앉아 있어야 할 때, 손이나 발을 꼼지락거리거나 가만히 있지 못하는 경우가 얼마나 자주 있나요?",
  },
  {
    id: "a6",
    text: "마치 모터가 달린 것처럼 지나치게 활동적이고 뭔가를 계속 해야만 할 것 같은 경우가 얼마나 자주 있나요?",
  },
];

export type AsrsBand = "low" | "midLow" | "midHigh" | "high";

export interface AsrsResult {
  total: number;
  band: AsrsBand;
}

/**
 * answers must be in the same order as ASRS_PART_A_ITEMS, one 0–4 value per item.
 */
export function scoreAsrs(answers: AsrsAnswerValue[]): AsrsResult {
  if (answers.length !== ASRS_PART_A_ITEMS.length) {
    throw new Error(
      `scoreAsrs expects ${ASRS_PART_A_ITEMS.length} answers, got ${answers.length}`
    );
  }
  const total = answers.reduce<number>((sum, v) => sum + v, 0);
  const band = bandForTotal(total);
  return { total, band };
}

export function bandForTotal(total: number): AsrsBand {
  if (total <= 9) return "low";
  if (total <= 13) return "midLow";
  if (total <= 17) return "midHigh";
  return "high";
}
