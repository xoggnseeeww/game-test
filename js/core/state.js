// 앱 전체가 공유하는 단일 상태 객체. 테스트별로 네임스페이스를 나눠서
// 한쪽 테스트를 하다 나가도 다른 쪽 진행 상황이 섞이지 않게 한다.
export const state = {
  screen: "home",
  answers: [],
  lastReaction: null,
  // DISC는 한 문항이 2단계(가장 나 같은 것 / 아닌 것)라, 반쯤 답한 상태(pending)도
  // state에 있어야 한다. render()가 매번 DOM을 날리기 때문에 지역 변수로 두면
  // 뒤로가기·popstate에서 반쪽 답이 사라진다.
  disc: {
    order: null,
    answers: [],
    pending: { most: null },
    dilemma: null,
  },
};
