/**
 * All user-facing copy for the ADHD self-check lives here so wording review
 * happens in one place. See scripts/check-banned-words.ts — it scans this
 * file (excluding BANNED_WORDS/DISCLAIMER themselves) for the words below.
 */

export const BANNED_WORDS = [
  "진단",
  "위험군",
  "환자",
  "치료",
  "질환",
  "양성",
  "음성",
] as const;

// Deliberately reviewed exception: the disclaimer negates diagnosis/treatment,
// so it necessarily contains those words. Excluded from the automated scan
// below — any future edit to this exact string should get a manual re-review.
export const DISCLAIMER =
  "본 서비스는 의학적 진단이나 치료를 위한 의료기기가 아니며, 단순 자가 점검 및 정보 제공을 목적으로 합니다.";

export const FALSE_NEGATIVE_CAVEAT =
  "점수가 낮게 나왔더라도 실제로 어려움을 겪고 계실 수 있어요. 이 자가 체크 하나만으로 결과를 단정 짓지 마세요.";

export const SOURCE_ATTRIBUTION =
  "이 자가 체크는 WHO Adult ADHD Self-Report Scale(ASRS v1.1), Patient Health Questionnaire-2(PHQ-2), Generalized Anxiety Disorder-2(GAD-2) 문항을 참고해 구성했습니다. 국문 문항은 원문을 바탕으로 재구성한 번역이며 공식 번역본은 아닙니다.";

export const SITE_NAME = "과몰입구역";
export const TEST_TITLE = "성인 ADHD 자가 체크";
export const TEST_TAGLINE = "요즘 유독 집중이 안 되고 깜빡깜빡한다면?";

export const INTRO_SECTIONS = [
  {
    heading: "이 자가 체크는 무엇인가요?",
    body: "세계보건기구(WHO)가 만든 성인 ADHD 선별 문항(ASRS v1.1)을 바탕으로, 우울·불안 등 비슷하게 보일 수 있는 다른 이유도 함께 살펴보도록 구성한 자가 체크예요. 총 12개 문항, 2분이면 끝나요.",
  },
  {
    heading: "어떻게 채점되나요?",
    body: "핵심 6문항(ASRS Part A) 점수를 0~24점으로 합산해 네 단계 구간으로 보여드려요. 우울·불안 관련 2문항씩(PHQ-2, GAD-2)은 ADHD 점수와 절대 합산하지 않고, 기준 이상일 때만 별도로 안내해요.",
  },
  {
    heading: "결과를 어떻게 봐야 하나요?",
    body: "이 결과는 병원에서 받는 공식적인 결과가 아니라, 스스로를 돌아보는 참고 자료예요. 점수가 낮게 나와도 실제 어려움을 놓쳤을 수 있고, 반대로 점수가 높다고 확정적인 것도 아니에요. 궁금하거나 걱정된다면 정신건강의학과 상담을 통해 정확히 확인해보시길 권해요.",
  },
];

export type AsrsBandCopy = {
  title: string;
  description: string;
};

export const ASRS_BAND_COPY: Record<"low" | "midLow" | "midHigh" | "high", AsrsBandCopy> = {
  low: {
    title: "주의력·충동성 관련 경향, 낮게 나타났어요",
    description: "이번 자가 체크에서는 두드러지는 패턴이 많지 않았어요.",
  },
  midLow: {
    title: "주의력·충동성 관련 경향, 약간 나타났어요",
    description: "가끔 비슷한 어려움을 느끼는 정도로 보여요.",
  },
  midHigh: {
    title: "주의력·충동성 관련 경향, 꽤 뚜렷하게 나타났어요",
    description: "일상에서 이런 어려움을 자주 느끼고 계실 수 있어요.",
  },
  high: {
    title: "주의력·충동성 관련 경향, 뚜렷하게 나타났어요",
    description: "이런 패턴이 일상에 꽤 영향을 주고 있을 수 있어요. 관련 상담을 고려해보시길 권해요.",
  },
};

export const PHQ2_NUDGE =
  "집중이 잘 안 되는 게 가라앉은 기분 때문일 수도 있어요. 최근 기분이 가라앉는 날이 많았다면 이 부분도 함께 살펴보세요.";

export const GAD2_NUDGE =
  "산만하거나 안절부절못하는 느낌이 불안 때문일 수도 있어요. 최근 긴장되거나 걱정이 많았다면 이 부분도 함께 살펴보세요.";

export const BROADER_PATTERN_NUDGE =
  "어릴 때부터 비슷한 모습이 있었고, 여러 영역에서 영향을 받고 있다고 답하셨어요. 이런 경우라면 정신건강의학과 상담을 통해 정확히 확인해보시는 걸 더 권해드려요.";

export const CHILDHOOD_IMPAIRMENT_SECTION_INTRO =
  "마지막으로 두 가지만 더 여쭤볼게요.";
