// 학습 카테고리의 도구 1개: 기초 영어회화. 심리테스트/게임과 같은 레지스트리 방식으로
// 학습 목록(/learning)에 카드로 노출된다 — 학습 카테고리 안에 다른 공부 도구가 늘어날
// 자리다. 도구 내부는 챕터(목차) 하나하나가 문장 연습 화면이라, CHAPTERS 배열에서
// 화면을 자동 생성한다(챕터 추가 시 이 파일을 고칠 필요 없음).
import { CHAPTERS, LEVEL_LABELS } from "./data.js";
import { renderBasicConversationIntro, renderLevelSelect, renderChapter } from "./screens.js";

export const basicConversation = {
  id: "basic-conversation",
  card: {
    screen: "learning-basic-conversation",
    emoji: "🗣️",
    color: "#FF9F45",
    name: "기초 영어회화 (7세 이하)",
    desc: `일상대화로 배우는 첫 영어 · 목차 ${CHAPTERS.length}개`,
  },
  // 복습(SRS) 대상 해석기(D-92) — 자세한 이유는 elementary-conversation/index.js 참고.
  // 이 도구의 key는 도구 접두어 없이 `${chapterId}-${level}`이다(가장 먼저 만들어진 도구라
  // 접두어를 안 붙였고, 화면 id처럼 이미 저장된 값이라 지금 와서 못 바꾼다).
  resolveReview(key, id) {
    const m = /^(.+)-(basic|intermediate|advanced)$/.exec(key);
    if (!m) return null;
    const chapter = CHAPTERS.find((c) => c.id === m[1]);
    const sentence = chapter && chapter.sentences.find((s) => s.id === id);
    if (!sentence) return null;
    return { text: sentence.text, ko: sentence.ko, where: `기초 영어회화 · ${chapter.title}`, type: "repeat" };
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
    render: () => renderLevelSelect(ch),
    theme: "learning",
  })),
  ...CHAPTERS.flatMap((ch) =>
    Object.keys(LEVEL_LABELS).map((level) => ({
      id: `learning-basic-conversation-${ch.id}-${level}`,
      path: `/learning/basic-conversation/${ch.id}/${level}`,
      title: `${ch.title} · ${LEVEL_LABELS[level]} | 과몰입구역`,
      render: () => renderChapter(ch, level),
      theme: "learning",
    }))
  ),
];
