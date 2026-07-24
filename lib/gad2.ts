/**
 * GAD-2 (Generalized Anxiety Disorder-2) — ultra-brief anxiety screener.
 * Public domain, released by Pfizer in 2010 with no copyright restriction.
 * Used here only as a differential-diagnosis nudge, never combined with the
 * ASRS score.
 */

export type Gad2AnswerValue = 0 | 1 | 2 | 3;

export const GAD2_RESPONSE_OPTIONS: { value: Gad2AnswerValue; label: string }[] = [
  { value: 0, label: "전혀 없음" },
  { value: 1, label: "며칠 동안" },
  { value: 2, label: "일주일의 절반 이상" },
  { value: 3, label: "거의 매일" },
];

export const GAD2_INTRO = "지난 2주 동안, 다음과 같은 문제로 얼마나 자주 힘드셨나요?";

export const GAD2_ITEMS: { id: string; text: string }[] = [
  { id: "g1", text: "신경이 예민하거나 불안하거나 초조했다" },
  { id: "g2", text: "걱정하는 것을 멈추거나 조절할 수 없었다" },
];

export const GAD2_CUTOFF = 3;

export interface Gad2Result {
  total: number;
  aboveCutoff: boolean;
}

export function scoreGad2(answers: Gad2AnswerValue[]): Gad2Result {
  if (answers.length !== GAD2_ITEMS.length) {
    throw new Error(`scoreGad2 expects ${GAD2_ITEMS.length} answers, got ${answers.length}`);
  }
  const total = answers.reduce<number>((sum, v) => sum + v, 0);
  return { total, aboveCutoff: total >= GAD2_CUTOFF };
}
