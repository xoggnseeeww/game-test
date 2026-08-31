// 음성 고르기 — `js/learning/speech.js`에서 이 함수만 순수 함수라 여기서 검증한다.
// 나머지(speak/listen)는 브라우저 API에 묶여 있어 `scripts/verify.cjs`로만 확인된다.
//
// 이 로직이 깨지면 "영어 문장을 인도식/영국식, 심하면 한국어 발음으로 읽는" 형태로 나타난다.
// 화면엔 아무 표시가 안 나고 소리로만 드러나서(=자동 검증이 안 됨) 여기서 묶어둔다.
import test from "node:test";
import assert from "node:assert/strict";
import { pickVoice, speak, cancelSpeech } from "../js/learning/speech.js";

const v = (lang, name, localService = true) => ({ lang, name, localService });

test("지역까지 맞는 음성이 다른 지역보다 먼저다 (en-IN 네트워크 < en-US 로컬)", () => {
  const voices = [v("en-IN", "Indian", false), v("en-GB", "British", false), v("en-US", "American", true)];
  assert.equal(pickVoice(voices, "en-US").name, "American");
});

test("지역이 같은 것끼리는 네트워크 음성을 선호한다 (D-84의 원래 의도)", () => {
  const voices = [v("en-US", "Local US", true), v("en-US", "Google US", false)];
  assert.equal(pickVoice(voices, "en-US").name, "Google US");
});

test("정확히 맞는 지역이 없으면 같은 언어의 다른 지역으로 떨어진다", () => {
  const voices = [v("ko-KR", "한국어", true), v("en-GB", "British", true)];
  assert.equal(pickVoice(voices, "en-US").name, "British");
});

test("다른 언어 음성은 절대 고르지 않는다 (영어를 한국어 엔진으로 읽는 사고 방지)", () => {
  const voices = [v("ko-KR", "한국어", false), v("ja-JP", "日本語", false)];
  assert.equal(pickVoice(voices, "en-US"), null, "맞는 언어가 없으면 null이어야 한다(브라우저 기본에 맡김)");
});

test("한국어 요청도 같은 규칙으로 고른다", () => {
  const voices = [v("en-US", "American", false), v("ko-KR", "한국어", true)];
  assert.equal(pickVoice(voices, "ko-KR").name, "한국어");
});

test("ko_KR처럼 언더스코어로 오는 기기도 지역 일치로 인정한다", () => {
  const voices = [v("ko", "generic", true), v("ko_KR", "정확", true)];
  assert.equal(pickVoice(voices, "ko-KR").name, "정확");
});

test("목록이 비었거나 없어도 터지지 않는다", () => {
  assert.equal(pickVoice([], "en-US"), null);
  assert.equal(pickVoice(undefined, "en-US"), null);
});

// ---------------------------------------------------------------- cancelSpeech()

// window.speechSynthesis를 흉내 내는 최소 스텁. speak()가 목록이 빈 상태에서 거는
// voiceschanged 리스너가 cancelSpeech()로 실제로 지워지는지가 관심사라, EventTarget
// 동작(addEventListener/removeEventListener/once)만 흉내 낸다.
class FakeSynth {
  constructor(voices = []) {
    this.voices = voices;
    this.listeners = {};
    this.spoken = [];
    this.cancelCalls = 0;
  }
  getVoices() {
    return this.voices;
  }
  addEventListener(type, cb, opts) {
    (this.listeners[type] ??= []).push({ cb, opts });
  }
  removeEventListener(type, cb) {
    this.listeners[type] = (this.listeners[type] || []).filter((l) => l.cb !== cb);
  }
  cancel() {
    this.cancelCalls += 1;
  }
  speak(u) {
    this.spoken.push(u);
  }
  // 실제 브라우저의 voiceschanged 발동을 흉내 낸다 — once 리스너는 발동 후 스스로 빠진다.
  fire(type) {
    for (const { cb, opts } of (this.listeners[type] || []).slice()) {
      if (opts?.once) this.removeEventListener(type, cb);
      cb();
    }
  }
}

function withFakeSynth(voices, run) {
  const synth = new FakeSynth(voices);
  globalThis.window = { speechSynthesis: synth };
  globalThis.SpeechSynthesisUtterance = function (text) {
    this.text = text;
  };
  try {
    run(synth);
  } finally {
    delete globalThis.window;
    delete globalThis.SpeechSynthesisUtterance;
  }
}

test("화면을 나갈 때 cancelSpeech()가 대기 중인 voiceschanged 리스너까지 지운다", () => {
  // 음성 목록이 아직 안 찬 상태(getVoices()가 빈 배열)를 흉내 낸다 — speak()는 바로 재생하지
  // 않고 목록이 찰 때 재시도하는 리스너만 건다.
  withFakeSynth([], (synth) => {
    speak("hello", 1, "en-US");
    assert.equal(synth.spoken.length, 0, "목록이 비어 있으면 아직 재생하면 안 된다");
    assert.equal((synth.listeners.voiceschanged || []).length, 1, "재시도 리스너가 걸려 있어야 한다");

    // 화면을 떠날 때 onLeave가 부르는 것과 같은 호출.
    cancelSpeech();
    assert.equal(
      (synth.listeners.voiceschanged || []).length,
      0,
      "cancelSpeech()가 리스너를 지워야 한다 — 안 지우면 늦게 도착한 voiceschanged가 떠난 화면의 문장을 재생한다"
    );

    // 리스너가 지워졌으니 나중에 목록이 차도 아무 일도 없어야 한다.
    synth.fire("voiceschanged");
    assert.equal(synth.spoken.length, 0, "화면을 떠난 뒤에는 재생되면 안 된다");
  });
});

test("리스너가 살아있는 채로 voiceschanged가 오면 정상적으로 재생된다 (되살림 방지 대조군)", () => {
  // 위 검사가 실제로 무언가를 확인하고 있는지 보여주는 대조군 — cancelSpeech()를 안 부르면
  // 지연 재생 자체는 의도된 동작이라는 걸 같이 남겨둔다.
  withFakeSynth([], (synth) => {
    speak("hello", 1, "en-US");
    synth.voices = [{ lang: "en-US", name: "American", localService: true }];
    synth.fire("voiceschanged");
    assert.equal(synth.spoken.length, 1, "취소하지 않았으면 목록이 찬 뒤 정상 재생돼야 한다");
  });
});

test("speak()를 다시 호출하면 이전 대기 리스너가 남지 않는다 (중복 재생 방지)", () => {
  withFakeSynth([], (synth) => {
    speak("first", 1, "en-US");
    speak("second", 1, "en-US");
    assert.equal(
      (synth.listeners.voiceschanged || []).length,
      1,
      "새 speak() 호출이 이전 리스너를 지우지 않으면, 목록이 찼을 때 두 문장이 겹쳐 재생된다"
    );
  });
});
