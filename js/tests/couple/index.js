// 부부 관계 성향 체크 디스크립터: 화면 정의와 목록 카드 정보를 라우터에 넘긴다.
import { state } from "../../core/state.js";
import { parseSharedPath } from "../../core/router.js";
import { isAdmin } from "../../core/auth.js";
import { showModal } from "../../core/dom.js";
import { ITEM_TOTAL, COUPLE_SLUG_TO_KEY } from "./data.js";
import {
  renderCoupleIntro,
  renderCoupleSetup,
  renderCoupleQuestion,
  renderCoupleAd,
  renderCoupleResult,
  renderCoupleShared,
  renderCoupleGuide,
  coupleReady,
} from "./screens.js";

export const coupleTest = {
  id: "couple",
  slugToKey: COUPLE_SLUG_TO_KEY,
  sharedScreen: "couple-shared",
  card: {
    screen: "couple-intro",
    emoji: "💞",
    color: "#D9436F",
    name: "부부 관계 성향 체크",
    desc: `나의 관계 성향 · ${ITEM_TOTAL}문항`,
    // 관리자(로그인한 이메일이 auth.js의 ADMIN_EMAIL과 같을 때)에게만 실제로 열려 있다.
    // 목록 카드에 "출시 예정" 배지를 붙이는 표시일 뿐, 실제 차단은 아래 guard가 한다.
    comingSoon: true,
  },
};

const hasSetup = () => Boolean(state.couple.setup && state.couple.items);

// 아직 출시 전이라 관리자만 들어갈 수 있다. 비관리자가 어떤 경로로 들어오든(목록 카드
// 클릭·직접 주소 접속·공유 링크) 여기서 막고 "곧 출시됩니다" 모달을 띄운 뒤 목록으로
// 돌려보낸다.
function comingSoonGuard(rest) {
  return () => {
    if (!isAdmin()) {
      showModal({
        title: "곧 출시됩니다",
        body: "부부 관계 성향 체크는 아직 준비 중이에요.\n오픈되면 목록에서 만나보실 수 있어요!",
        cancelLabel: null,
      });
      return "psych-list";
    }
    return rest ? rest() : null;
  };
}

export const coupleScreens = [
  {
    id: "couple-intro",
    path: "/test/couple",
    title: "부부 관계 성향 체크 | 과몰입구역",
    render: renderCoupleIntro,
    theme: "couple",
    guard: comingSoonGuard(),
  },
  {
    // 이용 안내. 진행 상태와 무관하게 언제든 볼 수 있어야 해서 별도 조건이 없다 —
    // "이 결과를 어떻게 읽어야 하나" 같은 의문은 시작 직전이나 결과를 본 직후에 생긴다.
    id: "couple-guide",
    path: "/test/couple/guide",
    title: "이용 안내 | 부부 관계 성향 체크",
    render: renderCoupleGuide,
    theme: "couple",
    guard: comingSoonGuard(),
  },
  {
    id: "couple-setup",
    path: "/test/couple/setup",
    title: "상황 고르기 | 과몰입구역",
    render: renderCoupleSetup,
    theme: "couple",
    guard: comingSoonGuard(),
  },
  {
    id: "couple-question",
    path: "/test/couple/play",
    title: "부부 관계 성향 체크 - 진행 중 | 과몰입구역",
    render: renderCoupleQuestion,
    theme: "couple",
    // 주소로 바로 들어오면 문항지가 조립돼 있지 않다. 세 축을 먼저 고르게 되돌린다.
    guard: comingSoonGuard(() => {
      if (!hasSetup()) return "couple-intro";
      // 다 답한 상태로 이 화면에 들어오면(뒤로가기 등) 마지막 문항으로 되돌린다 —
      // 그러지 않으면 index가 배열 밖을 가리켜 빈 화면이 된다.
      if (state.couple.index >= state.couple.items.length) {
        state.couple.index = state.couple.items.length - 1;
      }
      return null;
    }),
  },
  {
    id: "couple-ad",
    path: "/test/couple/ad",
    title: "결과 준비 중 | 과몰입구역",
    render: renderCoupleAd,
    theme: "couple",
    guard: comingSoonGuard(() => (coupleReady() ? null : "couple-intro")),
  },
  {
    id: "couple-result",
    path: "/test/couple/result",
    title: "부부 관계 성향 체크 결과 | 과몰입구역",
    render: renderCoupleResult,
    theme: "couple",
    guard: comingSoonGuard(() => (coupleReady() ? null : "couple-intro")),
  },
  {
    id: "couple-shared",
    title: "관계 성향 유형 | 과몰입구역",
    render: renderCoupleShared,
    theme: "couple",
    dynamicPath: true,
    guard: comingSoonGuard(() => (parseSharedPath(location.pathname) ? null : "home")),
  },
];
