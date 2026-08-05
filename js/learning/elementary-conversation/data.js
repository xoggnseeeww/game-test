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
//    보여주고 스스로 판단하게 한다(screens.js의 produce 흐름). 아무 참고 없이 백지에서
//    시작하면 얼어붙는 아이가 있을 수 있어, 시도 전에 문장 시작 조각인 `hint`(예: "I bring
//    ___.")를 먼저 보여준다 — 정답은 아니고 어디서부터 말을 시작하면 될지 감만 준다.
//
// 학년은 저학년(1~2)/중학년(3~4)/고학년(5~6) 3단계로 나누되, **실제로 만든 학년만
// GRADES에 넣는다** — 아직 안 만든 학년을 목차에 "준비중"으로 미리 보여주지 않는다(이
// 저장소 관례: 빈 기능을 화면에 먼저 노출하지 않는다). 지금은 저학년 챕터 4개(학교 가는
// 날·교실에서·쉬는 시간·좋아하는 것)와 중학년 챕터 4개(수업과 과제·친구 관계·방과 후
// 생활·우리 동네)를 만들었다(D-77, D-78) — 챕터마다 문장 개수는 기본 10·중급 6·심화
// 4(총 20개)로, 기초 영어회화의 최종 목표(단계별 30개)보다 적게 시작한다. 메커니즘
// (문법 태그·반복·produce)이 저학년 챕터 하나(학교 가는 날)에서 실제로 동작하는 걸
// 먼저 확인한 뒤(D-75, D-76) 같은 틀로 저학년 나머지·중학년을 채웠다 — 문법은 챕터마다
// 하나씩 안 늘린다(예: 좋아하는 것·우리 동네 챕터는 새 문법 없이 기존 문법만 재사용).
// 학년마다 문법 목록(`*_GRAMMAR_POINTS`)이 따로 있고, id는 그 학년 배열 안에서만
// 유효하다 — 두 학년이 같은 개념(예: 일반동사 현재형)을 각자 새 id로 다시 정의해도
// 괜찮다(아래 MIDDLE_GRAMMAR_POINTS의 G7이 LOWER의 G2와 겹치는 개념이지만 별개 id인
// 이유). 다음은 고학년.
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
  { id: "G5", label: "조동사 should (제안·규칙)" },
  { id: "G6", label: "과거형 (규칙 -ed · went/had 등)" },
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
      hint: "I bring ___.",
      sample: ["I bring my backpack and my pencil case.", "I bring my water bottle."],
    },
    {
      id: "one-thing-in-your-classroom",
      text: "Can you tell me one thing in your classroom?",
      ko: "교실에 있는 것 하나만 말해줄래요?",
      grammar: "G4",
      level: "intermediate",
      type: "produce",
      hint: "There is ___.",
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
      hint: "I like/don't like school because ___.",
      sample: ["I like school because it's fun.", "I don't like school because I wake up early."],
    },
    {
      id: "whats-in-your-pencil-case",
      text: "What is in your pencil case?",
      ko: "필통 안에 뭐가 있어요?",
      grammar: "G4",
      level: "advanced",
      type: "produce",
      hint: "There are ___. / I have ___.",
      sample: ["There are pencils and an eraser.", "I have two pencils."],
    },
  ],
};

