// 학습 카테고리의 도구 2번째: 초등 영어회화(D-78). basic-conversation과 같은 레지스트리
// 방식이지만 한 단이 더 있다 — 학년(GRADES) × 챕터(그 학년의 chapters) × 단계(LEVEL_LABELS)를
// 곱해 화면을 자동 생성한다. 학년·챕터가 늘어나도 이 파일은 고칠 필요 없다(D-78 data.js
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
  // 복습(SRS) 대상 해석기(D-92) — state.learning의 key/문장 id를 실제 문장으로 되돌린다.
  // 이걸 도구 쪽에 두는 이유: 복습 화면이 각 도구를 import하면 "홈·마이페이지는 학습 도구를
  // import하지 않는다"(D-70)는 경계가 무너진다. 레지스트리에 등록된 도구가 스스로 답하게 한다.
  // 모르는 key면 null — 다른 도구 것이거나, 콘텐츠에서 사라진 옛 문장이다.
  resolveReview(key, id) {
    const m = /^elementary-(.+?)-(.+)-(basic|intermediate|advanced)$/.exec(key);
    if (!m) return null;
    const grade = GRADES.find((g) => g.id === m[1]);
    const chapter = grade && grade.chapters.find((c) => c.id === m[2]);
    const sentence = chapter && chapter.sentences.find((s) => s.id === id);
    if (!sentence) return null;
    return { text: sentence.text, ko: sentence.ko, where: `${grade.label} · ${chapter.title}`, type: sentence.type || "repeat", sample: sentence.sample, hint: sentence.hint };
  },
};

export const elementaryConversationScreens = [
  {
    id: "learning-elementary",
    path: "/learning/elementary",
    title: "초등 영어회화 | 과몰입구역",
    render: renderElementaryGrades,
    theme: "learning",
    // 학년이 하나뿐일 땐 고를 게 없는 화면이라 클릭만 하나 더 느는 마찰이다 — 학년이
    // 늘어나면(길이 !== 1) 이 guard가 저절로 꺼져서 다시 학년 선택 화면이 뜬다.
    guard: () => (GRADES.length === 1 ? `learning-elementary-${GRADES[0].id}` : null),
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
