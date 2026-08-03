// 인사 · 기분 표현 상황: 문장 하나씩 듣기 → 말하기 → 결과 3단계를 반복한다(기획서 2-2).
// disc-question과 같은 이유로 카드 하나 진입 시 화면 골격을 한 번만 그리고, 문장이
// 바뀔 때는 #learning-card 안쪽만 갈아끼운다(전체 재렌더는 리스너·오디오를 새로 붙여야
// 해서 더 번거롭고, 광고 슬롯이 있는 화면이었다면 중복 노출까지 생겼을 패턴).
import { app, onLeave } from "../../core/router.js";
import { el, bindNav } from "../../core/dom.js";
import { state } from "../../core/state.js";
import { SENTENCES } from "./data.js";
import { similarity, feedbackTier, TIER_TEXT } from "./score.js";
import { mascotFor } from "../mascot.js";

const N = SENTENCES.length;

function supportsSpeech() {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

function supportsRecognition() {
  return typeof window !== "undefined" && !!(window.SpeechRecognition || window.webkitSpeechRecognition);
}

function speak(text, rate) {
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "en-US";
  u.rate = rate;
  window.speechSynthesis.speak(u);
}

// 어린이는 말을 시작하는 템포가 느릴 수 있어, 조기 종료 대신 결과가 올 때까지 그냥 기다린다
// (기획서 4-3). 실패("no-speech" 등)는 onError로 그대로 올려 화면에 보여준다 — 조용히
// 삼키지 않는다.
function listen(onResult, onError) {
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

export function renderLearningGreeting() {
  let activeRecognition = null;
  onLeave(() => {
    window.speechSynthesis?.cancel();
    activeRecognition?.abort();
  });

  app.appendChild(el(`
    <div class="learning-screen">
      <div class="back-row">
        <button class="back-btn" data-nav="learning-list">‹</button>
        <div class="back-title" id="learning-title"></div>
      </div>
      <div id="learning-card"></div>
    </div>
  `));

  bindNav(app);

  const titleEl = app.querySelector("#learning-title");
  const cardEl = app.querySelector("#learning-card");

  function showDone() {
    titleEl.textContent = "인사 · 기분 표현";
    cardEl.innerHTML = `
      <div class="empty-state">
        <div class="emoji">🎉</div>
        <div class="msg">문장 ${N}개를 다 배웠어요!</div>
      </div>
      <div class="cta"><button class="cta-btn" id="learning-restart">처음부터 다시 놀기</button></div>
    `;
    cardEl.querySelector("#learning-restart").addEventListener("click", () => {
      state.learning.greeting = { index: 0 };
      showCard();
    });
  }

  function showCard() {
    const st = state.learning.greeting;
    if (st.index >= N) return showDone();
    const card = SENTENCES[st.index];
    titleEl.textContent = `인사 · 기분 표현 (${st.index + 1}/${N})`;
    cardEl.innerHTML = `
      <div class="cover">
        ${mascotFor(card.mood)}
        <h2>${card.text}</h2>
        <p>${card.ko}</p>
      </div>
      ${!supportsSpeech()
        ? `<p class="learning-warn">이 브라우저는 음성 재생을 지원하지 않아요.</p>`
        : `<div class="learning-listen">
             <button class="cta-btn" data-rate="1">🔊 듣기</button>
             <button class="cta-btn" data-rate="0.75">🐢 천천히</button>
           </div>`}
      ${!supportsRecognition()
        ? `<p class="learning-warn">이 브라우저는 음성 인식을 지원하지 않아요.</p>`
        : `<button class="btn-mic" id="learning-mic">🎤</button>
           <div class="learning-mic-status" id="learning-mic-status"></div>`}
      <div class="learning-result" id="learning-result"></div>
      <button class="retry-btn" id="learning-skip">✓ 이미 할 수 있어요 · 다음 문장</button>
    `;

    cardEl.querySelectorAll(".learning-listen .cta-btn").forEach((btn) => {
      btn.addEventListener("click", () => speak(card.text, Number(btn.dataset.rate)));
    });

    // 이미 아는 문장이면 듣기/말하기 없이 바로 다음으로 — 강제로 3단계를 다 거치게 하지 않는다.
    cardEl.querySelector("#learning-skip").addEventListener("click", () => {
      state.learning.greeting.index += 1;
      showCard();
    });

    const micBtn = cardEl.querySelector("#learning-mic");
    if (!micBtn) return;
    const micStatus = cardEl.querySelector("#learning-mic-status");
    const resultEl = cardEl.querySelector("#learning-result");
    const skipBtn = cardEl.querySelector("#learning-skip");

    micBtn.addEventListener("click", () => {
      micStatus.textContent = "듣고 있어요...";
      micBtn.disabled = true;
      activeRecognition = listen(
        (heard) => {
          micBtn.disabled = false;
          micStatus.textContent = "";
          skipBtn.style.display = "none";
          const pct = similarity(heard, card.text);
          const tier = feedbackTier(pct);
          resultEl.innerHTML = `
            <p class="learning-heard">내가 말한 것: "${heard}"</p>
            <p class="learning-feedback tier-${tier}">${TIER_TEXT[tier]}</p>
            <div class="cta"><button class="cta-btn" id="learning-next">${st.index + 1 < N ? "다음 문장" : "완료!"}</button></div>
          `;
          resultEl.querySelector("#learning-next").addEventListener("click", () => {
            state.learning.greeting.index += 1;
            showCard();
          });
        },
        (err) => {
          micBtn.disabled = false;
          micStatus.textContent = "";
          console.error("음성 인식 실패:", err);
          resultEl.innerHTML = `<p class="learning-warn">잘 안 들렸어요. 다시 눌러서 말해볼까요?</p>`;
        }
      );
    });
  }

  showCard();
}
