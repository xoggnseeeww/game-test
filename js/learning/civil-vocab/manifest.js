// DAY 목록(목차) — **단어 데이터가 아니라 메타데이터만** 들어간다.
//
// 이 파일만 정적으로 import된다(index.js·screens.js·홈 카드가 개수를 알아야 하므로).
// 단어 본문은 words/day-*.js에 있고 loader.js의 동적 import로만 불린다 — 목표가 8000단어라
// 전부 정적으로 실으면 첫 화면이 수 MB가 된다(docs/vocab-architecture.md §2).
//
// count를 여기 적어두는 이유: 목차·카드가 파일을 열지 않고도 개수를 보여줘야 하는데,
// 그러면 실제 파일과 어긋날 수 있다 → test/learning.vocab.test.js가 매번 대조한다.
//
// **아직 만들지 않은 DAY는 여기 넣지 않는다**(이 저장소 관례: 빈 기능을 화면에 먼저
//노출하지 않는다). 콘텐츠를 채우면 이 배열에 줄만 추가하면 되고 화면·라우팅은 안 고친다.
export const TOOL_ID = "civil-vocab";

// 한 문제에 보여줄 보기 수. 오답 보기는 **같은 DAY의 다른 단어 뜻**에서 자동으로 뽑는다 —
// 콘텐츠를 새로 만들지 않고, 단어가 늘면 문제도 저절로 는다(D-95에서 쓴 방식).
export const QUIZ_CHOICES = 4;

// 하루에 새로 시작할 단어 수(D-99, D-102에서 학습자 설정으로). 상한이 없으면 신규만 몰아서
// 하다가 며칠 뒤 복습이 눈덩이가 된다 — 8000단어에서 이 값이 사실상 코스의 속도다.
// **최소 20**은 사용자 지시다. 그 아래로는 8000단어가 현실적인 기간 안에 안 끝난다
// (20개면 400일, 50개면 160일). 위쪽은 하루 분량이 감당 가능한 선에서 끊었다.
export const MIN_NEW_PER_DAY = 20;
export const MAX_NEW_PER_DAY = 200;
export const NEW_PER_DAY_OPTIONS = [20, 30, 50, 100];
export const DEFAULT_NEW_PER_DAY = MIN_NEW_PER_DAY;

// 어디서 들어온 값이든(옛 저장분·서버·직접 입력) 허용 범위로 좁힌다. 순수 함수라 테스트가 직접 검증한다.
export function normalizeNewPerDay(value) {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return DEFAULT_NEW_PER_DAY;
  return Math.min(MAX_NEW_PER_DAY, Math.max(MIN_NEW_PER_DAY, n));
}

export const STAGES = [
  {
    id: "stage-1",
    label: "1단계 · 최빈출",
    emoji: "🥇",
    desc: "기출에서 가장 자주 나오는 어휘부터",
    days: [
      { id: "day-001", label: "DAY 1", count: 50, theme: "핵심 동사 ①", preview: "abolish · accommodate · assess" },
      { id: "day-002", label: "DAY 2", count: 50, theme: "con·de·dis 계열", preview: "constitute · deprive · distort" },
      { id: "day-003", label: "DAY 3", count: 50, theme: "ex·in 계열", preview: "exceed · inherent · integrate" },
      { id: "day-004", label: "DAY 4", count: 50, theme: "per·pre·pro·re 계열", preview: "perceive · prohibit · restrain" },
    ],
  },
];

export const DAYS = STAGES.flatMap((stage) => stage.days.map((day) => ({ ...day, stage: stage.id, stageLabel: stage.label })));

export const TOTAL_WORDS = DAYS.reduce((sum, day) => sum + day.count, 0);

export function findDay(dayId) {
  return DAYS.find((day) => day.id === dayId) || null;
}
