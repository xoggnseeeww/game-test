// "기초 영어회화" 도구: 목차(챕터 목록) → 챕터 하나(문장 하나씩 듣기 → 말하기 → 결과 반복,
// 기획서 2-2). disc-question과 같은 이유로 챕터 진입 시 화면 골격을 한 번만 그리고, 문장이
// 바뀔 때는 #learning-card 안쪽만 갈아끼운다.
import { app, go, onLeave } from "../../core/router.js";
import { el, bindNav } from "../../core/dom.js";
import { state } from "../../core/state.js";
import { saveLearningProgress } from "../cloud.js";
import { CHAPTERS } from "./data.js";
import { similarity, feedbackTier, TIER_TEXT } from "./score.js";

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

// 목차 — 심리테스트 목록(renderPsychList)과 같은 카드 목록 패턴을 그대로 쓴다. 챕터가
// 하나뿐이어도 나중에 늘어날 자리를 미리 잡아둔다(데이터에서 자동 생성이라 챕터를
// 추가해도 이 화면은 고칠 필요 없다).
export function renderBasicConversationIntro() {
  app.appendChild(el(`
    <div>
      <div class="back-row">
        <button class="back-btn" data-nav="learning-list">‹</button>
        <div class="back-title">기초 영어회화</div>
      </div>
      <div class="section-title">🔥 목차</div>
      <div class="test-list">
        ${CHAPTERS.map((ch) => `
          <button class="test-card" data-nav="learning-basic-conversation-${ch.id}">
            <div class="icon" style="background:#FF9F45;">${ch.emoji}</div>
            <div class="body">
              <div class="name">${ch.title}</div>
              <div class="desc">문장 ${ch.sentences.length}개</div>
            </div>
            <div class="chevron">›</div>
          </button>
        `).join("")}
      </div>
    </div>
  `));
  bindNav(app);
}

export function renderChapter(chapter) {
  const N = chapter.sentences.length;
  state.learning[chapter.id] ??= { index: 0 };

  let activeRecognition = null;
  onLeave(() => {
    window.speechSynthesis?.cancel();
    activeRecognition?.abort();
  });

  app.appendChild(el(`
    <div class="learning-screen">
      <div class="back-row">
        <button class="back-btn" data-nav="learning-basic-conversation">‹</button>
        <div class="back-title" id="learning-title"></div>
      </div>
      <div id="learning-card"></div>
    </div>
  `));

  bindNav(app);

  const titleEl = app.querySelector("#learning-title");
  const cardEl = app.querySelector("#learning-card");

  function showDone() {
    titleEl.textContent = chapter.title;
    cardEl.innerHTML = `
      <div class="empty-state">
        <div class="emoji">🎉</div>
        <div class="msg">문장 ${N}개를 다 배웠어요!</div>
      </div>
      <div class="cta"><button class="cta-btn" id="learning-restart">처음부터 다시 놀기</button></div>
      <button class="retry-btn" id="learning-toc">목차로 돌아가기</button>
    `;
    cardEl.querySelector("#learning-restart").addEventListener("click", () => {
      state.learning[chapter.id] = { index: 0 };
      saveLearningProgress();
      showCard();
    });
    cardEl.querySelector("#learning-toc").addEventListener("click", () => go("learning-basic-conversation"));
  }

  function showCard() {
    const st = state.learning[chapter.id];
    if (st.index >= N) return showDone();
    const card = chapter.sentences[st.index];
    titleEl.textContent = `${chapter.title} (${st.index + 1}/${N})`;
    cardEl.innerHTML = `
      <div class="cover">
        <h2>${card.text}</h2>
        <p class="cover-ko">${card.ko}</p>
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
      state.learning[chapter.id].index += 1;
      saveLearningProgress();
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
            state.learning[chapter.id].index += 1;
            saveLearningProgress();
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
