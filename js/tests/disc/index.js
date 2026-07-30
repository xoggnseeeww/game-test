// DISC 검사 디스크립터: 화면 정의와 목록 카드 정보를 라우터에 넘긴다.
import { state } from "../../core/state.js";
import { parseSharedPath } from "../../core/router.js";
import { TETRADS, DISC_SLUG_TO_KEY } from "./data.js";
import {
  renderDiscIntro,
  renderDiscTypes,
  renderDiscQuestion,
  renderDiscResult,
  renderDiscShared,
  renderDilemmaIntro,
  renderDilemmaPlay,
  renderDilemmaAd,
} from "./screens.js";

export const discTest = {
  id: "disc",
  slugToKey: DISC_SLUG_TO_KEY,
  sharedScreen: "disc-shared",
  card: {
    screen: "disc-intro",
    emoji: "🎭",
    color: "#E8642E",
    name: "직장인 유형검사",
    desc: `나는 어떤 유형일까? · 상황 ${TETRADS.length}개 + 게임`,
  },
};

const done = () => state.disc.answers.length >= TETRADS.length;

export const discScreens = [
  {
    id: "disc-intro",
    path: "/test/disc",
    title: "직장인 유형검사 | 과몰입구역",
    render: renderDiscIntro,
    theme: "disc",
  },
  {
    id: "disc-types",
    path: "/test/disc/types",
    title: "직장인 유형검사 - 12가지 유형 미리보기 | 과몰입구역",
    render: renderDiscTypes,
    theme: "disc",
  },
  {
    id: "disc-question",
    path: "/test/disc/play",
    title: "직장인 유형검사 - 진행 중 | 과몰입구역",
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
    title: "직장인 유형검사 결과 | 과몰입구역",
    render: renderDiscResult,
    theme: "disc",
    // 문항과 딜레마 게임을 둘 다 마쳐야 결과를 볼 수 있다. 게임 결과까지 반영된
    // 유형을 한 번에 보여주기 위해서라, 문항만 끝난 상태로 들어오면 게임으로 보낸다.
    guard: () => {
      if (!done()) return "disc-intro";
      if (!state.disc.dilemma) return "dilemma-intro";
      return null;
    },
  },
  {
    id: "disc-shared",
    title: "친구의 직장인 유형 | 과몰입구역",
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
    id: "dilemma-ad",
    path: "/test/disc/dilemma/ad",
    title: "결과 준비 중 | 과몰입구역",
    render: renderDilemmaAd,
    theme: "disc",
    // 딜레마 게임까지 끝내야 이 화면에 올 게 있다 — 게임 전에 주소로 바로 들어오면 되돌린다.
    guard: () => {
      if (!done()) return "disc-intro";
      if (!state.disc.dilemma) return "dilemma-intro";
      return null;
    },
  },
];