const CLASSROOM_CHAPTER = {
  id: "classroom",
  title: "교실에서",
  emoji: "🏫",
  sentences: [
    { id: "wheres-my-seat", text: "Where is my seat?", ko: "제 자리가 어디예요?", grammar: "G1" },
    { id: "this-is-my-desk", text: "This is my desk.", ko: "이건 제 책상이에요.", grammar: "G1" },
    { id: "i-raise-my-hand", text: "I raise my hand.", ko: "저는 손을 들어요.", grammar: "G2" },
    { id: "teacher-is-kind", text: "My teacher is kind.", ko: "우리 선생님은 친절해요.", grammar: "G1" },
    { id: "i-listen-to-the-teacher", text: "I listen to the teacher.", ko: "저는 선생님 말씀을 들어요.", grammar: "G2" },
    { id: "my-desk-is-messy", text: "My desk is messy.", ko: "제 책상은 지저분해요.", grammar: "G1" },
    { id: "i-open-my-book", text: "I open my book.", ko: "저는 책을 펴요.", grammar: "G2" },
    { id: "classroom-is-quiet", text: "The classroom is quiet.", ko: "교실이 조용해요.", grammar: "G1" },
    { id: "i-write-my-name", text: "I write my name.", ko: "저는 제 이름을 써요.", grammar: "G2" },
    { id: "this-is-my-pencil", text: "This is my pencil.", ko: "이건 제 연필이에요.", grammar: "G1" },

    { id: "can-i-go-to-the-bathroom", text: "Can I go to the bathroom?", ko: "화장실 가도 돼요?", grammar: "G3", level: "intermediate" },
    { id: "can-you-repeat-that", text: "Can you repeat that, please?", ko: "다시 한번 말해줄 수 있어요?", grammar: "G3", level: "intermediate" },
    { id: "should-i-raise-my-hand", text: "Should I raise my hand first?", ko: "먼저 손을 들어야 해요?", grammar: "G5", level: "intermediate" },
    { id: "should-be-quiet-in-library", text: "You should be quiet in the library.", ko: "도서관에서는 조용히 해야 해요.", grammar: "G5", level: "intermediate" },
    {
      id: "what-should-we-do-before-class",
      text: "What should we do before class starts?",
      ko: "수업 시작 전에 뭘 해야 할까요?",
      grammar: "G5",
      level: "intermediate",
      type: "produce",
      hint: "We should ___.",
      sample: ["We should sit down.", "We should be quiet."],
    },
    {
      id: "tell-me-about-your-teacher",
      text: "Can you tell me something about your teacher?",
      ko: "선생님에 대해 뭐든 말해줄래요?",
      grammar: "G1",
      level: "intermediate",
      type: "produce",
      hint: "My teacher is ___.",
      sample: ["My teacher is kind.", "My teacher is funny."],
    },

    { id: "shouldnt-talk-during-class", text: "I shouldn't talk during class.", ko: "수업 중엔 말하면 안 돼요.", grammar: "G5", level: "advanced" },
    { id: "can-help-my-classmate", text: "I can help my classmate if they need it.", ko: "짝이 필요하면 도와줄 수 있어요.", grammar: "G3", level: "advanced" },
    {
      id: "why-should-we-listen-to-the-teacher",
      text: "Why should we listen to the teacher?",
      ko: "왜 선생님 말씀을 들어야 할까요?",
      grammar: "G5",
      level: "advanced",
      type: "produce",
      hint: "We should listen because ___.",
      sample: ["We should listen because we learn a lot.", "Because it's polite."],
    },
    {
      id: "one-classroom-rule-you-follow",
      text: "What's one classroom rule you follow?",
      ko: "지키고 있는 교실 규칙 하나만 말해줄래요?",
      grammar: "G5",
      level: "advanced",
      type: "produce",
      hint: "I should ___.",
      sample: ["I should raise my hand.", "I shouldn't run in the classroom."],
    },
  ],
};

