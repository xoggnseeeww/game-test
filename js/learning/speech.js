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

// 로컬(기기 내장) 음성은 대체로 기계음에 가깝고, 네트워크 음성(Chrome의 "Google US English" 등)이
// 훨씬 자연스럽다 — 있으면 그쪽을 우선 고른다. 첫 호출 시점엔 목록이 아직 안 채워져 있을 수 있어
// (Chrome이 비동기 로드) 그럴 땐 그냥 브라우저 기본 음성으로 재생된다.
function pickVoice(lang) {
  const voices = window.speechSynthesis.getVoices();
  const langPrefix = lang.slice(0, 2);
  const matching = voices.filter((v) => v.lang === lang || v.lang.startsWith(langPrefix));
  return matching.find((v) => !v.localService) || matching[0] || null;
}

export function speak(text, rate, lang = "en-US") {
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = lang;
  u.rate = rate;
  const voice = pickVoice(lang);
  if (voice) u.voice = voice;
  window.speechSynthesis.speak(u);
}

// 어린이는 말을 시작하는 템포가 느릴 수 있어, 조기 종료 대신 결과가 올 때까지 그냥 기다린다
// (기획서 4-3). 실패("no-speech" 등)는 onError로 그대로 올려 화면에 보여준다 — 조용히
// 삼키지 않는다.
export function listen(onResult, onError) {
  // 읽어주던 소리를 먼저 끊는다 — 안 끊으면 스피커로 나가는 앱 자기 목소리를 마이크가 그대로
  // 주워 담아 인식 결과가 엉킨다. produce 카드(D-84)와 대화 연습의 상대 대사(D-87)가 자동
  // 재생을 하게 되면서 "다 듣기 전에 마이크를 누르는" 경로가 흔해져 실제로 부딪히기 쉬워졌다.
  // 모든 호출부가 이 함수를 지나므로 여기 한 줄이면 두 도구 전부 해결된다.
  window.speechSynthesis?.cancel();
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
