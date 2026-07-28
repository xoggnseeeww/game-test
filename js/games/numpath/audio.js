// 피치 스케일링 효과음(기획서 §3-1): 이동마다 반음씩 음이 올라가고, 클리어 시 화음이 울린다.
// 외부 오디오 파일 없이 Web Audio 오실레이터로만 만든다 — 이 사이트는 런타임 의존성이 0이다.
//
// AudioContext는 브라우저가 첫 사용자 제스처 전엔 suspended 상태로 만든다. 타일 클릭 자체가
// 제스처이므로 그 안에서 동기적으로 resume()을 호출하면 된다 — 별도 "오디오 켜기" 버튼 없이도 된다.
let audioCtx = null;

function getCtx() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === "suspended") audioCtx.resume();
  return audioCtx;
}

const BASE_FREQ = 261.63; // C4
const SEMITONE = Math.pow(2, 1 / 12);

function tone(ctx, freq, { duration = 0.12, type = "sine", peak = 0.14, at = 0 } = {}) {
  const start = ctx.currentTime + at;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0, start);
  gain.gain.linearRampToValueAtTime(peak, start + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  osc.connect(gain).connect(ctx.destination);
  osc.start(start);
  osc.stop(start + duration + 0.05);
}

// 이동 횟수만큼 반음 상승, 한 옥타브(12반음)를 채우면 다음 옥타브로 순환한다.
export function playMoveTone(moveIndex, muted) {
  if (muted) return;
  const freq = BASE_FREQ * Math.pow(SEMITONE, moveIndex % 12);
  tone(getCtx(), freq, { duration: 0.1, type: "sine", peak: 0.14 });
}

// 클리어 시 장3화음 + 옥타브(0·4·7·12반음)를 짧은 간격으로 쌓아 완성된 화음처럼 들리게 한다.
export function playClearChord(muted) {
  if (muted) return;
  const ctx = getCtx();
  [0, 4, 7, 12].forEach((semi, i) => {
    tone(ctx, BASE_FREQ * Math.pow(SEMITONE, semi), { duration: 0.55, type: "triangle", peak: 0.12, at: i * 0.035 });
  });
}

// 막힌 칸을 눌렀을 때(진입 불가) 낮고 짧은 톤으로 "안 된다"는 걸 알린다.
export function playBlockedTone(muted) {
  if (muted) return;
  tone(getCtx(), BASE_FREQ * 0.5, { duration: 0.12, type: "sawtooth", peak: 0.08 });
}