const RECESS_CHAPTER = {
  id: "recess",
  title: "쉬는 시간",
  emoji: "⏰",
  sentences: [
    { id: "its-recess-time", text: "It's recess time!", ko: "쉬는 시간이에요!", grammar: "G1" },
    { id: "i-go-outside", text: "I go outside.", ko: "저는 밖에 나가요.", grammar: "G2" },
    { id: "playground-is-fun", text: "The playground is fun.", ko: "운동장이 재밌어요.", grammar: "G1" },
    { id: "i-play-with-my-friends", text: "I play with my friends.", ko: "저는 친구들이랑 놀아요.", grammar: "G2" },
    { id: "i-drink-water", text: "I drink water.", ko: "저는 물을 마셔요.", grammar: "G2" },
    { id: "the-line-is-long", text: "The line is long.", ko: "줄이 길어요.", grammar: "G1" },
    { id: "i-wait-in-line", text: "I wait in line.", ko: "저는 줄을 서서 기다려요.", grammar: "G2" },
    { id: "my-friend-is-fast", text: "My friend is fast.", ko: "제 친구는 빨라요.", grammar: "G1" },
    { id: "i-share-my-snack", text: "I share my snack.", ko: "저는 간식을 나눠줘요.", grammar: "G2" },
    { id: "recess-is-short", text: "Recess is short.", ko: "쉬는 시간은 짧아요.", grammar: "G1" },

    { id: "can-i-play-with-you", text: "Can I play with you?", ko: "저도 같이 놀아도 돼요?", grammar: "G3", level: "intermediate" },
    { id: "we-played-tag-yesterday", text: "We played tag yesterday.", ko: "어제 우리 술래잡기 했어요.", grammar: "G6", level: "intermediate" },
    { id: "i-went-to-the-playground", text: "I went to the playground.", ko: "저는 운동장에 갔어요.", grammar: "G6", level: "intermediate" },
    { id: "should-we-line-up-now", text: "Should we line up now?", ko: "지금 줄 서야 해요?", grammar: "G5", level: "intermediate" },
    {
      id: "what-did-you-play-at-recess",
      text: "What did you play at recess yesterday?",
      ko: "어제 쉬는 시간에 뭐 하고 놀았어요?",
      grammar: "G6",
      level: "intermediate",
      type: "produce",
      hint: "I played ___.",
      sample: ["I played tag.", "I played soccer."],
    },
    {
      id: "can-i-join-your-game",
      text: "Can I join your game?",
      ko: "게임에 껴도 돼요?",
      grammar: "G3",
      level: "intermediate",
      type: "produce",
      hint: "Can I ___?",
      sample: ["Can I join?", "Can I play too?"],
    },

    { id: "had-so-much-fun-at-recess", text: "We had so much fun at recess yesterday.", ko: "어제 쉬는 시간에 정말 재밌었어요.", grammar: "G6", level: "advanced" },
    { id: "shouldnt-run-in-the-hallway", text: "I shouldn't run in the hallway.", ko: "복도에서는 뛰면 안 돼요.", grammar: "G5", level: "advanced" },
    {
      id: "favorite-thing-to-do-at-recess",
      text: "What's your favorite thing to do at recess?",
      ko: "쉬는 시간에 제일 하고 싶은 게 뭐예요?",
      grammar: "G2",
      level: "advanced",
      type: "produce",
      hint: "My favorite thing is ___.",
      sample: ["My favorite thing is playing tag.", "I like playing on the swings."],
    },
    {
      id: "tell-me-about-a-fun-recess",
      text: "Tell me about a fun recess you had.",
      ko: "재밌었던 쉬는 시간 얘기해줄래요?",
      grammar: "G6",
      level: "advanced",
      type: "produce",
      hint: "I ___ and it was fun.",
      sample: ["I played soccer and it was fun.", "I went on the slide and it was fun."],
    },
  ],
};

