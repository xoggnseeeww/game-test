// 학습 카테고리 어린이 모드 파일럿 디스크립터. 홈의 "학습" 카드가 목록 화면 없이
// 곧장 여기로 온다 — 학습은 심리테스트/미니게임처럼 독립 항목을 고르는 카탈로그가
// 아니라 하나의 공부 도구라, 카탈로그용 card 메타데이터가 없다(D-62).
import { renderLearningGreeting } from "./screens.js";

export const learningGreetingScreens = [
  {
    id: "learning-greeting",
    path: "/learning",
    title: "학습 | 과몰입구역",
    render: renderLearningGreeting,
    theme: "learning",
  },
];
