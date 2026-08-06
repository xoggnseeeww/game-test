// "초등 영어회화" 도구의 목차. `기초 영어회화`(7세 이하, basic-conversation)의 다음 단계 —
// 사용자 지적(D-78): "7세 이하는 반복이면 되지만 초등학교부터는 실질적 회화 및 언어 향상이
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
// 저장소 관례: 빈 기능을 화면에 먼저 노출하지 않는다). 지금은 저학년 챕터 5개(학교 가는
// 날·교실에서·쉬는 시간·좋아하는 것·체육 시간), 중학년 챕터 5개(수업과 과제·친구 관계·
// 방과 후 생활·우리 동네·학교 행사), 고학년 챕터 5개(의견 나누기·꿈과 진로·요즘 이슈·
// 여행과 경험·협동과 리더십)까지 만들었다(D-80~D-83) — 챕터마다 문장 개수는 기본 10·
// 중급 6·심화 4(총 20개)로, 기초 영어회화의 최종 목표(단계별 30개)보다 적게 시작한다.
// 메커니즘(문법 태그·반복·produce)이 저학년 챕터 하나(학교 가는 날)에서 실제로 동작하는
// 걸 먼저 확인한 뒤(D-78, D-79) 같은 틀로 나머지를 채웠다 — 문법은 챕터마다 하나씩 안
// 늘린다(예: 좋아하는 것·우리 동네·여행과 경험·체육 시간 챕터는 새 문법 없이 기존
// 문법만 재사용). 학년마다 문법 목록(`*_GRAMMAR_POINTS`)이 따로 있고, id는 그 학년
// 배열 안에서만 유효하다 — 두 학년이 같은 개념(예: 일반동사 현재형)을 각자 새 id로
// 다시 정의해도 괜찮다(아래 MIDDLE_GRAMMAR_POINTS의 G7이 LOWER의 G2와 겹치는 개념이지만
// 별개 id인 이유). 새 문법 id는 학년과 무관하게 전체에서 이어 붙인다(G16은 MIDDLE에,
// G17은 HIGH에 있지만 번호는 지금까지 나온 것 중 가장 큰 다음 번호를 그대로 썼다) —
// 어느 학년이 먼저 새 챕터를 받을지 모르니, 학년별로 번호 구간을 미리 나눠두지 않는다.
// D-83(각 학년에 챕터 하나씩 더 추가) 이후에도 여전히 다중 턴 대화형 도구(§3-7)는
// 시작 안 했다 — 챕터를 계속 늘리는 이번 방향과는 별개로 남아 있는 다음 갈림길.
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