// 좋아하는 것 챕터는 새 문법을 도입하지 않는다 — G1~G6를 다른 소재(취미·과목)로 다시
// 섞어 쓰기만 한다. 반복(recycling)이 "새 챕터마다 무조건 새 문법 하나씩"이 아니라는
// 걸 보여주는 사례로 일부러 남겨뒀다.
const FAVORITES_CHAPTER = {
  id: "favorites",
  title: "좋아하는 것",
  emoji: "⭐",
  sentences: [
    { id: "i-like-math", text: "I like math.", ko: "저는 수학을 좋아해요.", grammar: "G2" },
    { id: "favorite-subject-is-art", text: "My favorite subject is art.", ko: "제가 제일 좋아하는 과목은 미술이에요.", grammar: "G1" },
    { id: "i-like-reading-books", text: "I like reading books.", ko: "저는 책 읽기를 좋아해요.", grammar: "G2" },
    { id: "i-dont-like-homework", text: "I don't like homework.", ko: "저는 숙제가 싫어요.", grammar: "G2" },
    { id: "music-class-is-fun", text: "Music class is fun.", ko: "음악 시간은 재밌어요.", grammar: "G1" },
    { id: "i-play-the-piano", text: "I play the piano.", ko: "저는 피아노를 쳐요.", grammar: "G2" },
    { id: "i-like-drawing-animals", text: "I like drawing animals.", ko: "저는 동물 그리기를 좋아해요.", grammar: "G2" },
    { id: "favorite-color-is-purple", text: "My favorite color is purple.", ko: "제가 제일 좋아하는 색은 보라색이에요.", grammar: "G1" },
    { id: "i-collect-stickers", text: "I collect stickers.", ko: "저는 스티커를 모아요.", grammar: "G2" },
    { id: "weekends-are-my-favorite", text: "Weekends are my favorite.", ko: "주말이 제일 좋아요.", grammar: "G1" },

    { id: "can-you-guess-my-favorite-subject", text: "Can you guess my favorite subject?", ko: "제가 제일 좋아하는 과목 맞혀볼래요?", grammar: "G3", level: "intermediate" },
    { id: "went-to-a-piano-lesson-yesterday", text: "I went to a piano lesson yesterday.", ko: "어제 피아노 레슨 갔어요.", grammar: "G6", level: "intermediate" },
    { id: "we-should-try-new-hobbies", text: "We should try new hobbies.", ko: "우리 새로운 취미를 시도해봐야 해요.", grammar: "G5", level: "intermediate" },
    { id: "watched-a-movie-last-weekend", text: "I watched a movie last weekend.", ko: "지난 주말에 영화를 봤어요.", grammar: "G6", level: "intermediate" },
    {
      id: "favorite-subject-and-why",
      text: "What's your favorite subject and why?",
      ko: "제일 좋아하는 과목이 뭐고 왜 좋아해요?",
      grammar: "G2",
      level: "intermediate",
      type: "produce",
      hint: "My favorite subject is ___ because ___.",
      sample: ["My favorite subject is art because I like drawing.", "My favorite subject is math because it's fun."],
    },
    {
      id: "what-did-you-do-last-weekend",
      text: "What did you do last weekend?",
      ko: "지난 주말에 뭐 했어요?",
      grammar: "G6",
      level: "intermediate",
      type: "produce",
      hint: "I ___.",
      sample: ["I played with my friends.", "I watched a movie."],
    },

    { id: "play-piano-because-i-like-music", text: "I play the piano because I like music.", ko: "음악을 좋아해서 피아노를 쳐요.", grammar: "G2", level: "advanced" },
    { id: "shouldnt-spend-too-much-time-on-games", text: "I shouldn't spend too much time on games.", ko: "게임을 너무 오래 하면 안 돼요.", grammar: "G5", level: "advanced" },
    {
      id: "why-do-you-like-your-hobby",
      text: "Why do you like your hobby?",
      ko: "왜 그 취미를 좋아해요?",
      grammar: "G2",
      level: "advanced",
      type: "produce",
      hint: "I like it because ___.",
      sample: ["I like it because it's fun.", "I like it because I'm good at it."],
    },
    {
      id: "what-new-hobby-do-you-want-to-try",
      text: "What new hobby do you want to try?",
      ko: "어떤 새로운 취미를 해보고 싶어요?",
      grammar: "G2",
      level: "advanced",
      type: "produce",
      hint: "I want to try ___.",
      sample: ["I want to try swimming.", "I want to try painting."],
    },
  ],
};

// 중학년 문법 순서. LOWER_GRAMMAR_POINTS와 별개 배열이라 id가 겹쳐도 실제로는 충돌하지
// 않지만(각 학년의 grammarPoints 안에서만 유효), 헷갈리지 않게 저학년 이어서 G7부터
// 붙였다. G7이 저학년 G2(일반동사 현재형)와 개념은 겹치는데, 그건 의도된 것이다 —
// 중학년 시작 시점에도 기본 현재형 문장이 여전히 나오기 때문에, 저학년 문법을 그대로
// 참조하지 않고 이 학년 안에서 다시 정의했다(학년 트랙이 독립적이어야 한다는 게 D-75의
// 전제).
export const MIDDLE_GRAMMAR_POINTS = [
  { id: "G7", label: "현재형 문장 복습 (be동사·일반동사)" },
  { id: "G8", label: "조동사 have to / must (의무)" },
  { id: "G9", label: "미래형 (will / be going to)" },
  { id: "G10", label: "비교급 (-er, more than)" },
  { id: "G11", label: "현재진행형 (be + -ing)" },
];

