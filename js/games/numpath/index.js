// NumPath: Stack & Clear 디스크립터: 화면 정의와 미니게임 목록 카드 정보를 라우터에 넘긴다.
import { state } from "../../core/state.js";
import { DIFFICULTIES, stageCountFor } from "./data.js";
import { renderNumpathIntro, renderNumpathAd, renderNumpathResult } from "./screens.js";
import { renderNumpathPlay } from "./play.js";

export const numpathGame = {
  id: "numpath",
  card: {
    screen: "numpath-intro",
    emoji: "🧮",
    color: "#1FAE6A",
    name: "NumPath: Stack & Clear",
    desc: `숫자 경로 퍼즐 · 난이도 ${DIFFICULTIES.length}종`,
  },
};

const hasRun = () => !!state.numpath.run;
const runFinished = () => hasRun() && state.numpath.run.stars.length >= stageCountFor(state.numpath.run.difficulty);

export const numpathScreens = [
  {
    id: "numpath-intro",
    path: "/game/numpath",
    title: "NumPath: Stack & Clear | 과몰입구역",
    render: renderNumpathIntro,
    theme: "game",
  },
  {
    id: "numpath-play",
    path: "/game/numpath/play",
    title: "NumPath: Stack & Clear - 플레이 중 | 과몰입구역",
    render: renderNumpathPlay,
    theme: "game",
    // 런이 없는데 주소로 바로 들어오면 이어질 게 없다.
    guard: () => (hasRun() ? null : "numpath-intro"),
  },
  {
    id: "numpath-ad",
    path: "/game/numpath/ad",
    title: "결과 준비 중 | 과몰입구역",
    render: renderNumpathAd,
    theme: "game",
    guard: () => {
      if (!hasRun()) return "numpath-intro";
      if (!runFinished()) return "numpath-play";
      return null;
    },
  },
  {
    id: "numpath-result",
    path: "/game/numpath/result",
    title: "NumPath: Stack & Clear 결과 | 과몰입구역",
    render: renderNumpathResult,
    theme: "game",
    guard: () => {
      if (!hasRun()) return "numpath-intro";
      if (!runFinished()) return "numpath-play";
      return null;
    },
  },
];
