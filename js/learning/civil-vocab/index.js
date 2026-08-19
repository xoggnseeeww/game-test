// 학습 카테고리의 도구 4번째: 9급 공무원 영단어(어원 중심 어휘 학습).
//
// 앞의 세 도구와 다른 점 둘:
//  1) **데이터를 정적으로 안 들고 온다** — 목표가 8000단어라 manifest.js(메타데이터)만
//     import하고 단어 본문은 loader.js의 동적 import로 화면에서 받는다.
//  2) **resolveReview를 두지 않는다** — 도구를 가로지르는 "오늘 복습"(D-92)은 문장 카드
//     UI이고 하루 수십~수백 개가 나오는 단어와 섞이면 그 화면이 단어로 덮인다. 어휘 복습은
//     이 도구 안에 자체 일정(다음 단계)으로 두기로 사용자와 정했다
//     (docs/vocab-architecture.md §5). 그래서 여기 없는 건 빠뜨린 게 아니라 결정이다.
import { DAYS, TOTAL_WORDS } from "./manifest.js";
import { renderVocabIntro, renderVocabDay, renderVocabToday } from "./screens.js";

export const civilVocab = {
  id: "civil-vocab",
  card: {
    screen: "learning-civil-vocab",
    emoji: "📕",
    color: "#2F6FED",
    name: "9급 공무원 영단어",
    desc: `어원으로 외우는 시험 어휘 · 단어 ${TOTAL_WORDS}개`,
  },
};

export const civilVocabScreens = [
  {
    id: "learning-civil-vocab",
    path: "/learning/civil-vocab",
    title: "9급 공무원 영단어 | 과몰입구역",
    render: renderVocabIntro,
    theme: "learning",
  },
  {
    id: "learning-civil-vocab-today",
    path: "/learning/civil-vocab/today",
    title: "오늘 복습 · 9급 영단어 | 과몰입구역",
    render: renderVocabToday,
    theme: "learning",
  },
  // DAY가 늘어나도 이 파일은 안 고친다 — manifest.js의 DAYS에 줄만 추가하면 화면이 생긴다.
  ...DAYS.map((day) => ({
    id: `learning-civil-vocab-${day.id}`,
    path: `/learning/civil-vocab/${day.id}`,
    title: `${day.label} · 9급 영단어 | 과몰입구역`,
    render: () => renderVocabDay(day),
    theme: "learning",
  })),
];