const SCHOOLWORK_CHAPTER = {
  id: "schoolwork",
  title: "수업과 과제",
  emoji: "📚",
  sentences: [
    { id: "lots-of-homework-today", text: "I have a lot of homework today.", ko: "오늘 숙제가 많아요.", grammar: "G7" },
    { id: "test-is-tomorrow", text: "The test is tomorrow.", ko: "시험이 내일이에요.", grammar: "G7" },
    { id: "i-study-every-day", text: "I study every day.", ko: "저는 매일 공부해요.", grammar: "G7" },
    { id: "group-has-four-people", text: "My group has four people.", ko: "우리 모둠은 네 명이에요.", grammar: "G7" },
    { id: "i-need-more-time", text: "I need more time.", ko: "시간이 더 필요해요.", grammar: "G7" },
    { id: "project-is-difficult", text: "The project is difficult.", ko: "이 프로젝트는 어려워요.", grammar: "G7" },
    { id: "i-check-my-answers", text: "I check my answers.", ko: "저는 답을 확인해요.", grammar: "G7" },
    { id: "we-work-together", text: "We work together.", ko: "우리는 같이 작업해요.", grammar: "G7" },
    { id: "presentation-is-next-week", text: "The presentation is next week.", ko: "발표가 다음 주예요.", grammar: "G7" },
    { id: "i-take-notes-in-class", text: "I take notes in class.", ko: "저는 수업 중에 필기해요.", grammar: "G7" },

    { id: "have-to-finish-homework-tonight", text: "I have to finish my homework tonight.", ko: "오늘 밤까지 숙제를 끝내야 해요.", grammar: "G8", level: "intermediate" },
    { id: "must-work-quietly", text: "We must work quietly during the test.", ko: "시험 중에는 조용히 해야 해요.", grammar: "G8", level: "intermediate" },
    { id: "do-i-have-to-do-this-alone", text: "Do I have to do this alone?", ko: "이거 혼자 해야 해요?", grammar: "G8", level: "intermediate" },
    { id: "group-has-to-present-first", text: "My group has to present first.", ko: "우리 모둠이 먼저 발표해야 해요.", grammar: "G8", level: "intermediate" },
    {
      id: "what-do-you-have-to-do-before-the-test",
      text: "What do you have to do before the test?",
      ko: "시험 전에 뭘 해야 해요?",
      grammar: "G8",
      level: "intermediate",
      type: "produce",
      hint: "I have to ___.",
      sample: ["I have to study.", "I have to review my notes."],
    },
    {
      id: "whats-your-project-about",
      text: "What's your project about?",
      ko: "프로젝트가 뭐에 관한 거예요?",
      grammar: "G7",
      level: "intermediate",
      type: "produce",
      hint: "My project is about ___.",
      sample: ["My project is about animals.", "My project is about space."],
    },

    { id: "practice-more-because-nervous", text: "I have to practice more because I'm nervous.", ko: "긴장돼서 더 연습해야 해요.", grammar: "G8", level: "advanced" },
    { id: "everyone-in-group-has-to-help", text: "Everyone in my group has to help.", ko: "우리 모둠 사람들 다 도와야 해요.", grammar: "G8", level: "advanced" },
    {
      id: "why-do-you-have-to-study-so-much",
      text: "Why do you have to study so much this week?",
      ko: "이번 주에 왜 이렇게 공부를 많이 해야 해요?",
      grammar: "G8",
      level: "advanced",
      type: "produce",
      hint: "I have to study because ___.",
      sample: ["I have to study because I have a big test.", "Because I want to do well."],
    },
    {
      id: "hardest-part-of-your-project",
      text: "What was the hardest part of your project?",
      ko: "프로젝트에서 제일 어려웠던 부분이 뭐예요?",
      grammar: "G7",
      level: "advanced",
      type: "produce",
      hint: "The hardest part was ___.",
      sample: ["The hardest part was finding information.", "The hardest part was the presentation."],
    },
  ],
};

