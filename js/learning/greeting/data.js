// 학습 카테고리 어린이 모드 파일럿 상황: 인사 · 기분 표현.
// 문장 데이터가 유일한 소스라, 화면 문구의 개수는 항상 SENTENCES.length에서 파생한다.
// mood는 js/learning/mascot.js의 MASCOTS 키와 맞춰야 한다(test/learning.mascot.test.js가 검사).
export const SENTENCES = [
  { id: "hello", text: "Hello!", ko: "안녕!", mood: "wave" },
  { id: "happy", text: "I'm happy.", ko: "나는 기뻐요.", mood: "happy" },
  { id: "sad", text: "I'm sad.", ko: "나는 슬퍼요.", mood: "sad" },
  { id: "nice", text: "Nice to meet you.", ko: "만나서 반가워요.", mood: "friendly" },
  { id: "bye", text: "Goodbye!", ko: "안녕히 가세요!", mood: "bye" },
];
