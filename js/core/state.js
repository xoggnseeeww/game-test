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
  // NumPath: run은 진행 중인 런(시드·난이도·현재 스테이지·스테이지별 별점)만 들고 있다. 현재
  // 스테이지의 보드 자체는 저장하지 않는다 — generatePuzzle(seed, stageIndex, difficulty)가
  // 결정적이라 매번 다시 만들어도 완전히 같은 보드가 나오고, 그래야 뒤로가기(popstate)로 이
  // 화면에 다시 들어와도(진행 중이던 이동·소멸은 반응속도 게임의 라운드 진행처럼 화면 지역
  // 변수라 초기화되는 게 자연스럽다) 최소한 "몇 번째 스테이지인지"는 안 잃어버린다.
  // muted는 세션 한정 음소거, difficulty는 인트로에서 마지막으로 고른 난이도(세션 한정).
  numpath: {
    run: null,
    muted: false,
    difficulty: "normal",
  },
  // 부부 관계 성향 체크. items는 세 축(호칭·역할·자녀단계)을 고른 뒤 조립되는 문항지라,
  // 축을 고르기 전에는 null이다. partner는 배우자 초대 링크(?p=)에서 푼 결과로, 문항을
  // 다시 시작해도 날아가면 안 되기 때문에 resetCouple()이 따로 살려둔다.
  couple: {
    setup: null,
    items: null,
    answers: {},
    index: 0,
    // 문항을 끝까지 마쳤는가. answers 개수로 대신 세면 안 된다 — 뒤로 가서 답을 고쳐보는
    // 동안에도 답은 전부 차 있어서, 결과 화면 guard가 그냥 통과해버린다.
    completed: false,
    startedAt: null,
    elapsedMs: null,
    partner: null,
    // 초대 화면에서 발급받은 짧은 코드 캐시. { code, for }에서 for는 그 코드를 발급받을 때
    // 실었던 25자 배우자 코드 — 재진입 시 이게 같으면 재발급 없이 그대로 쓴다(KV 쓰기
    // 한도가 하루 1,000회라 화면을 왔다갔다할 때마다 새로 발급하면 낭비다).
    shortCode: null,
  },
  // 학습(외국어 연습) 카테고리. 상황 폴더(js/learning/<id>) 하나당 키 하나씩 늘어난다 —
  // 지금은 어린이 모드 파일럿 하나(greeting)뿐이다. index만 있으면 되는 이유: 새로고침하면
  // 이 앱의 다른 진행 상황과 마찬가지로 통째로 날아가고, 세션 내 이동에서는 몇 번째
  // 문장인지만 잃지 않으면 된다(듣기/말하기 결과는 화면 지역 상태로 충분하다).
  learning: {
    greeting: { index: 0 },
  },
};
