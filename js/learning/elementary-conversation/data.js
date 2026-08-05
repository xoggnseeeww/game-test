// "초등 영어회화" 도구의 목차. `기초 영어회화`(7세 이하, basic-conversation)의 다음 단계 —
// 사용자 지적(D-75): "7세 이하는 반복이면 되지만 초등학교부터는 실질적 회화 및 언어 향상이
// 동반돼야 한다"는 요구에 맞춰, basic-conversation과 같은 "듣고 따라 말하기"만으로는
// 부족한 세 가지를 이 도구에서 보강한다.
//
// ① 문법 진행(scope & sequence) — 챕터를 상황으로만 나누면 문법이 우연히 등장했다 사라진다.
//    모든 문장에 `grammar`(GRAMMAR_POINTS의 id)를 달아, 어떤 챕터에서 어떤 문법이 처음
//    나오는지 추적할 수 있게 한다.
// ② 반복(recycling) — 새 챕터의 중급/심화 문장은 그 챕터의 새 문법만 쓰지 않고, **이전
//    챕터에서 이미 나온 문법도 최소 한 번은 다시 섞어 쓴다.** 새 문법 하나를 배우고 잊는
//    대신, 이미 배운 문법 위에 새 문법을 얹는 식으로 계속 다시 만나게 한다.
//    `test/learning.elementary.test.js`가 챕터 2번째부터 이 규칙을 강제한다.
// ③ 순수 반복의 천장 — 정해진 문장 하나를 얼마나 똑같이 따라했는지(Levenshtein)만 재는
//    채점은 암기·발음 훈련이지 "새 문장을 만드는 능력"을 안 본다. `type: "produce"` 문장을
//    섞어서, 정답 문장을 읽어주는 대신 **질문만 던지고** 아이가 스스로 문장을 만들어
//    답하게 한다. 하나의 정답으로 채점할 수 없으니 유사도 대신 예시 답안(`sample`)을
//    보여주고 스스로 판단하게 한다(screens.js의 produce 흐름).
//
// 학년은 저학년(1~2)/중학년(3~4)/고학년(5~6) 3단계로 나누되, **실제로 만든 학년만
// GRADES에 넣는다** — 아직 안 만든 학년을 목차에 "준비중"으로 미리 보여주지 않는다(이
// 저장소 관례: 빈 기능을 화면에 먼저 노출하지 않는다). 지금은 저학년, 그 안에서도 챕터
// 하나(학교 가는 날)만 프로토타입으로 만들었다 — 문장 개수(기본 10·중급 6·심화 4, 총
// 20개)도 기초 영어회화의 최종 목표(단계별 30개)보다 적게 시작한다. 메커니즘(문법 태그·
// 반복·produce)이 실제로 동작하는 걸 먼저 확인하고, 확인되면 같은 틀로 챕터·학년을
// 늘린다.
//
// 문장에는 여전히 `level`이 있다(기본/중급/심화, basic-conversation과 같은 의미) — 학년
// 트랙 위에 기존 3단계 레벨 선택을 그대로 얹는다.
export const LEVEL_LABELS = { basic: "기본", intermediate: "중급", advanced: "심화" };

// 저학년 문법 순서(scope & sequence). id는 문장의 `grammar` 필드에서 참조한다. 학년이
// 늘어나면 그 학년의 목록을 따로 두되(예: MIDDLE_GRAMMAR_POINTS), 저학년 것과 번호가
// 겹치지 않게 이어 붙인다 — 지금은 저학년만 있어서 파일 하나로 충분하다.
export const LOWER_GRAMMAR_POINTS = [
  { id: "G1", label: "be동사 현재형 (am/is/are)" },
  { id: "G2", label: "일반동사 현재형 (3인칭 단수 포함)" },
  { id: "G3", label: "조동사 can (능력·허락)" },
  { id: "G4", label: "There is/are · 위치 전치사" },
];