// 체육 시간도 좋아하는 것과 같은 이유로 새 문법을 도입하지 않는다 — G1~G6을 새 소재
// (운동·팀 경기)로 재사용만 한다(D-83).
const PE_CLASS_CHAPTER = {
  id: "pe-class",
  title: "체육 시간",
  emoji: "🏃",
  sentences: [
    { id: "time-for-pe", text: "It's time for PE.", ko: "체육 시간이에요.", grammar: "G1" },
    { id: "wear-my-gym-clothes", text: "I wear my gym clothes.", ko: "저는 체육복을 입어요.", grammar: "G2" },
    { id: "run-in-the-gym", text: "We run in the gym.", ko: "우리는 체육관에서 달려요.", grammar: "G2" },
    { id: "on-the-blue-team", text: "I am on the blue team.", ko: "저는 파란팀이에요.", grammar: "G1" },
    { id: "play-dodgeball", text: "We play dodgeball.", ko: "우리는 피구를 해요.", grammar: "G2" },
    { id: "ball-is-fast", text: "The ball is fast.", ko: "공이 빨라요.", grammar: "G1" },
    { id: "i-jump-rope", text: "I jump rope.", ko: "저는 줄넘기를 해요.", grammar: "G2" },
    { id: "stretch-before-we-start", text: "I stretch before we start.", ko: "저는 시작하기 전에 스트레칭해요.", grammar: "G2" },
    { id: "my-team-is-strong", text: "My team is strong.", ko: "우리 팀은 강해요.", grammar: "G1" },
    { id: "drink-water-after-pe", text: "I drink water after PE.", ko: "저는 체육 끝나고 물을 마셔요.", grammar: "G2" },

    { id: "can-i-be-team-captain", text: "Can I be the team captain?", ko: "제가 팀 주장 해도 돼요?", grammar: "G3", level: "intermediate" },
    { id: "should-warm-up-first", text: "We should warm up first.", ko: "먼저 준비운동을 해야 해요.", grammar: "G5", level: "intermediate" },
    { id: "played-soccer-last-pe-class", text: "We played soccer last PE class.", ko: "지난 체육 시간에 축구했어요.", grammar: "G6", level: "intermediate" },
    { id: "can-you-catch-the-ball", text: "Can you catch the ball?", ko: "공 잡을 수 있어요?", grammar: "G3", level: "intermediate" },
    {
      id: "what-game-did-you-play-yesterday",
      text: "What game did you play in PE yesterday?",
      ko: "어제 체육 시간에 무슨 게임 했어요?",
      grammar: "G6",
      level: "intermediate",
      type: "produce",
      hint: "We played ___.",
      sample: ["We played dodgeball.", "We played soccer."],
    },
    {
      id: "what-should-we-do-before-running",
      text: "What should we do before we start running?",
      ko: "달리기 전에 뭘 해야 해요?",
      grammar: "G5",
      level: "intermediate",
      type: "produce",
      hint: "We should ___.",
      sample: ["We should stretch.", "We should warm up."],
    },

    { id: "team-won-because-worked-together", text: "My team won because we worked together.", ko: "우리 팀이 함께 해서 이겼어요.", grammar: "G2", level: "advanced" },
    { id: "shouldnt-push-my-friends", text: "I shouldn't push my friends.", ko: "친구들을 밀면 안 돼요.", grammar: "G5", level: "advanced" },
    {
      id: "why-do-you-like-pe",
      text: "Why do you like or not like PE?",
      ko: "체육 시간이 왜 좋아요, 아니면 왜 싫어요?",
      grammar: "G2",
      level: "advanced",
      type: "produce",
      hint: "I like/don't like PE because ___.",
      sample: ["I like PE because I can run.", "I don't like PE because I'm not fast."],
    },
    {
      id: "tell-me-about-winning-or-losing",
      text: "Tell me about a time you won or lost a game.",
      ko: "게임에서 이기거나 졌던 얘기 해줄래요?",
      grammar: "G6",
      level: "advanced",
      type: "produce",
      hint: "I ___ and it was fun.",
      sample: ["We won and it was fun.", "We lost, but it was still fun."],
    },
  ],
};

