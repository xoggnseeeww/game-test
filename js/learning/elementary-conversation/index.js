// 학습 카테고리의 도구 2번째: 초등 영어회화(D-75). basic-conversation과 같은 레지스트리
// 방식이지만 한 단이 더 있다 — 학년(GRADES) × 챕터(그 학년의 chapters) × 단계(LEVEL_LABELS)를
// 곱해 화면을 자동 생성한다. 학년·챕터가 늘어나도 이 파일은 고칠 필요 없다(D-75 data.js
// 헤더 참고 — 아직 안 만든 학년/챕터는 GRADES/CHAPTERS 배열에 아예 없다).
import { GRADES, LEVEL_LABELS } from "./data.js";
import {
  renderElementaryGrades,
  renderElementaryChapters,
  renderElementaryLevelSelect,
  renderElementaryChapter,
} from "./screens.js";

export const elementaryConversation = {
  id: "elementary-conversation",
  card: {
    screen: "learning-elementary",
    emoji: "🏫",
    color: "#4C9AFF",
    name: "초등 영어회화",
    desc: `학년별로 배우는 실전 회화 · 학년 ${GRADES.length}단계`,
  },
};

export const elementaryConversationScreens = [
  {
    id: "learning-elementary",
    path: "/learning/elementary",
    title: "초등 영어회화 | 과몰입구역",
    render: renderElementaryGrades,
    theme: "learning",
  },
  ...GRADES.map((grade) => ({
    id: `learning-elementary-${grade.id}`,
    path: `/learning/elementary/${grade.id}`,
    title: `${grade.label} | 과몰입구역`,
    render: () => renderElementaryChapters(grade),
    theme: "learning",
  })),
  ...GRADES.flatMap((grade) =>
    grade.chapters.map((chapter) => ({
      id: `learning-elementary-${grade.id}-${chapter.id}`,
      path: `/learning/elementary/${grade.id}/${chapter.id}`,
      title: `${chapter.title} | 과몰입구역`,
      render: () => renderElementaryLevelSelect(grade, chapter),
      theme: "learning",
    }))
  ),
  ...GRADES.flatMap((grade) =>
    grade.chapters.flatMap((chapter) =>
      Object.keys(LEVEL_LABELS).map((level) => ({
        id: `learning-elementary-${grade.id}-${chapter.id}-${level}`,
        path: `/learning/elementary/${grade.id}/${chapter.id}/${level}`,
        title: `${chapter.title} · ${LEVEL_LABELS[level]} | 과몰입구역`,
        render: () => renderElementaryChapter(grade, chapter, level),
        theme: "learning",
      }))
    )
  ),
];
