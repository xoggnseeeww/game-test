// 학습 카테고리의 도구 1개: 기초 영어회화. 심리테스트/게임과 같은 레지스트리 방식으로
// 학습 목록(/learning)에 카드로 노출된다 — 학습 카테고리 안에 다른 공부 도구가 늘어날
// 자리다. 도구 내부는 챕터(목차) 하나하나가 문장 연습 화면이라, CHAPTERS 배열에서
// 화면을 자동 생성한다(챕터 추가 시 이 파일을 고칠 필요 없음).
import { CHAPTERS } from "./data.js";
import { renderBasicConversationIntro, renderChapter } from "./screens.js";

export const basicConversation = {
  id: "basic-conversation",
  card: {
    screen: "learning-basic-conversation",
    emoji: "🗣️",
    color: "#FF9F45",
    name: "기초 영어회화 (7세 이하)",
    desc: `일상대화로 배우는 첫 영어 · 목차 ${CHAPTERS.length}개`,
  },
};

export const basicConversationScreens = [
  {
    id: "learning-basic-conversation",
    path: "/learning/basic-conversation",
    title: "기초 영어회화 | 과몰입구역",
    render: renderBasicConversationIntro,
    theme: "learning",
  },
  ...CHAPTERS.map((ch) => ({
    id: `learning-basic-conversation-${ch.id}`,
    path: `/learning/basic-conversation/${ch.id}`,
    title: `${ch.title} | 과몰입구역`,
    render: () => renderChapter(ch),
    theme: "learning",
  })),
];
