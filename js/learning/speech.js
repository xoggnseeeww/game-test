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

// 음성 고르기. 순수 함수라 `node --test`로 검증된다(브라우저 API를 안 만진다) — speak()이
// `getVoices()` 결과를 넣어준다.
//
// **지역(en-US vs en-GB/en-IN/en-AU)이 로컬/네트워크보다 우선이다.** D-84에서 "네트워크 음성이
// 더 자연스럽다"만 보고 `!localService`를 먼저 골랐더니, 기기에 **en-US 로컬 음성이 있어도
// en-IN 네트워크 음성**이 뽑히는 일이 생겼다 — 미국식 영어를 배우는 아이에게는 이게 "발음이
// 완전 이상하다"로 들린다. 지역이 정확히 맞는 것 중에서만 네트워크를 선호한다.
//
// 특정 음성 이름은 여전히 하드코딩하지 않는다(D-84) — 기기·브라우저마다 목록이 달라 이름
// 매칭은 금방 깨진다.
export function pickVoice(voices, lang) {
  const prefix = lang.slice(0, 2);
  // 3: 지역까지 일치 + 네트워크 / 2: 지역까지 일치 / 1: 언어만 일치 + 네트워크 / 0: 언어만 일치
  const score = (v) => {
    const vlang = String(v.lang || "").replace("_", "-");
    if (vlang.toLowerCase() === lang.toLowerCase()) return v.localService ? 2 : 3;
    if (vlang.toLowerCase().startsWith(prefix)) return v.localService ? 0 : 1;
    return -1;
  };
  let best = null;
  let bestScore = -1;
  for (const v of voices || []) {
    const sc = score(v);
    if (sc > bestScore) { best = v; bestScore = sc; }
  }
  return best;
}

// 목록이 안 찼을 때 speak()가 거는 재시도 리스너. 모듈 스코프에 하나만 두는 이유는
// cancelSpeech()가 화면을 나갈 때 이 리스너를 지울 수 있어야 하기 때문이다 — `{ once: true }`
// 옵션은 "한 번만 실행됨"만 보장하지, 실행되기 전에 리스너를 취소하는 수단은 별도로 필요하다.
let pendingVoiceRetry = null;

// speak()가 등록한 voiceschanged 대기까지 함께 취소한다. `speechSynthesis.cancel()` 단독으로는
// **재생 중인 소리만** 멈추고 예약된 리스너는 그대로 남는다 — 그 리스너가 나중에 발동하면
// 이미 떠난 화면의 문장이 지금 보고 있는 화면 위에서 재생된다. 화면을 나갈 때 부르는
// `onLeave` 콜백은 전부 이 함수로 정리한다(speech.js를 쓰는 화면 4곳 공용).
export function cancelSpeech() {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  if (pendingVoiceRetry) {
    window.speechSynthesis.removeEventListener("voiceschanged", pendingVoiceRetry);
    pendingVoiceRetry = null;
  }
  window.speechSynthesis.cancel();
}

export function speak(text, rate, lang = "en-US") {
  cancelSpeech();

  // Chrome은 목록을 비동기로 채워서 **첫 호출에 `getVoices()`가 빈 배열**인 경우가 있다.
  // 그때 그냥 재생하면 음성 지정 없이 기기 기본으로 읽는데, 한국어 엔진이 기본인 기기에서는
  // 영어 문장을 한국어 발음으로 읽어버린다("발음이 엉망"의 진짜 원인 중 하나).
  // 목록이 아직 비었으면 채워질 때 한 번만 다시 시도한다.
  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) {
    pendingVoiceRetry = () => {
      pendingVoiceRetry = null;
      speak(text, rate, lang);
    };
    window.speechSynthesis.addEventListener("voiceschanged", pendingVoiceRetry, { once: true });
    return;
  }

  const u = new SpeechSynthesisUtterance(text);
  u.lang = lang;
  u.rate = rate;
  const voice = pickVoice(voices, lang);
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
  cancelSpeech();
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
