// 진입점: 공통 화면과 테스트별 화면을 라우터에 등록하고 부팅한다.
import { registerScreens, registerTest, start } from "./core/router.js";
import { renderHome, renderPsychList, renderGameList } from "./screens/home.js";
import { adhdTest, adhdScreens } from "./tests/adhd/index.js";

registerScreens([
  { id: "home", path: "/", title: "과몰입구역 - 심리테스트 · 미니게임", render: renderHome },
  { id: "psych-list", path: "/test", title: "심리테스트 | 과몰입구역", render: renderPsychList },
  { id: "game-list", path: "/game", title: "미니게임 | 과몰입구역", render: renderGameList },
]);

registerTest(adhdTest);
registerScreens(adhdScreens);

start();
