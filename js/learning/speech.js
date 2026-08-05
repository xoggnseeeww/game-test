// 브라우저 내장 TTS/STT 헬퍼. score.js와 같은 이유로 도구 폴더 밖에 둔다 — "듣고 따라
// 말하기"를 쓰는 학습 도구라면 어디서든 재사용되는 로직이라, 도구마다 복사하면 한쪽만
// 고치는 버그가 생긴다(D-75, elementary-conversation 추가 시 basic-conversation에서
// 여기로 옮김). DOM은 안 쓰지만 `window.speechSynthesis`/`SpeechRecognition`에 의존하므로
// score.js와 달리 node --test로는 검증되지 않는다 — 브라우저 회귀(scripts/verify.cjs)로만
// 확인된다.
export function supportsSpeech() {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

export function supportsRecognition() {
  return typeof window !== "undefined" && !!(window.SpeechRecognition || window.webkitSpeechRecognition);
}

export function speak(text, rate, lang = "en-US") {
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = lang;
  u.rate = rate;
  window.speechSynthesis.speak(u);
}

// 어린이는 말을 시작하는 템포가 느릴 수 있어, 조기 종료 대신 결과가 올 때까지 그냥 기다린다
// (기획서 4-3). 실패("no-speech" 등)는 onError로 그대로 올려 화면에 보여준다 — 조용히
// 삼키지 않는다.
export function listen(onResult, onError) {
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const rec = new Recognition();
  rec.lang = "en-US";
  rec.interimResults = false;
  rec.maxAlternatives = 1;
  rec.onresult = (e) => onResult(e.results[0][0].transcript);
  rec.onerror = (e) => onError(e.error);
  rec.start();
  return rec;
}