const FRIENDSHIP_CHAPTER = {
  id: "friendship",
  title: "친구 관계",
  emoji: "🤝",
  sentences: [
    { id: "have-two-close-friends", text: "I have two close friends.", ko: "저는 친한 친구가 두 명 있어요.", grammar: "G7" },
    { id: "eat-lunch-together", text: "We eat lunch together.", ko: "우리는 같이 점심을 먹어요.", grammar: "G7" },
    { id: "friend-is-funny", text: "My friend is funny.", ko: "제 친구는 웃겨요.", grammar: "G7" },
    { id: "sit-next-to-each-other", text: "We sit next to each other.", ko: "우리는 서로 옆에 앉아요.", grammar: "G7" },
    { id: "i-trust-my-friends", text: "I trust my friends.", ko: "저는 친구들을 믿어요.", grammar: "G7" },
    { id: "we-help-each-other", text: "We help each other.", ko: "우리는 서로 도와줘요.", grammar: "G7" },
    { id: "best-friend-lives-near-me", text: "My best friend lives near me.", ko: "제일 친한 친구가 저희 집 근처에 살아요.", grammar: "G7" },
    { id: "i-invite-my-friends-over", text: "I invite my friends over.", ko: "저는 친구들을 초대해요.", grammar: "G7" },
    { id: "we-share-secrets", text: "We share secrets.", ko: "우리는 비밀을 나눠요.", grammar: "G7" },
    { id: "friends-support-me", text: "My friends support me.", ko: "제 친구들이 저를 응원해줘요.", grammar: "G7" },

    { id: "will-invite-her-to-my-birthday", text: "I will invite her to my birthday party.", ko: "걔를 제 생일 파티에 초대할 거예요.", grammar: "G9", level: "intermediate" },
    { id: "going-to-hang-out-this-weekend", text: "We are going to hang out this weekend.", ko: "우리 이번 주말에 놀 거예요.", grammar: "G9", level: "intermediate" },
    { id: "have-to-say-sorry-first", text: "I have to say sorry first.", ko: "제가 먼저 사과해야 해요.", grammar: "G8", level: "intermediate" },
    { id: "will-you-still-be-my-friend", text: "Will you still be my friend?", ko: "그래도 계속 제 친구 할 거예요?", grammar: "G9", level: "intermediate" },
    {
      id: "what-will-you-do-to-make-up",
      text: "What will you do to make up with a friend?",
      ko: "친구랑 화해하려면 뭘 할 거예요?",
      grammar: "G9",
      level: "intermediate",
      type: "produce",
      hint: "I will ___.",
      sample: ["I will say sorry.", "I will give them a gift."],
    },
    {
      id: "what-do-you-have-to-do-to-be-a-good-friend",
      text: "What do you have to do to be a good friend?",
      ko: "좋은 친구가 되려면 뭘 해야 해요?",
      grammar: "G8",
      level: "intermediate",
      type: "produce",
      hint: "You have to ___.",
      sample: ["You have to listen.", "You have to be kind."],
    },

    { id: "will-apologize-because-i-was-wrong", text: "I will apologize because I was wrong.", ko: "제가 잘못해서 사과할 거예요.", grammar: "G9", level: "advanced" },
    { id: "friends-have-to-trust-each-other", text: "Friends have to trust each other.", ko: "친구는 서로 믿어야 해요.", grammar: "G8", level: "advanced" },
    {
      id: "what-will-you-do-if-you-fight",
      text: "What will you do if you have a fight with a friend?",
      ko: "친구랑 싸우면 뭘 할 거예요?",
      grammar: "G9",
      level: "advanced",
      type: "produce",
      hint: "I will ___.",
      sample: ["I will talk to them.", "I will give us both some time."],
    },
    {
      id: "why-are-friends-important-to-you",
      text: "Why are friends important to you?",
      ko: "친구가 왜 중요해요?",
      grammar: "G7",
      level: "advanced",
      type: "produce",
      hint: "Friends are important because ___.",
      sample: ["Friends are important because they support me.", "Because I have fun with them."],
    },
  ],
};

