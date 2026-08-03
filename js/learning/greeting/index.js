// 학습 카테고리 어린이 모드 파일럿 디스크립터. 심리테스트/게임과 같은 레지스트리 방식.
import { renderLearningGreeting } from "./screens.js";
import { SENTENCES } from "./data.js";

export const learningGreeting = {
  id: "greeting",
  card: {
    screen: "learning-greeting",
    emoji: "👋",
    color: "#FF9F45",
    name: "인사 · 기분 표현",
    desc: `듣고 따라 말하기 · 문장 ${SENTENCES.length}개`,
  },
};

export const learningGreetingScreens = [
  {
    id: "learning-greeting",
    path: "/learning/greeting",
    title: "인사 · 기분 표현 | 과몰입구역",
    render: renderLearningGreeting,
    theme: "learning",
  },
];