// 중학년 문법 순서. LOWER_GRAMMAR_POINTS와 별개 배열이라 id가 겹쳐도 실제로는 충돌하지
// 않지만(각 학년의 grammarPoints 안에서만 유효), 헷갈리지 않게 저학년 이어서 G7부터
// 붙였다. G7이 저학년 G2(일반동사 현재형)와 개념은 겹치는데, 그건 의도된 것이다 —
// 중학년 시작 시점에도 기본 현재형 문장이 여전히 나오기 때문에, 저학년 문법을 그대로
// 참조하지 않고 이 학년 안에서 다시 정의했다(학년 트랙이 독립적이어야 한다는 게 D-78의
// 전제).
export const MIDDLE_GRAMMAR_POINTS = [
  { id: "G7", label: "현재형 문장 복습 (be동사·일반동사)" },
  { id: "G8", label: "조동사 have to / must (의무)" },
  { id: "G9", label: "미래형 (will / be going to)" },
  { id: "G10", label: "비교급 (-er, more than)" },
  { id: "G11", label: "현재진행형 (be + -ing)" },
  { id: "G16", label: "과거진행형 (was/were + -ing)" },
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

const SCHOOL_EVENTS_CHAPTER = {
  id: "school-events",
  title: "학교 행사",
  emoji: "🎉",
  sentences: [
    { id: "today-is-field-trip-day", text: "Today is field trip day.", ko: "오늘은 소풍 가는 날이에요.", grammar: "G7" },
    { id: "go-to-the-museum", text: "We go to the museum.", ko: "우리는 박물관에 가요.", grammar: "G7" },
    { id: "sports-day-is-fun", text: "Sports day is fun.", ko: "운동회는 재밌어요.", grammar: "G7" },
    { id: "join-the-relay-race", text: "I join the relay race.", ko: "저는 이어달리기에 참가해요.", grammar: "G7" },
    { id: "festival-is-next-month", text: "The festival is next month.", ko: "축제가 다음 달이에요.", grammar: "G7" },
    { id: "make-a-poster-for-event", text: "We make a poster for the event.", ko: "우리는 행사 포스터를 만들어요.", grammar: "G7" },
    { id: "bring-a-lunch-box", text: "I bring a lunch box.", ko: "저는 도시락을 가져가요.", grammar: "G7" },
    { id: "whole-school-joins-event", text: "The whole school joins the event.", ko: "학교 전체가 행사에 참여해요.", grammar: "G7" },
    { id: "take-a-bus-to-the-museum", text: "We take a bus to the museum.", ko: "우리는 박물관까지 버스를 타요.", grammar: "G7" },
    { id: "excited-for-the-trip", text: "I am excited for the trip.", ko: "저는 소풍이 기대돼요.", grammar: "G7" },

    { id: "was-watching-the-race-when-rain", text: "I was watching the race when it started to rain.", ko: "경주를 보고 있는데 비가 오기 시작했어요.", grammar: "G16", level: "intermediate" },
    { id: "were-making-posters-all-afternoon", text: "We were making posters all afternoon.", ko: "우리는 오후 내내 포스터를 만들고 있었어요.", grammar: "G16", level: "intermediate" },
    { id: "have-to-practice-for-relay-race", text: "I have to practice for the relay race.", ko: "이어달리기 연습해야 해요.", grammar: "G8", level: "intermediate" },
    { id: "will-have-a-party-after-festival", text: "We will have a party after the festival.", ko: "축제 끝나고 파티할 거예요.", grammar: "G9", level: "intermediate" },
    {
      id: "what-were-you-doing-when-event-started",
      text: "What were you doing when the event started?",
      ko: "행사가 시작했을 때 뭐 하고 있었어요?",
      grammar: "G16",
      level: "intermediate",
      type: "produce",
      hint: "I was ___ing.",
      sample: ["I was talking to my friend.", "I was eating lunch."],
    },
    {
      id: "what-will-you-do-at-the-festival",
      text: "What will you do at the school festival?",
      ko: "학교 축제에서 뭐 할 거예요?",
      grammar: "G9",
      level: "intermediate",
      type: "produce",
      hint: "I will ___.",
      sample: ["I will sing on stage.", "I will visit the food booths."],
    },

    { id: "nervous-because-running-first", text: "I was so nervous because I was running first.", ko: "제가 먼저 뛰어서 정말 긴장됐어요.", grammar: "G16", level: "advanced" },
    { id: "everyone-has-to-wear-same-color", text: "Everyone has to wear the same color shirt.", ko: "다 같은 색 티셔츠를 입어야 해요.", grammar: "G8", level: "advanced" },
    {
      id: "what-was-happening-during-favorite-event",
      text: "What was happening during your favorite school event?",
      ko: "제일 좋아하는 학교 행사에서 무슨 일이 있었어요?",
      grammar: "G16",
      level: "advanced",
      type: "produce",
      hint: "I was ___ing when ___.",
      sample: ["I was cheering when my team won.", "I was dancing when the music started."],
    },
    {
      id: "what-are-you-going-to-do-to-prepare",
      text: "What are you going to do to prepare for the next event?",
      ko: "다음 행사를 준비하려면 뭘 할 거예요?",
      grammar: "G9",
      level: "advanced",
      type: "produce",
      hint: "I am going to ___.",
      sample: ["I am going to practice more.", "I am going to help make decorations."],
    },
  ],
};

// 고학년 문법 순서. 저학년(G1~G6)·중학년(G7~G11, G16)과 별개 배열이라 번호만 이어 붙였다
// (같은 이유는 MIDDLE_GRAMMAR_POINTS 주석 참고). 중학년의 의무·미래·비교·진행형에서
// 한 단 더 나아가 의견·조건·관계절처럼 원어민 초등 고학년이 실제로 쓰는 복문 구조로
// 넘어간다.
export const HIGH_GRAMMAR_POINTS = [
  { id: "G12", label: "현재형 문장 복습 (고학년 소재)" },
  { id: "G13", label: "최상급 (the most, -est)" },
  { id: "G14", label: "조건문 (if + 현재형, will + 동사원형)" },
  { id: "G15", label: "관계대명사 who/that (사람·사물 설명)" },
  { id: "G17", label: "used to (과거 습관·상태 회상)" },
];

const OPINIONS_CHAPTER = {
  id: "opinions",
  title: "의견 나누기",
  emoji: "💬",
  sentences: [
    { id: "i-think-summer-is-nice", text: "I think summer is nice.", ko: "저는 여름이 좋은 것 같아요.", grammar: "G12" },
    { id: "i-agree-with-you", text: "I agree with you.", ko: "저도 그렇게 생각해요.", grammar: "G12" },
    { id: "i-disagree-a-little", text: "I disagree a little.", ko: "저는 조금 다르게 생각해요.", grammar: "G12" },
    { id: "everyone-has-different-opinions", text: "Everyone has different opinions.", ko: "사람마다 생각이 달라요.", grammar: "G12" },
    { id: "i-have-my-own-opinion", text: "I have my own opinion.", ko: "저는 제 생각이 있어요.", grammar: "G12" },
    { id: "sounds-like-a-good-idea", text: "That sounds like a good idea.", ko: "그거 좋은 생각 같아요.", grammar: "G12" },
    { id: "i-see-your-point", text: "I see your point.", ko: "무슨 말인지 알겠어요.", grammar: "G12" },
    { id: "lets-talk-about-it", text: "Let's talk about it.", ko: "그거에 대해 얘기해보자.", grammar: "G12" },
    { id: "changed-my-mind-about-it", text: "I changed my mind about it.", ko: "그거에 대한 제 생각이 바뀌었어요.", grammar: "G12" },
    { id: "okay-to-think-differently", text: "It's okay to think differently.", ko: "다르게 생각해도 괜찮아요.", grammar: "G12" },

    { id: "summer-is-the-best-season", text: "I think summer is the best season.", ko: "저는 여름이 제일 좋은 계절인 것 같아요.", grammar: "G13", level: "intermediate" },
    { id: "most-interesting-book", text: "This is the most interesting book I've read.", ko: "이게 제가 읽은 것 중에 제일 재밌는 책이에요.", grammar: "G13", level: "intermediate" },
    { id: "hardest-subject-for-me", text: "Math is the hardest subject for me.", ko: "저한테는 수학이 제일 어려운 과목이에요.", grammar: "G13", level: "intermediate" },
    { id: "what-do-you-think-about-this", text: "What do you think about this?", ko: "이거에 대해 어떻게 생각해요?", grammar: "G12", level: "intermediate" },
    {
      id: "best-movie-youve-ever-seen",
      text: "What's the best movie you've ever seen?",
      ko: "지금까지 본 것 중 제일 좋은 영화가 뭐예요?",
      grammar: "G13",
      level: "intermediate",
      type: "produce",
      hint: "The best movie is ___.",
      sample: ["The best movie is Frozen.", "The best movie is the one about space."],
    },
    {
      id: "agree-or-disagree-with-friend",
      text: "Do you agree or disagree with your friend's opinion? Why?",
      ko: "친구 의견에 동의해요, 아니면 다르게 생각해요? 왜요?",
      grammar: "G12",
      level: "intermediate",
      type: "produce",
      hint: "I agree/disagree because ___.",
      sample: ["I agree because it makes sense.", "I disagree because I think differently."],
    },

    { id: "most-important-thing-to-know", text: "I think this is the most important thing to know.", ko: "이게 알아야 할 것 중에 제일 중요한 것 같아요.", grammar: "G13", level: "advanced" },
    { id: "some-agree-but-others-dont", text: "Some people agree, but others don't.", ko: "어떤 사람들은 동의하는데 다른 사람들은 안 그래요.", grammar: "G12", level: "advanced" },
    {
      id: "opinion-about-homework",
      text: "What's your opinion about homework?",
      ko: "숙제에 대해 어떻게 생각해요?",
      grammar: "G12",
      level: "advanced",
      type: "produce",
      hint: "I think homework is ___.",
      sample: ["I think homework is helpful.", "I think homework is too much sometimes."],
    },
    {
      id: "most-difficult-decision",
      text: "What's the most difficult decision you've made?",
      ko: "지금까지 내린 결정 중에 제일 어려웠던 게 뭐예요?",
      grammar: "G13",
      level: "advanced",
      type: "produce",
      hint: "The most difficult decision was ___.",
      sample: ["The most difficult decision was choosing a hobby.", "The most difficult decision was picking a book to read."],
    },
  ],
};

const DREAMS_CHAPTER = {
  id: "dreams",
  title: "꿈과 진로",
  emoji: "🌟",
  sentences: [
    { id: "want-to-be-a-scientist", text: "I want to be a scientist.", ko: "저는 과학자가 되고 싶어요.", grammar: "G12" },
    { id: "interested-in-space", text: "I am interested in space.", ko: "저는 우주에 관심이 있어요.", grammar: "G12" },
    { id: "dream-job-is-a-doctor", text: "My dream job is a doctor.", ko: "제 꿈은 의사예요.", grammar: "G12" },
    { id: "want-to-help-people", text: "I want to help people.", ko: "저는 사람들을 돕고 싶어요.", grammar: "G12" },
    { id: "good-at-drawing", text: "I am good at drawing.", ko: "저는 그림을 잘 그려요.", grammar: "G12" },
    { id: "learn-more-about-animals", text: "I want to learn more about animals.", ko: "저는 동물에 대해 더 배우고 싶어요.", grammar: "G12" },
    { id: "favorite-job-is-a-teacher", text: "My favorite job is a teacher.", ko: "제가 제일 좋아하는 직업은 선생님이에요.", grammar: "G12" },
    { id: "practice-every-day-for-my-dream", text: "I practice every day for my dream.", ko: "저는 꿈을 위해 매일 연습해요.", grammar: "G12" },
    { id: "travel-the-world-someday", text: "I want to travel the world someday.", ko: "저는 언젠가 세계 여행을 하고 싶어요.", grammar: "G12" },
    { id: "curious-about-many-things", text: "I am curious about many things.", ko: "저는 많은 것들이 궁금해요.", grammar: "G12" },

    { id: "if-study-hard-become-scientist", text: "If I study hard, I will become a scientist.", ko: "열심히 공부하면 과학자가 될 거예요.", grammar: "G14", level: "intermediate" },
    { id: "if-practice-more-get-better", text: "If I practice more, I will get better.", ko: "더 연습하면 더 잘하게 될 거예요.", grammar: "G14", level: "intermediate" },
    { id: "doctor-is-most-rewarding-job", text: "I think being a doctor is the most rewarding job.", ko: "의사가 제일 보람있는 직업인 것 같아요.", grammar: "G13", level: "intermediate" },
    { id: "if-work-hard-achieve-dream", text: "If you work hard, you can achieve your dream.", ko: "열심히 하면 꿈을 이룰 수 있어요.", grammar: "G14", level: "intermediate" },
    {
      id: "what-will-you-do-to-become-scientist",
      text: "What will you do if you want to become a scientist?",
      ko: "과학자가 되고 싶으면 뭘 할 거예요?",
      grammar: "G14",
      level: "intermediate",
      type: "produce",
      hint: "If I want to become a scientist, I will ___.",
      sample: ["If I want to become a scientist, I will study hard.", "I will read a lot of science books."],
    },
    {
      id: "dream-job-and-why",
      text: "What's your dream job and why?",
      ko: "꿈꾸는 직업이 뭐고 왜 그래요?",
      grammar: "G12",
      level: "intermediate",
      type: "produce",
      hint: "My dream job is ___ because ___.",
      sample: ["My dream job is a vet because I love animals.", "My dream job is an artist because I love drawing."],
    },

    { id: "if-dont-give-up-reach-goal", text: "If I don't give up, I will reach my goal.", ko: "포기하지 않으면 목표를 이룰 거예요.", grammar: "G14", level: "advanced" },
    { id: "most-exciting-dream-i-have", text: "I think this is the most exciting dream I have.", ko: "이게 제가 가진 꿈 중에 제일 신나는 것 같아요.", grammar: "G13", level: "advanced" },
    {
      id: "if-you-could-have-any-job",
      text: "If you could have any job, what would it be?",
      ko: "어떤 직업이든 가질 수 있다면 뭐를 하고 싶어요?",
      grammar: "G14",
      level: "advanced",
      type: "produce",
      hint: "If I could have any job, I would be ___.",
      sample: ["If I could have any job, I would be an astronaut.", "I would be a game designer."],
    },
    {
      id: "steps-to-reach-your-dream",
      text: "What steps will you take to reach your dream?",
      ko: "꿈을 이루기 위해 어떤 단계를 밟을 거예요?",
      grammar: "G14",
      level: "advanced",
      type: "produce",
      hint: "I will ___.",
      sample: ["I will study hard and practice every day.", "I will ask my teacher for help."],
    },
  ],
};

const CURRENT_ISSUES_CHAPTER = {
  id: "current-issues",
  title: "요즘 이슈",
  emoji: "🌍",
  sentences: [
    { id: "earth-needs-our-help", text: "The earth needs our help.", ko: "지구는 우리 도움이 필요해요.", grammar: "G12" },
    { id: "i-recycle-my-trash", text: "I recycle my trash.", ko: "저는 쓰레기를 재활용해요.", grammar: "G12" },
    { id: "saving-water-is-important", text: "Saving water is important.", ko: "물을 절약하는 게 중요해요.", grammar: "G12" },
    { id: "turn-off-the-lights", text: "I turn off the lights when I leave.", ko: "저는 나갈 때 불을 꺼요.", grammar: "G12" },
    { id: "safe-online-is-important", text: "Being safe online is important.", ko: "온라인에서 안전한 게 중요해요.", grammar: "G12" },
    { id: "dont-share-personal-info-online", text: "I don't share personal information online.", ko: "저는 온라인에 개인정보를 안 알려줘요.", grammar: "G12" },
    { id: "kind-online-matters-too", text: "Being kind online matters too.", ko: "온라인에서도 친절한 게 중요해요.", grammar: "G12" },
    { id: "walk-or-bike-instead-of-driving", text: "I walk or bike instead of driving.", ko: "저는 운전 대신 걷거나 자전거를 타요.", grammar: "G12" },
    { id: "plastic-is-bad-for-the-ocean", text: "Plastic is bad for the ocean.", ko: "플라스틱은 바다에 안 좋아요.", grammar: "G12" },
    { id: "care-about-the-environment", text: "I care about the environment.", ko: "저는 환경에 관심이 있어요.", grammar: "G12" },

    { id: "people-who-recycle-help", text: "People who recycle help the environment.", ko: "재활용하는 사람들은 환경을 도와요.", grammar: "G15", level: "intermediate" },
    { id: "know-someone-who-cares-about-nature", text: "I know someone who cares a lot about nature.", ko: "저는 자연을 많이 아끼는 사람을 알아요.", grammar: "G15", level: "intermediate" },
    { id: "problem-that-affects-everyone", text: "This is a problem that affects everyone.", ko: "이건 모두에게 영향을 주는 문제예요.", grammar: "G15", level: "intermediate" },
    { id: "if-everyone-recycles-earth-cleaner", text: "If everyone recycles, the earth will be cleaner.", ko: "모두가 재활용하면 지구가 더 깨끗해질 거예요.", grammar: "G14", level: "intermediate" },
    {
      id: "rule-that-keeps-you-safe-online",
      text: "What's a rule that keeps you safe online?",
      ko: "온라인에서 안전하게 지켜주는 규칙이 뭐예요?",
      grammar: "G15",
      level: "intermediate",
      type: "produce",
      hint: "A rule that keeps me safe is ___.",
      sample: ["A rule that keeps me safe is not sharing my address.", "I don't talk to strangers online."],
    },
    {
      id: "what-can-you-do-to-help-environment",
      text: "What can you do to help the environment?",
      ko: "환경을 도우려면 뭘 할 수 있어요?",
      grammar: "G12",
      level: "intermediate",
      type: "produce",
      hint: "I can ___.",
      sample: ["I can recycle more.", "I can save water and electricity."],
    },

    { id: "people-who-waste-water-hurt-environment", text: "People who waste water hurt the environment.", ko: "물을 낭비하는 사람들은 환경에 안 좋은 영향을 줘요.", grammar: "G15", level: "advanced" },
    { id: "if-we-dont-take-care-things-worse", text: "If we don't take care of the earth, things will get worse.", ko: "지구를 돌보지 않으면 상황이 더 나빠질 거예요.", grammar: "G14", level: "advanced" },
    {
      id: "most-important-environmental-problem",
      text: "What's the most important environmental problem today?",
      ko: "요즘 제일 중요한 환경 문제가 뭐예요?",
      grammar: "G13",
      level: "advanced",
      type: "produce",
      hint: "The most important problem is ___.",
      sample: ["The most important problem is plastic pollution.", "The most important problem is climate change."],
    },
    {
      id: "why-important-to-be-kind-online",
      text: "Why is it important to be kind online?",
      ko: "온라인에서 친절한 게 왜 중요해요?",
      grammar: "G12",
      level: "advanced",
      type: "produce",
      hint: "It's important because ___.",
      sample: ["It's important because words can hurt people.", "Because everyone deserves respect."],
    },
  ],
};

// 여행과 경험 챕터도 좋아하는 것(저학년)·우리 동네(중학년)와 같은 이유로 새 문법을
// 도입하지 않는다 — G12~G15를 새 소재(여행·경험)로 재사용만 한다.
const TRAVEL_CHAPTER = {
  id: "travel",
  title: "여행과 경험",
  emoji: "✈️",
  sentences: [
    { id: "want-to-visit-paris", text: "I want to visit Paris.", ko: "저는 파리에 가보고 싶어요.", grammar: "G12" },
    { id: "traveling-is-exciting", text: "Traveling is exciting.", ko: "여행은 신나요.", grammar: "G12" },
    { id: "like-trying-new-food", text: "I like trying new food.", ko: "저는 새로운 음식을 먹어보는 걸 좋아해요.", grammar: "G12" },
    { id: "take-pictures-when-i-travel", text: "I take pictures when I travel.", ko: "저는 여행할 때 사진을 찍어요.", grammar: "G12" },
    { id: "pack-my-bag-before-a-trip", text: "I pack my bag before a trip.", ko: "저는 여행 전에 가방을 싸요.", grammar: "G12" },
    { id: "learn-about-new-places", text: "I learn about new places.", ko: "저는 새로운 장소에 대해 배워요.", grammar: "G12" },
    { id: "flying-on-a-plane-is-fun", text: "Flying on a plane is fun.", ko: "비행기 타는 게 재밌어요.", grammar: "G12" },
    { id: "keep-a-travel-journal", text: "I keep a travel journal.", ko: "저는 여행 일기를 써요.", grammar: "G12" },
    { id: "meet-new-people-when-i-travel", text: "I meet new people when I travel.", ko: "저는 여행할 때 새로운 사람들을 만나요.", grammar: "G12" },
    { id: "every-trip-is-a-new-experience", text: "Every trip is a new experience.", ko: "여행마다 새로운 경험이에요.", grammar: "G12" },

    { id: "best-trip-ive-ever-had", text: "This was the best trip I've ever had.", ko: "이게 제가 가본 것 중에 제일 좋은 여행이었어요.", grammar: "G13", level: "intermediate" },
    { id: "if-save-money-travel-abroad", text: "If I save money, I will travel abroad.", ko: "돈을 모으면 해외여행을 갈 거예요.", grammar: "G14", level: "intermediate" },
    { id: "met-a-person-who-was-kind", text: "I met a person who was really kind.", ko: "정말 친절한 사람을 만났어요.", grammar: "G15", level: "intermediate" },
    { id: "food-was-most-delicious", text: "The food there was the most delicious I've ever had.", ko: "거기 음식이 제가 먹어본 것 중 제일 맛있었어요.", grammar: "G13", level: "intermediate" },
    {
      id: "most-memorable-trip",
      text: "What's the most memorable trip you've had?",
      ko: "제일 기억에 남는 여행이 뭐예요?",
      grammar: "G13",
      level: "intermediate",
      type: "produce",
      hint: "The most memorable trip was ___.",
      sample: ["The most memorable trip was to the beach.", "The most memorable trip was visiting my grandparents."],
    },
    {
      id: "if-you-could-travel-anywhere",
      text: "If you could travel anywhere, where would you go?",
      ko: "어디든 여행갈 수 있다면 어디 가고 싶어요?",
      grammar: "G14",
      level: "intermediate",
      type: "produce",
      hint: "If I could travel anywhere, I would go to ___.",
      sample: ["If I could travel anywhere, I would go to Japan.", "I would go to Australia."],
    },

    { id: "learned-from-people-who-live-differently", text: "I learned a lot from people who live differently.", ko: "다르게 사는 사람들에게서 많이 배웠어요.", grammar: "G15", level: "advanced" },
    { id: "if-travel-again-try-new-things", text: "If I travel again, I will try new things.", ko: "다시 여행 가면 새로운 걸 해볼 거예요.", grammar: "G14", level: "advanced" },
    {
      id: "why-is-traveling-important",
      text: "Why do you think traveling is important?",
      ko: "여행이 왜 중요하다고 생각해요?",
      grammar: "G12",
      level: "advanced",
      type: "produce",
      hint: "I think traveling is important because ___.",
      sample: ["I think traveling is important because you learn new things.", "Because you meet different people."],
    },
    {
      id: "experience-you-want-to-have-someday",
      text: "What's one experience you want to have someday?",
      ko: "언젠가 해보고 싶은 경험이 뭐예요?",
      grammar: "G12",
      level: "advanced",
      type: "produce",
      hint: "Someday I want to ___.",
      sample: ["Someday I want to visit every continent.", "Someday I want to learn a new language."],
    },
  ],
};

const TEAMWORK_CHAPTER = {
  id: "teamwork",
  title: "협동과 리더십",
  emoji: "🏆",
  sentences: [
    { id: "work-well-in-a-group", text: "I work well in a group.", ko: "저는 모둠에서 잘해요.", grammar: "G12" },
    { id: "listen-to-others-ideas", text: "I listen to others' ideas.", ko: "저는 다른 사람 의견을 들어요.", grammar: "G12" },
    { id: "team-shares-the-work", text: "Our team shares the work.", ko: "우리 팀은 일을 나눠서 해요.", grammar: "G12" },
    { id: "leader-this-time", text: "I am the leader this time.", ko: "이번엔 제가 리더예요.", grammar: "G12" },
    { id: "everyone-has-a-role", text: "Everyone has a role in the group.", ko: "모둠에서 모두 역할이 있어요.", grammar: "G12" },
    { id: "encourage-my-teammates", text: "I encourage my teammates.", ko: "저는 팀원들을 응원해요.", grammar: "G12" },
    { id: "solve-problems-together", text: "We solve problems together.", ko: "우리는 문제를 같이 해결해요.", grammar: "G12" },
    { id: "take-responsibility-for-my-part", text: "I take responsibility for my part.", ko: "저는 제 몫에 책임을 져요.", grammar: "G12" },
    { id: "good-leaders-listen-first", text: "Good leaders listen first.", ko: "좋은 리더는 먼저 들어요.", grammar: "G12" },
    { id: "respect-different-opinions", text: "I respect different opinions.", ko: "저는 다른 의견을 존중해요.", grammar: "G12" },

    { id: "used-to-be-shy-in-groups", text: "I used to be shy in groups.", ko: "저는 예전에 모둠에서 수줍었어요.", grammar: "G17", level: "intermediate" },
    { id: "used-to-let-others-decide", text: "I used to let others decide everything.", ko: "예전엔 다른 사람들이 다 결정하게 뒀어요.", grammar: "G17", level: "intermediate" },
    { id: "leader-is-most-important-skill", text: "I think being a good leader is the most important skill.", ko: "좋은 리더가 되는 게 제일 중요한 능력인 것 같아요.", grammar: "G13", level: "intermediate" },
    { id: "if-work-together-finish-faster", text: "If we work together, we will finish faster.", ko: "같이 하면 더 빨리 끝낼 거예요.", grammar: "G14", level: "intermediate" },
    {
      id: "what-did-you-use-to-be-like",
      text: "What did you use to be like before you joined a team?",
      ko: "팀에 들어가기 전엔 어땠어요?",
      grammar: "G17",
      level: "intermediate",
      type: "produce",
      hint: "I used to ___.",
      sample: ["I used to work alone.", "I used to be quiet in groups."],
    },
    {
      id: "what-will-happen-if-everyone-shares-ideas",
      text: "What will happen if everyone shares their ideas?",
      ko: "모두 의견을 나누면 무슨 일이 생길까요?",
      grammar: "G14",
      level: "intermediate",
      type: "produce",
      hint: "If everyone shares ideas, we will ___.",
      sample: ["If everyone shares ideas, we will find better solutions.", "We will understand each other more."],
    },

    { id: "used-to-think-leadership-meant-in-charge", text: "I used to think leadership meant being in charge.", ko: "예전엔 리더십이 책임자가 되는 거라고 생각했어요.", grammar: "G17", level: "advanced" },
    { id: "good-team-supports-each-other", text: "A good team is one that supports each other.", ko: "좋은 팀은 서로 응원해주는 팀이에요.", grammar: "G15", level: "advanced" },
    {
      id: "why-is-teamwork-important",
      text: "Why is teamwork important?",
      ko: "팀워크가 왜 중요해요?",
      grammar: "G12",
      level: "advanced",
      type: "produce",
      hint: "Teamwork is important because ___.",
      sample: ["Teamwork is important because we can do more together.", "Because everyone brings different strengths."],
    },
    {
      id: "how-have-you-changed-as-a-leader",
      text: "How have you changed as a leader?",
      ko: "리더로서 어떻게 변했어요?",
      grammar: "G17",
      level: "advanced",
      type: "produce",
      hint: "I used to ___, but now I ___.",
      sample: ["I used to be quiet, but now I speak up.", "I used to work alone, but now I ask for help."],
    },
  ],
};

// 학년 트랙 — 실제로 만든 학년만 넣는다(위 헤더 설명 참고).
export const GRADES = [
  {
    id: "lower",
    label: "저학년 (1~2학년)",
    emoji: "🎒",
    grammarPoints: LOWER_GRAMMAR_POINTS,
    chapters: [SCHOOL_DAY_CHAPTER, CLASSROOM_CHAPTER, RECESS_CHAPTER, FAVORITES_CHAPTER, PE_CLASS_CHAPTER],
  },
  {
    id: "middle",
    label: "중학년 (3~4학년)",
    emoji: "📖",
    grammarPoints: MIDDLE_GRAMMAR_POINTS,
    chapters: [SCHOOLWORK_CHAPTER, FRIENDSHIP_CHAPTER, AFTER_SCHOOL_CHAPTER, NEIGHBORHOOD_CHAPTER, SCHOOL_EVENTS_CHAPTER],
  },
  {
    id: "high",
    label: "고학년 (5~6학년)",
    emoji: "🎓",
    grammarPoints: HIGH_GRAMMAR_POINTS,
    chapters: [OPINIONS_CHAPTER, DREAMS_CHAPTER, CURRENT_ISSUES_CHAPTER, TRAVEL_CHAPTER, TEAMWORK_CHAPTER],
  },
];