const SCHOOL_DAY_CHAPTER = {
  id: "school-day",
  title: "학교 가는 날",
  emoji: "🎒",
  sentences: [
    { id: "time-for-school", text: "It's time for school.", ko: "학교 갈 시간이에요.", grammar: "G1" },
    { id: "have-a-backpack", text: "I have a backpack.", ko: "저는 책가방이 있어요.", grammar: "G2" },
    { id: "backpack-is-heavy", text: "My backpack is heavy.", ko: "제 책가방은 무거워요.", grammar: "G1" },
    { id: "need-my-pencil-case", text: "I need my pencil case.", ko: "필통이 필요해요.", grammar: "G2" },
    { id: "wheres-my-water-bottle", text: "Where is my water bottle?", ko: "제 물병 어디 있어요?", grammar: "G1" },
    { id: "the-school-bus-is-here", text: "The school bus is here.", ko: "스쿨버스가 왔어요.", grammar: "G1" },
    { id: "i-walk-to-school", text: "I walk to school.", ko: "저는 학교까지 걸어가요.", grammar: "G2" },
    { id: "classroom-on-second-floor", text: "My classroom is on the second floor.", ko: "제 교실은 2층에 있어요.", grammar: "G1" },
    { id: "sit-next-to-my-friend", text: "I sit next to my friend.", ko: "저는 친구 옆에 앉아요.", grammar: "G2" },
    { id: "school-starts-at-nine", text: "School starts at nine.", ko: "학교는 9시에 시작해요.", grammar: "G2" },

    { id: "can-i-bring-my-pencil", text: "Can I bring my favorite pencil?", ko: "제가 좋아하는 연필 가져가도 돼요?", grammar: "G3", level: "intermediate" },
    { id: "new-student-in-my-class", text: "There is a new student in my class.", ko: "우리 반에 새로운 학생이 있어요.", grammar: "G4", level: "intermediate" },
    { id: "can-you-check-my-backpack", text: "Can you check my backpack?", ko: "제 책가방 확인해줄 수 있어요?", grammar: "G3", level: "intermediate" },
    { id: "twenty-students-in-my-class", text: "There are twenty students in my class.", ko: "우리 반에는 학생이 스무 명 있어요.", grammar: "G4", level: "intermediate" },
    {
      id: "what-do-you-bring-to-school",
      text: "What do you bring to school every day?",
      ko: "학교에 매일 뭘 가져가요?",
      grammar: "G2",
      level: "intermediate",
      type: "produce",
      sample: ["I bring my backpack and my pencil case.", "I bring my water bottle."],
    },
    {
      id: "one-thing-in-your-classroom",
      text: "Can you tell me one thing in your classroom?",
      ko: "교실에 있는 것 하나만 말해줄래요?",
      grammar: "G4",
      level: "intermediate",
      type: "produce",
      sample: ["There is a big board.", "There is my desk."],
    },

    { id: "like-school-because-friends", text: "I like school because I can see my friends.", ko: "저는 친구들을 볼 수 있어서 학교가 좋아요.", grammar: "G3", level: "advanced" },
    { id: "no-clock-in-my-classroom", text: "There isn't a clock in my classroom.", ko: "제 교실에는 시계가 없어요.", grammar: "G4", level: "advanced" },
    {
      id: "why-do-you-like-school",
      text: "Why do you like or not like going to school?",
      ko: "학교 가는 게 왜 좋아요, 아니면 왜 싫어요?",
      grammar: "G2",
      level: "advanced",
      type: "produce",
      sample: ["I like school because it's fun.", "I don't like school because I wake up early."],
    },
    {
      id: "whats-in-your-pencil-case",
      text: "What is in your pencil case?",
      ko: "필통 안에 뭐가 있어요?",
      grammar: "G4",
      level: "advanced",
      type: "produce",
      sample: ["There are pencils and an eraser.", "I have two pencils."],
    },
  ],
};

// 학년 트랙 — 실제로 만든 학년만 넣는다(위 헤더 설명 참고). 중학년/고학년은 그 학년의
// GRAMMAR_POINTS·챕터가 준비되면 여기 항목을 추가한다(레지스트리를 새로 만들 필요
// 없음 — index.js가 GRADES를 순회해 화면을 자동 생성한다).
export const GRADES = [
  {
    id: "lower",
    label: "저학년 (1~2학년)",
    emoji: "🎒",
    grammarPoints: LOWER_GRAMMAR_POINTS,
    chapters: [SCHOOL_DAY_CHAPTER],
  },
];
