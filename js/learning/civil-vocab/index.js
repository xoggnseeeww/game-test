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
import { state } from "../../core/state.js";
import { summarize } from "./srs.js";

export const civilVocab = {
  id: "civil-vocab",
  card: {
    screen: "learning-civil-vocab",
    emoji: "📕",
    color: "#2F6FED",
    name: "9급 공무원 영단어",
    desc: `어원으로 외우는 시험 어휘 · 단어 ${TOTAL_WORDS}개`,
  },

  // 마이페이지의 "학습 진행" 집계용(D-101). 이 도구의 진행은 `state.learning`이 아니라
  // `state.vocab`에 있어서, state.learning만 훑는 마이페이지에는 **아무것도 안 보였다** —
  // 사용자가 "연동이 안 되는 것 같다"고 지적한 게 이것이다.
  // 마이페이지가 도구를 import하지 않는다는 경계(D-70)를 지키려고, 화면이 그대로 그릴 수 있는
  // 문장만 돌려준다(도구가 자기 말로 설명하고, 화면은 배치만 한다).
  summary() {
    const s = summarize(state.vocab.cards);
    if (s.seen === 0) return null;   // 아직 시작 안 한 도구는 마이페이지에 줄을 늘리지 않는다
    const lines = [`단어 ${s.seen}개를 만났고, 그중 ${s.learned}개가 복습 일정에 올라 있어요.`];
    lines.push(s.due > 0
      ? `오늘 다시 볼 단어가 ${s.due}개 있어요.`
      : "오늘 다시 볼 단어는 없어요 — 오늘 본 단어는 내일부터 차례로 올라와요.");
    if (s.leech > 0) lines.push(`여러 번 틀린 단어가 ${s.leech}개 있어요.`);
    return { name: this.card.name, emoji: this.card.emoji, lines, due: s.due,
             actionLabel: s.due > 0 ? "오늘 학습 시작하기" : "이어서 공부하기",
             screen: "learning-civil-vocab-today" };
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
    title: "오늘 학습 · 9급 영단어 | 과몰입구역",   // D-101에서 화면 이름을 "오늘 학습"으로 바꿨는데 탭 제목은 그대로였다
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