const AFTER_SCHOOL_CHAPTER = {
  id: "after-school",
  title: "방과 후 생활",
  emoji: "🎨",
  sentences: [
    { id: "go-to-a-math-academy", text: "I go to a math academy after school.", ko: "저는 방과 후에 수학 학원에 가요.", grammar: "G7" },
    { id: "do-my-homework-first", text: "I do my homework first.", ko: "저는 숙제부터 해요.", grammar: "G7" },
    { id: "i-practice-taekwondo", text: "I practice taekwondo.", ko: "저는 태권도를 연습해요.", grammar: "G7" },
    { id: "watch-videos-online", text: "I watch videos online.", ko: "저는 온라인 영상을 봐요.", grammar: "G7" },
    { id: "my-schedule-is-busy", text: "My schedule is busy.", ko: "제 일정은 바빠요.", grammar: "G7" },
    { id: "i-take-a-break-first", text: "I take a break first.", ko: "저는 먼저 쉬어요.", grammar: "G7" },
    { id: "i-play-video-games", text: "I play video games.", ko: "저는 비디오 게임을 해요.", grammar: "G7" },
    { id: "i-read-comic-books", text: "I read comic books.", ko: "저는 만화책을 읽어요.", grammar: "G7" },
    { id: "i-practice-the-violin", text: "I practice the violin.", ko: "저는 바이올린을 연습해요.", grammar: "G7" },
    { id: "free-time-on-fridays", text: "I have free time on Fridays.", ko: "저는 금요일에 자유 시간이 있어요.", grammar: "G7" },

    { id: "doing-homework-right-now", text: "I am doing my homework right now.", ko: "저 지금 숙제하고 있어요.", grammar: "G11", level: "intermediate" },
    { id: "like-taekwondo-more-than-piano", text: "I like taekwondo more than piano.", ko: "저는 피아노보다 태권도가 더 좋아요.", grammar: "G10", level: "intermediate" },
    { id: "games-are-more-fun-than-homework", text: "Games are more fun than homework.", ko: "게임이 숙제보다 더 재밌어요.", grammar: "G10", level: "intermediate" },
    { id: "watching-a-video-now", text: "I am watching a video now.", ko: "저 지금 영상 보고 있어요.", grammar: "G11", level: "intermediate" },
    {
      id: "what-are-you-doing-right-now",
      text: "What are you doing right now?",
      ko: "지금 뭐 하고 있어요?",
      grammar: "G11",
      level: "intermediate",
      type: "produce",
      hint: "I am ___ing.",
      sample: ["I am doing my homework.", "I am reading a book."],
    },
    {
      id: "which-do-you-like-more-games-or-reading",
      text: "Which do you like more, video games or reading?",
      ko: "비디오 게임이랑 독서 중에 뭐가 더 좋아요?",
      grammar: "G10",
      level: "intermediate",
      type: "produce",
      hint: "I like ___ more than ___.",
      sample: ["I like video games more than reading.", "I like reading more than video games."],
    },

    { id: "finish-homework-before-games", text: "I have to finish my homework before I play games.", ko: "게임하기 전에 숙제를 끝내야 해요.", grammar: "G8", level: "advanced" },
    { id: "practice-more-to-improve", text: "I will practice more because I want to improve.", ko: "더 잘하고 싶어서 더 연습할 거예요.", grammar: "G9", level: "advanced" },
    {
      id: "what-are-you-going-to-do-after-school",
      text: "What are you going to do after school today?",
      ko: "오늘 방과 후에 뭐 할 거예요?",
      grammar: "G9",
      level: "advanced",
      type: "produce",
      hint: "I am going to ___.",
      sample: ["I am going to go to my academy.", "I am going to play with my friends."],
    },
    {
      id: "screen-time-or-hobbies-more-important",
      text: "Do you think screen time or hobbies are more important?",
      ko: "스크린 타임이랑 취미 중에 뭐가 더 중요한 것 같아요?",
      grammar: "G10",
      level: "advanced",
      type: "produce",
      hint: "I think ___ is more important.",
      sample: ["I think hobbies are more important.", "I think screen time is fine in small amounts."],
    },
  ],
};

