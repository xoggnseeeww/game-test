// 성인 ADHD 성향 체크 디스크립터: 화면 정의와 목록 카드 정보를 라우터에 넘긴다.
import { state } from "../../core/state.js";
import { parseSharedPath } from "../../core/router.js";
import { QUESTIONS, SLUG_TO_PROFILE } from "./data.js";
import {
  renderTestIntro,
  renderQuestion,
  renderResult,
  renderTestShared,
  renderReactionIntro,
  renderReactionPlay,
  renderReactionResult,
} from "./screens.js";

export const adhdTest = {
  id: "adhd",
  slugToKey: SLUG_TO_PROFILE,
  sharedScreen: "test-shared",
  card: {
    screen: "test-intro",
    emoji: "🎯",
    color: "#5B44F2",
    name: "성인 ADHD 성향 체크",
    desc: `집중 안 되는 나, 혹시…? · ${QUESTIONS.length}문항`,
  },
};

// 화면 id는 예전 이름(test-*)을 그대로 둔다. 이미 열려 있는 탭의 history.state에
// "test-result" 같은 문자열이 남아 있어서, 이름을 바꾸면 배포 직후 뒤로가기가 깨진다.
export const adhdScreens = [
  {
    id: "test-intro",
    path: "/test/adhd",
    title: "성인 ADHD 성향 체크 | 과몰입구역",
    render: renderTestIntro,
  },
  {
    id: "test-question",
    path: "/test/adhd/play",
    title: "성인 ADHD 성향 체크 - 진행 중 | 과몰입구역",
    render: renderQuestion,
    // 답을 다 채운 상태에서 주소로 문항 화면에 들어오면 마지막 문항을 다시 풀게 되돌린다.
    guard: () => {
      if (state.answers.length >= QUESTIONS.length) {
        state.answers = state.answers.slice(0, QUESTIONS.length - 1);
      }
      return null;
    },
  },
  {
    id: "test-result",
    path: "/test/adhd/result",
    title: "성인 ADHD 성향 체크 결과 | 과몰입구역",
    render: renderResult,
    guard: () => (state.answers.length < QUESTIONS.length ? "test-intro" : null),
  },
  {
    id: "test-shared",
    title: "친구의 성향 체크 결과 | 과몰입구역",
    render: renderTestShared,
    dynamicPath: true,
    // popstate로 이 화면 이름만 복원되고 주소는 다른 곳일 수 있다.
    // 그대로 그리면 슬러그가 안 풀려서 undefined를 참조하다 터진다.
    guard: () => (parseSharedPath(location.pathname) ? null : "home"),
  },
  {
    id: "reaction-intro",
    path: "/test/adhd/reaction",
    title: "반응속도 게임 | 과몰입구역",
    render: renderReactionIntro,
    theme: "game",
  },
  {
    id: "reaction-play",
    path: "/test/adhd/reaction/play",
    title: "반응속도 게임 - 플레이 중 | 과몰입구역",
    render: renderReactionPlay,
    theme: "game",
  },
  {
    id: "reaction-result",
    path: "/test/adhd/reaction/result",
    title: "반응속도 게임 결과 | 과몰입구역",
    render: renderReactionResult,
    theme: "game",
    guard: () => (state.lastReaction ? null : "reaction-intro"),
  },
];
