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
  renderCoupleInvite,
  renderCouplePair,
  renderCoupleReport,
  renderCoupleShared,
  coupleReady,
  coupleBlocked,
  partnerFromUrl,
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
    // 배우자 코드는 ?p= 쿼리로 온다. 슬러그가 아니라서 공유 결과 주소(/result/<슬러그>)
    // 규칙에 태울 수 없고, 라우터가 경로에 location.search를 붙여주므로 코드가 유지된다.
    path: "/test/couple/pair",
    title: "배우자와 결과 합치기 | 과몰입구역",
    render: renderCouplePair,
    theme: "couple",
    // guard에서 코드를 한 번 읽어 state에 캐시한다. 코드가 깨졌으면 인트로로 돌린다.
    guard: () => {
      if (!partnerFromUrl()) return "couple-intro";
      return coupleReady() ? "couple-report" : null;
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
