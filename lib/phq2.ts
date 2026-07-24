/**
 * PHQ-2 (Patient Health Questionnaire-2) — ultra-brief depression screener.
 * Public domain, released by Pfizer in 2010 with no copyright restriction.
 * Used here only as a differential-diagnosis nudge, never combined with the
 * ASRS score.
 */

export type Phq2AnswerValue = 0 | 1 | 2 | 3;

export const PHQ2_RESPONSE_OPTIONS: { value: Phq2AnswerValue; label: string }[] = [
  { value: 0, label: "전혀 없음" },
  { value: 1, label: "며칠 동안" },
  { value: 2, label: "일주일의 절반 이상" },
  { value: 3, label: "거의 매일" },
];

export const PHQ2_INTRO = "지난 2주 동안, 다음과 같은 문제로 얼마나 자주 힘드셨나요?";

export const PHQ2_ITEMS: { id: string; text: string }[] = [
  { id: "p1", text: "어떤 일에도 흥미나 즐거움이 거의 없었다" },
  { id: "p2", text: "기분이 가라앉거나 우울하거나 희망이 없다고 느꼈다" },
];

export const PHQ2_CUTOFF = 3;

export interface Phq2Result {
  total: number;
  aboveCutoff: boolean;
}

export function scorePhq2(answers: Phq2AnswerValue[]): Phq2Result {
  if (answers.length !== PHQ2_ITEMS.length) {
    throw new Error(`scorePhq2 expects ${PHQ2_ITEMS.length} answers, got ${answers.length}`);
  }
  const total = answers.reduce<number>((sum, v) => sum + v, 0);
  return { total, aboveCutoff: total >= PHQ2_CUTOFF };
}
