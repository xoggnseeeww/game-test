// "대화 연습" 도구의 장면 목록. 학습 카테고리의 세 번째 도구이자, 이 앱에서 처음으로
// **문장 하나 = 카드 하나** 모델을 벗어난 도구다(§3-7이 오래 미뤄둔 다중 턴 대화).
//
// 왜 기존 도구를 확장하지 않고 새로 만들었나: basic-conversation·elementary-conversation은
// "정해진 문장 하나를 얼마나 똑같이 따라 했는가"(Levenshtein)를 재는 구조라, 주고받는
// 대화(상대 말에 반응해서 내 차례를 채우는 것)를 넣으면 두 모델이 한 폴더에 섞인다 —
// §3-7이 "새 도구로 추가하는 쪽이 맞아 보인다"고 미리 정해둔 그대로 따랐다.
//
// 화면 모델: 장면(SCENES) 하나 = 대화 하나. 대화는 `turns` 배열이고 두 종류가 번갈아 온다.
//   - `role: "partner"` — 상대가 하는 말. 앱이 자동으로 읽어주고(elementary의 produce
//     카드와 같은 이유) 다음 버튼으로 넘어간다. 사용자는 듣기만 한다.
//   - `role: "you"` — 내 차례. 정답 문장을 읽어주지 않고 `hint`(문장 시작 조각)만 주고,
//     말한 뒤 `sample`(예시 답안)과 비교해 스스로 평가한다. **유사도 채점을 하지 않는다** —
//     같은 상황에서도 답이 여러 개라서 잴 기준이 없다(elementary의 produce와 같은 판단).
//
// 분기(branching)는 일부러 없다. 자유 발화를 실제로 알아듣고 갈래를 고르려면 STT 결과를
// 의미로 해석해야 하는데, 브라우저 내장 STT의 인식률로는 "다르게 말했더니 대화가 산으로
// 가는" 실패가 훨씬 잦다. 대신 대화는 한 줄기로 흐르고, 내 차례에서 뭘 말하든 상대는
// 자연스럽게 이어지도록 상대 대사를 썼다 — 역할극(role-play)에 가까운 형태다.
//
// 장면은 실제로 만든 것만 넣는다(이 저장소 관례: 빈 기능을 "준비중"으로 미리 노출하지
// 않는다). 난이도(level)는 두지 않았다 — 대화는 상황 자체가 난이도라, 문장 단위 도구처럼
// 기본/중급/심화로 쪼개면 같은 대화를 세 번 만들어야 한다.
export const SCENES = [
  {
    id: "make-plans",
    title: "친구와 약속 잡기",
    emoji: "📅",
    desc: "주말에 뭐 할지 정하는 대화",
    turns: [
      { role: "partner", text: "Hey! Are you free this weekend?", ko: "안녕! 이번 주말에 시간 있어?" },
      {
        role: "you",
        ko: "시간이 있는지 없는지 대답해보세요.",
        hint: "Yes, I'm free on ___. / Sorry, I'm busy because ___.",
        sample: [
          "Yes, I'm free on Saturday.",
          "Sorry, I'm busy on Saturday, but Sunday works.",
          "Yeah, I'm free! What's up?",
        ],
      },
      { role: "partner", text: "Great! Do you want to go to the park or watch a movie?", ko: "좋아! 공원에 갈래, 아니면 영화 볼래?" },
      {
        role: "you",
        ko: "둘 중에 하나를 고르고 이유도 말해보세요.",
        hint: "I want to ___ because ___.",
        sample: [
          "I want to go to the park because the weather is nice.",
          "Let's watch a movie. I've been wanting to see one.",
          "Honestly, either one sounds fun to me.",
        ],
      },
      { role: "partner", text: "Sounds good. What time should we meet?", ko: "좋아. 몇 시에 만날까?" },
      {
        role: "you",
        ko: "만날 시간을 정해서 말해보세요.",
        hint: "How about ___ o'clock?",
        sample: [
          "How about two o'clock?",
          "Let's meet at eleven in the morning.",
          "Any time after lunch works for me.",
        ],
      },
      { role: "partner", text: "Perfect. See you then!", ko: "좋아. 그때 보자!" },
      {
        role: "you",
        ko: "인사하며 대화를 마무리해보세요.",
        hint: "See you ___! / I can't wait!",
        sample: ["See you Saturday!", "Great, I can't wait!", "Cool, see you then!"],
      },
    ],
  },
  {
    id: "meet-someone",
    title: "처음 만난 친구와 인사",
    emoji: "👋",
    desc: "새 친구에게 나를 소개하는 대화",
    turns: [
      { role: "partner", text: "Hi! I'm Mina. I'm new here.", ko: "안녕! 나는 미나야. 여기 처음 왔어." },
      {
        role: "you",
        ko: "인사하고 이름을 알려주세요.",
        hint: "Hi, I'm ___. Nice to meet you.",
        sample: ["Hi, I'm Jun. Nice to meet you!", "Hey Mina! I'm Soo. Welcome!", "Nice to meet you. My name is Alex."],
      },
      { role: "partner", text: "Nice to meet you too! What grade are you in?", ko: "나도 반가워! 몇 학년이야?" },
      {
        role: "you",
        ko: "학년을 말하고 상대에게도 되물어보세요.",
        hint: "I'm in ___ grade. How about you?",
        sample: [
          "I'm in fourth grade. How about you?",
          "I'm in fifth grade. What about you?",
          "Third grade! Are you in my class?",
        ],
      },
      { role: "partner", text: "Same as me! What do you like to do after school?", ko: "나랑 같네! 방과 후엔 뭐 하는 거 좋아해?" },
      {
        role: "you",
        ko: "좋아하는 활동을 말해보세요.",
        hint: "I like to ___.",
        sample: [
          "I like to play soccer with my friends.",
          "I usually read or draw at home.",
          "Mostly I just hang out with my friends.",
        ],
      },
      { role: "partner", text: "That sounds fun. Maybe we can do that together sometime!", ko: "재밌겠다. 언젠가 같이 해도 좋겠어!" },
      {
        role: "you",
        ko: "같이 하자고 답해보세요.",
        hint: "Sure! Let's ___.",
        sample: ["Sure! Let's do it this week.", "Yeah, that would be fun!", "Definitely. Just let me know when."],
      },
    ],
  },
  {
    id: "at-the-store",
    title: "가게에서 물건 사기",
    emoji: "🛒",
    desc: "물건을 찾고 값을 물어보는 대화",
    turns: [
      { role: "partner", text: "Hello! Can I help you find something?", ko: "안녕하세요! 뭐 찾으시는 거 도와드릴까요?" },
      {
        role: "you",
        ko: "찾는 물건을 말해보세요.",
        hint: "Yes, I'm looking for ___.",
        sample: [
          "Yes, I'm looking for a notebook.",
          "I'm looking for some snacks, please.",
          "Do you have any pencils?",
        ],
      },
      { role: "partner", text: "Sure, they're right over here. How many do you need?", ko: "네, 바로 여기 있어요. 몇 개 필요하세요?" },
      {
        role: "you",
        ko: "필요한 개수를 말해보세요.",
        hint: "I need ___, please.",
        sample: ["I need two, please.", "Just one is fine.", "Can I get three of them?"],
      },
      { role: "partner", text: "No problem. That will be five dollars.", ko: "알겠습니다. 5달러입니다." },
      {
        role: "you",
        ko: "돈을 내면서 말해보세요.",
        hint: "Here you go. / Can I pay with ___?",
        sample: ["Here you go. Thank you!", "Can I pay with a card?", "Sure, here's five dollars."],
      },
      { role: "partner", text: "Thank you! Have a nice day.", ko: "감사합니다! 좋은 하루 보내세요." },
      {
        role: "you",
        ko: "인사하며 마무리해보세요.",
        hint: "Thanks! You too.",
        sample: ["Thanks! You too.", "Thank you, have a good day!", "Thanks a lot. Bye!"],
      },
    ],
  },
  {
    id: "order-food",
    title: "식당에서 주문하기",
    emoji: "🍽️",
    desc: "메뉴를 고르고 주문하는 대화",
    turns: [
      { role: "partner", text: "Welcome! Are you ready to order?", ko: "어서 오세요! 주문하시겠어요?" },
      {
        role: "you",
        ko: "준비됐는지 답하고 주문해보세요.",
        hint: "Yes, I'd like ___, please.",
        sample: [
          "Yes, I'd like a cheeseburger, please.",
          "Can I have the chicken, please?",
          "Not yet, can I have one more minute?",
        ],
      },
      { role: "partner", text: "Good choice! Would you like anything to drink?", ko: "좋은 선택이에요! 마실 것도 드릴까요?" },
      {
        role: "you",
        ko: "음료를 주문하거나 괜찮다고 답해보세요.",
        hint: "Yes, ___ please. / No thanks, just ___.",
        sample: [
          "Yes, orange juice please.",
          "Just water, thank you.",
          "No thanks, I'm okay.",
        ],
      },
      { role: "partner", text: "Sure. Is that for here or to go?", ko: "네. 여기서 드시나요, 포장하시나요?" },
      {
        role: "you",
        ko: "여기서 먹을지 포장할지 말해보세요.",
        hint: "For here, please. / To go, please.",
        sample: ["For here, please.", "To go, thanks.", "I'll eat here, thank you."],
      },
      { role: "partner", text: "Great, it will be ready in a few minutes!", ko: "좋아요, 몇 분 뒤에 준비될 거예요!" },
      {
        role: "you",
        ko: "고맙다고 답해보세요.",
        hint: "Thank you! / Thanks, I'll wait ___.",
        sample: ["Thank you so much!", "Thanks, I'll wait over there.", "Great, thanks!"],
      },
    ],
  },
];
