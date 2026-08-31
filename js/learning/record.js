// 음성 인식(STT)이 없는 브라우저의 말하기 폴백(D-95, A-2).
//
// 문제: iOS Safari는 `SpeechRecognition`을 지원하지 않는다. 그래서 아이폰에서는 이 앱의
// 말하기 연습이 **통째로 죽고** "이 브라우저는 음성 인식을 지원하지 않아요" 안내만 떴다 —
// 대상 사용자(초등학생·보호자 폰)에서 아이폰 비중을 생각하면 사실상 절반이 못 쓰는 상태였다.
//
// 폴백: 내 목소리를 녹음해서 다시 듣고 스스로 비교한다(shadowing). 채점은 없다 —
// 서버 STT를 붙이면 백엔드·비용·개인정보 처리방침이 전부 딸려오는데(이 저장소는 서버 호출이
// 아예 없다, D-108), 자가평가는 이미 produce 문장·대화 연습에서 쓰고 있는 방식이라 새로 만들
// 게 없다. `MediaRecorder`는 iOS 14.3+에서 지원돼 별도 의존성이 필요 없다.
import { cancelSpeech } from "./speech.js";

export function supportsRecording() {
  return typeof window !== "undefined" && !!(window.MediaRecorder && navigator.mediaDevices?.getUserMedia);
}

export function recordFallbackMarkup() {
  if (!supportsRecording()) {
    return `<p class="learning-warn">이 브라우저는 음성 인식·녹음을 지원하지 않아요.</p>`;
  }
  return `
    <button class="btn-mic btn-mic-labeled" id="learning-record">🎙️ 녹음해서 비교하기</button>
    <div class="learning-mic-status" id="learning-record-status"></div>
    <div class="learning-result" id="learning-record-result"></div>`;
}

// onDone(ok) — 자가평가 결과. 호출부가 weak/SRS 반영과 다음 카드 이동을 알아서 한다.
export function bindRecordFallback(root, { onDone }) {
  const btn = root.querySelector("#learning-record");
  if (!btn) return;
  const statusEl = root.querySelector("#learning-record-status");
  const resultEl = root.querySelector("#learning-record-result");
  let rec = null;
  let url = null;

  btn.addEventListener("click", async () => {
    if (rec) { rec.stop(); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const chunks = [];
      rec = new MediaRecorder(stream);
      rec.ondataavailable = (e) => chunks.push(e.data);
      rec.onstop = () => {
        // 마이크를 놓아준다 — 안 하면 탭에 녹음 표시가 계속 남는다.
        stream.getTracks().forEach((t) => t.stop());
        rec = null;
        btn.textContent = "🎙️ 다시 녹음하기";
        statusEl.textContent = "";
        if (url) URL.revokeObjectURL(url);
        url = URL.createObjectURL(new Blob(chunks));
        resultEl.innerHTML = `
          <p class="learning-feedback">내 목소리를 들어보고 위 문장과 비교해보세요.</p>
          <audio controls src="${url}" class="learning-audio"></audio>
          <div class="cta">
            <button class="cta-btn" id="learning-rec-good">잘 말했어요</button>
            <button class="cta-btn" id="learning-rec-retry">다시 연습할래요</button>
          </div>`;
        resultEl.querySelector("#learning-rec-good").addEventListener("click", () => onDone(true));
        resultEl.querySelector("#learning-rec-retry").addEventListener("click", () => onDone(false));
      };
      cancelSpeech(); // listen()과 같은 이유 — 재생 중인 소리가 녹음에 섞인다
      rec.start();
      btn.textContent = "⏹ 녹음 끝내기";
      statusEl.textContent = "녹음 중이에요...";
    } catch (err) {
      console.error("녹음 실패:", err);
      statusEl.textContent = "";
      resultEl.innerHTML = `<p class="learning-warn">마이크를 쓸 수 없어요. 브라우저 설정에서 마이크를 허용해주세요.</p>`;
    }
  });
}
