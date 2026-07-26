// 진입점: 공통 화면과 테스트별 화면을 라우터에 등록하고 부팅한다.
import { registerScreens, registerTest, start } from "./core/router.js";
import { commonScreens } from "./screens/home.js";
import { adhdTest, adhdScreens } from "./tests/adhd/index.js";
import { discTest, discScreens } from "./tests/disc/index.js";

registerScreens(commonScreens);

registerTest(discTest);
registerScreens(discScreens);

registerTest(adhdTest);
registerScreens(adhdScreens);

start();
