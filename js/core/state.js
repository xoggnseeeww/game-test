// 앱 전체가 공유하는 단일 상태 객체. 테스트별로 네임스페이스를 나눠서
// 한쪽 테스트를 하다 나가도 다른 쪽 진행 상황이 섞이지 않게 한다.
export const state = {
  screen: "home",
  answers: [],
  lastReaction: null,
};
