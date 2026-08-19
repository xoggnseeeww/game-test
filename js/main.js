// 진입점: 공통 화면과 테스트별 화면을 라우터에 등록하고 부팅한다.
import { registerScreens, registerTest, registerGame, registerLearning, start } from "./core/router.js";
import { initHeader } from "./core/header.js";
import { initLearningSync } from "./learning/cloud.js";
import { commonScreens } from "./screens/home.js";
import { adhdTest, adhdScreens } from "./tests/adhd/index.js";
import { discTest, discScreens } from "./tests/disc/index.js";
import { coupleTest, coupleScreens } from "./tests/couple/index.js";
import { numpathGame, numpathScreens } from "./games/numpath/index.js";
import { basicConversation, basicConversationScreens } from "./learning/basic-conversation/index.js";
import { elementaryConversation, elementaryConversationScreens } from "./learning/elementary-conversation/index.js";
import { dialogue, dialogueScreens } from "./learning/dialogue/index.js";
import { civilVocab, civilVocabScreens } from "./learning/civil-vocab/index.js";
import { reviewScreens } from "./learning/review.js";

registerScreens(commonScreens);

registerTest(coupleTest);
registerScreens(coupleScreens);

registerTest(discTest);
registerScreens(discScreens);

registerTest(adhdTest);
registerScreens(adhdScreens);

registerGame(numpathGame);
registerScreens(numpathScreens);

registerLearning(basicConversation);
registerScreens(basicConversationScreens);

registerLearning(elementaryConversation);
registerScreens(elementaryConversationScreens);

registerLearning(dialogue);
registerScreens(dialogueScreens);

registerLearning(civilVocab);
registerScreens(civilVocabScreens);

// 복습(D-92)은 도구가 아니라 도구들을 가로지르는 화면이라 registerLearning을 안 한다 —
// 학습 목록에 카드로 뜨면 "네 번째 도구"처럼 보이는데, 실제로는 세 도구의 결과를 모으는 곳이다.
registerScreens(reviewScreens);

initHeader();
initLearningSync();
start();
