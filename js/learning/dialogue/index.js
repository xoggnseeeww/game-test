// 학습 카테고리의 도구 3번째: 대화 연습(§3-7이 미뤄둔 다중 턴 대화). 장면(SCENES) 하나가
// 화면 하나로 자동 등록된다 — 장면이 늘어나도 이 파일은 고칠 필요 없다.
// 학년·단계 같은 중간 층이 없어서 elementary-conversation보다 한 단 얕다(data.js 헤더 참고 —
// 대화는 상황 자체가 난이도라 기본/중급/심화로 쪼개지 않았다).
import { SCENES } from "./data.js";
import { renderDialogueScenes, renderDialogueScene } from "./screens.js";

export const dialogue = {
  id: "dialogue",
  card: {
    screen: "learning-dialogue",
    emoji: "💬",
    color: "#7C6BFF",
    name: "대화 연습",
    desc: `주고받는 대화를 역할극으로 · 장면 ${SCENES.length}개`,
  },
};

export const dialogueScreens = [
  {
    id: "learning-dialogue",
    path: "/learning/dialogue",
    title: "대화 연습 | 과몰입구역",
    render: renderDialogueScenes,
    theme: "learning",
  },
  ...SCENES.map((scene) => ({
    id: `learning-dialogue-${scene.id}`,
    path: `/learning/dialogue/${scene.id}`,
    title: `${scene.title} | 과몰입구역`,
    render: () => renderDialogueScene(scene),
    theme: "learning",
  })),
];
