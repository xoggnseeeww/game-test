// DISC 검사 디스크립터: 화면 정의와 목록 카드 정보를 라우터에 넘긴다.
import { state } from "../../core/state.js";
import { parseSharedPath } from "../../core/router.js";
import { TETRADS, DISC_SLUG_TO_KEY } from "./data.js";
import {
  renderDiscIntro,
  renderDiscQuestion,
  renderDiscResult,
  renderDiscShared,
  renderDilemmaIntro,
  renderDilemmaPlay,
  renderDilemmaResult,
} from "./screens.js";

export const discTest = {
  id: "disc",
  slugToKey: DISC_SLUG_TO_KEY,
  sharedScreen: "disc-shared",
  card: {
    screen: "disc-intro",
    emoji: "🎭",
    color: "#E8642E",
    name: "DISC 행동유형 검사",
    desc: `나는 어떤 유형일까? · 상황 ${TETRADS.length}개`,
  },
};

const done = () => state.disc.answers.length >= TETRADS.length;

export const discScreens = [
  {
    id: "disc-intro",
    path: "/test/disc",
    title: "DISC 행동유형 검사 | 과몰입구역",
    render: renderDiscIntro,
    theme: "disc",
  },
  {
    id: "disc-question",
    path: "/test/disc/play",
    title: "DISC 행동유형 검사 - 진행 중 | 과몰입구역",
    render: renderDiscQuestion,
    theme: "disc",
    // 주소로 바로 들어오면 반쯤 채워진 상태가 없으니 인트로부터 시작하게 한다.
    guard: () => {
      if (!state.disc.order) return "disc-intro";
      if (done()) state.disc.answers = state.disc.answers.slice(0, TETRADS.length - 1);
      return null;
    },
  },
  {
    id: "disc-result",
    path: "/test/disc/result",
    title: "DISC 행동유형 검사 결과 | 과몰입구역",
    render: renderDiscResult,
    theme: "disc",
    guard: () => (done() ? null : "disc-intro"),
  },
  {
    id: "disc-shared",
    title: "친구의 DISC 유형 | 과몰입구역",
    render: renderDiscShared,
    theme: "disc",
    dynamicPath: true,
    guard: () => (parseSharedPath(location.pathname) ? null : "home"),
  },
  {
    id: "dilemma-intro",
    path: "/test/disc/dilemma",
    title: "딜레마 게임 | 과몰입구역",
    render: renderDilemmaIntro,
    theme: "disc",
    guard: () => (done() ? null : "disc-intro"),
  },
  {
    id: "dilemma-play",
    path: "/test/disc/dilemma/play",
    title: "딜레마 게임 - 플레이 중 | 과몰입구역",
    render: renderDilemmaPlay,
    theme: "disc",
    guard: () => (done() ? null : "disc-intro"),
  },
  {
    id: "dilemma-result",
    path: "/test/disc/dilemma/result",
    title: "딜레마 게임 결과 | 과몰입구역",
    render: renderDilemmaResult,
    theme: "disc",
    guard: () => (state.disc.dilemma ? null : "dilemma-intro"),
  },
];
