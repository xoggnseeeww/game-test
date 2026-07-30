// 부부 관계 성향 체크 디스크립터: 화면 정의와 목록 카드 정보를 라우터에 넘긴다.
import { state } from "../../core/state.js";
import { parseSharedPath } from "../../core/router.js";
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
  coupleBlocked,
  partnerFromUrl,
} from "./screens.js";
import { renderCoupleInvite, renderCouplePair, renderCoupleReport } from "./screens-match.js";

export const coupleTest = {
  id: "couple",
  slugToKey: COUPLE_SLUG_TO_KEY,
  sharedScreen: "couple-shared",
  card: {
    screen: "couple-intro",
    emoji: "💞",
    color: "#D9436F",
    name: "부부 관계 성향 체크",
    desc: `배우자와 결과 합치기 · ${ITEM_TOTAL}문항`,
  },
};

const hasSetup = () => Boolean(state.couple.setup && state.couple.items);

export const coupleScreens = [
  {
    id: "couple-intro",
    path: "/test/couple",
    title: "부부 관계 성향 체크 | 과몰입구역",
    render: renderCoupleIntro,
    theme: "couple",
  },
  {
    // 이용 안내. 진행 상태와 무관하게 언제든 볼 수 있어야 해서 guard가 없다 —
    // "둘이 하면 더 정확해지나?" 같은 의문은 대개 시작하기 직전이나 결과를 본 직후에 생긴다.
    id: "couple-guide",
    path: "/test/couple/guide",
    title: "이용 안내 | 부부 관계 성향 체크",
    render: renderCoupleGuide,
    theme: "couple",
  },
  {
    id: "couple-setup",
    path: "/test/couple/setup",
    title: "상황 고르기 | 과몰입구역",
    render: renderCoupleSetup,
    theme: "couple",
  },
  {
    id: "couple-question",
    path: "/test/couple/play",
    title: "부부 관계 성향 체크 - 진행 중 | 과몰입구역",
    render: renderCoupleQuestion,
    theme: "couple",
    // 주소로 바로 들어오면 문항지가 조립돼 있지 않다. 세 축을 먼저 고르게 되돌린다.
    guard: () => {
      if (!hasSetup()) return "couple-intro";
      // 다 답한 상태로 이 화면에 들어오면(뒤로가기 등) 마지막 문항으로 되돌린다 —
      // 그러지 않으면 index가 배열 밖을 가리켜 빈 화면이 된다.
      if (state.couple.index >= state.couple.items.length) {
        state.couple.index = state.couple.items.length - 1;
      }
      return null;
    },
  },
  {
    id: "couple-ad",
    path: "/test/couple/ad",
    title: "결과 준비 중 | 과몰입구역",
    render: renderCoupleAd,
    theme: "couple",
    guard: () => (coupleReady() ? null : "couple-intro"),
  },
  {
    id: "couple-result",
    path: "/test/couple/result",
    title: "부부 관계 성향 체크 결과 | 과몰입구역",
    render: renderCoupleResult,
    theme: "couple",
    guard: () => (coupleReady() ? null : "couple-intro"),
  },
  {
    id: "couple-invite",
    path: "/test/couple/invite",
    title: "배우자 초대 | 과몰입구역",
    render: renderCoupleInvite,
    theme: "couple",
    // 결과가 안 나올 응답(플래그 2개 이상)으로는 코드를 만들지 않는다 — 결과 화면이
    // 재응답을 안내하고 있으므로 그쪽으로 되돌린다.
    guard: () => {
      if (!coupleReady()) return "couple-intro";
      return coupleBlocked() ? "couple-result" : null;
    },
  },
  {
    id: "couple-pair",
    // 배우자 코드는 ?p= 쿼리로 올 수도 있고(링크 클릭), 화면에서 직접 입력할 수도 있다
    // (인트로·결과 화면의 "부부 결과 매칭" 버튼). 주소에 코드가 없다고 인트로로 돌리지
    // 않는다 — 없으면 renderCouplePair()가 직접 입력하는 화면을 보여준다.
    path: "/test/couple/pair",
    title: "배우자와 결과 합치기 | 과몰입구역",
    render: renderCouplePair,
    theme: "couple",
    // guard에서 주소의 코드를 한 번 읽어 state에 캐시한다(코드가 깨졌으면 partnerFromUrl이
    // null을 돌려주고, 화면이 직접 입력 폼으로 보여준다). 이미 양쪽 다 준비돼 있으면
    // 이 화면을 거칠 필요 없이 곧장 결합 결과로 보낸다.
    guard: () => {
      partnerFromUrl();
      return coupleReady() && state.couple.partner ? "couple-report" : null;
    },
  },
  {
    id: "couple-report",
    path: "/test/couple/together",
    title: "두 분의 결합 결과 | 과몰입구역",
    render: renderCoupleReport,
    theme: "couple",
    guard: () => {
      if (!partnerFromUrl()) return "couple-intro";
      return coupleReady() ? null : "couple-intro";
    },
  },
  {
    id: "couple-shared",
    title: "관계 성향 유형 | 과몰입구역",
    render: renderCoupleShared,
    theme: "couple",
    dynamicPath: true,
    guard: () => (parseSharedPath(location.pathname) ? null : "home"),
  },
];
