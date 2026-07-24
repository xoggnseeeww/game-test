/**
 * Self-authored supplementary items (not a licensed scale) that restate two
 * DSM-5 diagnostic requirements ASRS Part A does not cover: childhood onset
 * and cross-setting functional impairment. Never scored numerically — used
 * only to adjust the nuance of result copy.
 */

export type ChildhoodOnsetAnswer = "yes" | "unsure" | "no";
export type ImpairmentAreasAnswer = "one" | "twoOrMore" | "almostAll";

export const CHILDHOOD_ONSET_QUESTION = {
  id: "childhoodOnset",
  text: "초등학생 무렵에도 비슷한 어려움(집중이 안 되거나 산만하거나 충동적인 것)이 있었나요?",
  options: [
    { value: "yes" as const, label: "네, 그때도 비슷했어요" },
    { value: "unsure" as const, label: "잘 모르겠어요" },
    { value: "no" as const, label: "아니요, 최근에 생긴 것 같아요" },
  ],
};

export const IMPAIRMENT_AREAS_QUESTION = {
  id: "impairmentAreas",
  text: "이런 어려움이 지금 몇 군데 영역에서 나타나나요? (예: 직장·학업, 대인관계, 집안일 등)",
  options: [
    { value: "one" as const, label: "1군데 정도예요" },
    { value: "twoOrMore" as const, label: "2군데 이상이에요" },
    { value: "almostAll" as const, label: "거의 모든 영역에서요" },
  ],
};

export interface ChildhoodImpairmentAnswers {
  childhoodOnset: ChildhoodOnsetAnswer;
  impairmentAreas: ImpairmentAreasAnswer;
}

/**
 * Loosely mirrors DSM-5's childhood-onset + multi-setting requirement.
 * Not a diagnostic calculation — only used to decide whether to show the
 * "여러 조건이 함께 나타난다" nudge in the result copy.
 */
export function suggestsBroaderPattern(answers: ChildhoodImpairmentAnswers): boolean {
  return (
    answers.childhoodOnset === "yes" &&
    (answers.impairmentAreas === "twoOrMore" || answers.impairmentAreas === "almostAll")
  );
}