// 우리 동네 챕터도 좋아하는 것(저학년)과 같은 이유로 새 문법을 도입하지 않는다 — G7~G11을
// 새 소재(동네·심부름)로 재사용만 한다.
const NEIGHBORHOOD_CHAPTER = {
  id: "neighborhood",
  title: "우리 동네",
  emoji: "🏘️",
  sentences: [
    { id: "house-is-near-the-park", text: "My house is near the park.", ko: "저희 집은 공원 근처예요.", grammar: "G7" },
    { id: "i-walk-to-the-store", text: "I walk to the store.", ko: "저는 가게까지 걸어가요.", grammar: "G7" },
    { id: "bus-stop-is-close", text: "The bus stop is close.", ko: "버스 정류장이 가까워요.", grammar: "G7" },
    { id: "buy-snacks-at-the-store", text: "I buy snacks at the store.", ko: "저는 가게에서 간식을 사요.", grammar: "G7" },
    { id: "neighborhood-is-quiet", text: "My neighborhood is quiet.", ko: "저희 동네는 조용해요.", grammar: "G7" },
    { id: "i-know-my-neighbors", text: "I know my neighbors.", ko: "저는 이웃들을 알아요.", grammar: "G7" },
    { id: "library-is-nearby", text: "The library is nearby.", ko: "도서관이 근처에 있어요.", grammar: "G7" },
    { id: "run-errands-for-my-mom", text: "I run errands for my mom.", ko: "저는 엄마 심부름을 해요.", grammar: "G7" },
    { id: "take-the-bus-to-school", text: "I take the bus to school.", ko: "저는 버스 타고 학교에 가요.", grammar: "G7" },
    { id: "market-is-busy-on-weekends", text: "The market is busy on weekends.", ko: "시장은 주말에 붐벼요.", grammar: "G7" },

    { id: "have-to-buy-milk-for-mom", text: "I have to buy milk for my mom.", ko: "엄마를 위해 우유를 사야 해요.", grammar: "G8", level: "intermediate" },
    { id: "will-take-the-bus-tomorrow", text: "I will take the bus tomorrow.", ko: "내일 버스 탈 거예요.", grammar: "G9", level: "intermediate" },
    { id: "new-store-is-bigger-than-old", text: "The new store is bigger than the old one.", ko: "새 가게가 옛날 가게보다 더 커요.", grammar: "G10", level: "intermediate" },
    { id: "walking-to-the-store-now", text: "I am walking to the store now.", ko: "지금 가게로 걸어가고 있어요.", grammar: "G11", level: "intermediate" },
    {
      id: "what-do-you-have-to-do-for-family",
      text: "What do you have to do for your family this week?",
      ko: "이번 주에 가족을 위해 뭘 해야 해요?",
      grammar: "G8",
      level: "intermediate",
      type: "produce",
      hint: "I have to ___.",
      sample: ["I have to buy groceries.", "I have to walk the dog."],
    },
    {
      id: "what-will-you-buy-at-the-store",
      text: "What will you buy at the store?",
      ko: "가게에서 뭘 살 거예요?",
      grammar: "G9",
      level: "intermediate",
      type: "produce",
      hint: "I will buy ___.",
      sample: ["I will buy some snacks.", "I will buy milk and bread."],
    },

    { id: "take-the-bus-because-faster", text: "I take the bus because it's faster than walking.", ko: "걷는 것보다 빨라서 버스를 타요.", grammar: "G10", level: "advanced" },
    { id: "running-an-errand-because-mom-asked", text: "I am running an errand because my mom asked me to.", ko: "엄마가 부탁해서 심부름하고 있어요.", grammar: "G11", level: "advanced" },
    {
      id: "what-do-you-like-about-your-neighborhood",
      text: "What do you like about your neighborhood?",
      ko: "우리 동네에서 뭐가 좋아요?",
      grammar: "G7",
      level: "advanced",
      type: "produce",
      hint: "I like that ___.",
      sample: ["I like that it's quiet.", "I like that the park is close."],
    },
    {
      id: "what-do-you-want-in-your-neighborhood",
      text: "What do you want in your neighborhood?",
      ko: "동네에 뭐가 있으면 좋겠어요?",
      grammar: "G7",
      level: "advanced",
      type: "produce",
      hint: "I want ___.",
      sample: ["I want a new park.", "I want a bigger library."],
    },
  ],
};

// 학년 트랙 — 실제로 만든 학년만 넣는다(위 헤더 설명 참고). 고학년은 그 학년의
// GRAMMAR_POINTS·챕터가 준비되면 여기 항목을 추가한다(레지스트리를 새로 만들 필요
// 없음 — index.js가 GRADES를 순회해 화면을 자동 생성한다).
export const GRADES = [
  {
    id: "lower",
    label: "저학년 (1~2학년)",
    emoji: "🎒",
    grammarPoints: LOWER_GRAMMAR_POINTS,
    chapters: [SCHOOL_DAY_CHAPTER, CLASSROOM_CHAPTER, RECESS_CHAPTER, FAVORITES_CHAPTER],
  },
  {
    id: "middle",
    label: "중학년 (3~4학년)",
    emoji: "📖",
    grammarPoints: MIDDLE_GRAMMAR_POINTS,
    chapters: [SCHOOLWORK_CHAPTER, FRIENDSHIP_CHAPTER, AFTER_SCHOOL_CHAPTER, NEIGHBORHOOD_CHAPTER],
  },
];
