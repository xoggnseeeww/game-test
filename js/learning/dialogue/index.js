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
  // 복습(SRS) 대상 해석기(D-92). 이 도구는 문장 id가 아니라 **턴 인덱스**를 weak 키로 쓴다
  // (대화의 한 턴에는 id가 없다) — 그래서 id를 숫자로 되돌려 그 턴을 찾는다.
  resolveReview(key, id) {
    const scene = SCENES.find((s) => `dialogue-${s.id}` === key);
    const turn = scene && scene.turns[Number(id)];
    if (!turn || turn.role !== "you") return null;
    // 내 차례는 영어 정답 문장이 없다(한국어 지시문 + 예시 답안뿐) — 복습 화면이 이걸
    // 알아야 채점 대신 자가평가로 보여준다.
    return { text: turn.ko, ko: turn.hint, where: `대화 연습 · ${scene.title}`, type: "produce", sample: turn.sample, hint: turn.hint };
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
