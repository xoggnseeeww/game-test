// "기초 영어회화" 도구의 목차. 챕터 하나 = 상황 하나. 새 챕터는 이 배열에 항목만
// 추가하면 목차 화면과 화면 등록(index.js)에 자동으로 반영된다 — 다른 곳을 고칠 필요 없다.
export const CHAPTERS = [
  {
    id: "greeting",
    title: "인사 · 기분 표현",
    emoji: "👋",
    sentences: [
      { id: "hello", text: "Hello!", ko: "안녕!", mood: "wave" },
      { id: "happy", text: "I'm happy.", ko: "나는 기뻐요.", mood: "happy" },
      { id: "sad", text: "I'm sad.", ko: "나는 슬퍼요.", mood: "sad" },
      { id: "nice", text: "Nice to meet you.", ko: "만나서 반가워요.", mood: "friendly" },
      { id: "bye", text: "Goodbye!", ko: "안녕히 가세요!", mood: "bye" },
    ],
  },
];
