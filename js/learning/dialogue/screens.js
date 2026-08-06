// "대화 연습" 도구: 장면 목록 → 장면 하나(상대 대사 ↔ 내 차례가 번갈아 오는 다중 턴 대화).
// elementary-conversation과 같은 in-place 렌더 패턴(화면 골격은 한 번, #learning-card 안쪽만
// 교체)을 쓰지만, 카드가 "문장 하나"가 아니라 "대화의 한 턴"이라는 게 다르다.
//
// 채점: `role: "you"` 턴은 유사도 채점을 하지 않는다(data.js 헤더 참고 — 정답이 여러 개라
// Levenshtein으로 잴 대상이 없다). elementary의 produce 카드와 똑같이 예시 답안(sample)을
// 보여주고 자가평가로 weak 목록만 갱신한다.
import { app, go, onLeave } from "../../core/router.js";
import { el, bindNav } from "../../core/dom.js";
import { state } from "../../core/state.js";
import { saveLearningProgress } from "../cloud.js";
import { SCENES } from "./data.js";
import { supportsSpeech, supportsRecognition, speak, listen } from "../speech.js";
import { recordFallbackMarkup, bindRecordFallback } from "../record.js";
import { markWrong, markCorrect } from "../srs.js";

export function renderDialogueScenes() {
  app.appendChild(el(`
    <div>
      <div class="back-row">
        <button class="back-btn" data-nav="learning-list">‹</button>
        <div class="back-title">대화 연습</div>
      </div>
      <div class="section-title">💬 장면을 골라주세요</div>
      <div class="test-list">
        ${SCENES.map((scene) => {
          const myTurns = scene.turns.filter((t) => t.role === "you").length;
          return `
          <button class="test-card" data-nav="learning-dialogue-${scene.id}">
            <div class="icon" style="background:#7C6BFF;">${scene.emoji}</div>
            <div class="body">
              <div class="name">${scene.title}</div>
              <div class="desc">${scene.desc} · 내 차례 ${myTurns}번</div>
            </div>
            <div class="chevron">›</div>
          </button>
        `;
        }).join("")}
      </div>
    </div>
  `));
  bindNav(app);
}

export function renderDialogueScene(scene) {
  const key = `dialogue-${scene.id}`;
  state.learning[key] ??= { index: 0, weak: {} };
  const st = state.learning[key];
  st.weak ??= {};  // elementary-conversation과 같은 이유(A-5) — 옛 레코드엔 weak가 없다

  const turns = scene.turns;
  const N = turns.length;

  let activeRecognition = null;
  onLeave(() => {
    window.speechSynthesis?.cancel();
    activeRecognition?.abort();
  });

  app.appendChild(el(`
    <div class="learning-screen">
      <div class="back-row">
        <button class="back-btn" data-nav="learning-dialogue">‹</button>
        <div class="back-title" id="learning-title"></div>
      </div>
      <div id="learning-card"></div>
    </div>
  `));
  bindNav(app);

  const titleEl = app.querySelector("#learning-title");
  const cardEl = app.querySelector("#learning-card");

  // elementary-conversation과 같은 SRS 엔트리 형식(D-92).
  function markWeak(i, isWeak) {
    if (isWeak) { st.weak[i] = markWrong(st.weak[i]); return; }
    if (!st.weak[i]) return;
    const next = markCorrect(st.weak[i]);
    if (next) st.weak[i] = next;
    else delete st.weak[i];
  }

  function advance() {
    st.index += 1;
    saveLearningProgress();
    showTurn();
  }

  function prev() {
    if (st.index === 0) return;
    st.index -= 1;
    saveLearningProgress();
    showTurn();
  }

  // 지금까지 오간 대사를 위에 쌓아 보여준다 — 대화는 앞 맥락이 있어야 내 차례에 무슨 말을
  // 할지 정할 수 있어서, 문장 단위 도구처럼 카드 하나만 띄우면 오히려 답을 못 만든다.
  function transcript() {
    const past = turns.slice(0, st.index);
    if (!past.length) return "";
    return `
      <div class="dialogue-log">
        ${past.map((t) => `
          <div class="dialogue-line ${t.role}">
            <span class="who">${t.role === "partner" ? "상대" : "나"}</span>
            <span class="what">${t.role === "partner" ? t.text : (t.said || "…")}</span>
          </div>
        `).join("")}
      </div>`;
  }

  function showDone() {
    titleEl.textContent = scene.title;
    const weakCount = Object.keys(st.weak).length;
    cardEl.innerHTML = `
      ${transcript()}
      <div class="empty-state">
        <div class="emoji">🎉</div>
        <div class="msg">대화를 끝까지 해냈어요!</div>
      </div>
      ${weakCount
        ? `<p class="learning-hint">🔁 다시 연습하고 싶다고 표시한 차례가 ${weakCount}번 있어요.</p>`
        : ""}
      <div class="cta"><button class="cta-btn" id="learning-restart">처음부터 다시 하기</button></div>
      <button class="retry-btn" id="learning-toc">다른 장면 고르기</button>
    `;
    cardEl.querySelector("#learning-restart").addEventListener("click", () => {
      st.index = 0;
      st.weak = {};
      turns.forEach((t) => delete t.said);
      saveLearningProgress();
      showTurn();
    });
    cardEl.querySelector("#learning-toc").addEventListener("click", () => go("learning-dialogue"));
  }

  function showTurn() {
    if (st.index >= N) return showDone();
    const turn = turns[st.index];
    titleEl.textContent = `${scene.title} (${st.index + 1}/${N})`;
    if (turn.role === "partner") showPartnerTurn(turn);
    else showYourTurn(turn);
  }

  function showPartnerTurn(turn) {
    cardEl.innerHTML = `
      ${transcript()}
      <div class="cover">
        <div class="tag">상대</div>
        <h2>${turn.text}</h2>
        <p class="cover-ko">
          ${turn.ko}
          ${supportsSpeech() ? `<button class="ko-listen-btn" id="learning-listen-ko" aria-label="한국어 뜻 듣기">🔊</button>` : ""}
        </p>
      </div>
      ${!supportsSpeech()
        ? `<p class="learning-warn">이 브라우저는 음성 재생을 지원하지 않아요.</p>`
        : `<div class="learning-listen">
             <button class="cta-btn" data-rate="1">🔊 다시 듣기</button>
             <button class="cta-btn" data-rate="0.75">🐢 천천히</button>
           </div>`}
      <div class="cta"><button class="cta-btn" id="learning-next">내 차례로 →</button></div>
      ${st.index > 0 ? `<button class="retry-btn" id="learning-prev">◀ 이전 차례</button>` : ""}
    `;

    cardEl.querySelectorAll(".learning-listen .cta-btn").forEach((btn) => {
      btn.addEventListener("click", () => speak(turn.text, Number(btn.dataset.rate)));
    });
    cardEl.querySelector("#learning-listen-ko")?.addEventListener("click", () => speak(turn.ko, 1, "ko-KR"));
    cardEl.querySelector("#learning-next").addEventListener("click", advance);
    cardEl.querySelector("#learning-prev")?.addEventListener("click", prev);

    // 상대 대사는 실제 대화처럼 먼저 들려야 자연스럽다 — elementary의 produce 카드와 같은 이유.
    if (supportsSpeech()) speak(turn.text, 1);
  }

  function showYourTurn(turn) {
    cardEl.innerHTML = `
      ${transcript()}
      <div class="cover cover-you">
        <div class="tag">내 차례</div>
        <h2>${turn.ko}</h2>
      </div>
      <p class="learning-hint">💡 이렇게 시작해보세요: <b>${turn.hint}</b></p>
      ${!supportsRecognition()
        ? recordFallbackMarkup()
        : `<button class="btn-mic btn-mic-labeled" id="learning-mic">🎤 내 차례 말하기</button>
           <div class="learning-mic-status" id="learning-mic-status"></div>`}
      <div class="learning-result" id="learning-result"></div>
      <button class="retry-btn" id="learning-skip">✓ 건너뛰기</button>
      ${st.index > 0 ? `<button class="retry-btn" id="learning-prev">◀ 이전 차례</button>` : ""}
    `;

    cardEl.querySelector("#learning-skip").addEventListener("click", advance);
    cardEl.querySelector("#learning-prev")?.addEventListener("click", prev);

    const micBtn = cardEl.querySelector("#learning-mic");
    // STT가 없으면(iOS Safari) 녹음-되듣기 폴백으로 대체한다(D-95). 자가평가 결과만
    // 여기서 받아 STT 경로와 똑같이 처리한다.
    if (!micBtn) {
      bindRecordFallback(cardEl, {
        onDone: (ok) => { markWeak(st.index, !ok); advance(); },
      });
      return;
    }
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
          // 내가 말한 걸 대화 기록에 남긴다 — 다음 턴부터 위 로그에 그대로 보인다.
          turn.said = heard;
          resultEl.innerHTML = `
            <p class="learning-heard">내가 말한 것: "${heard}"</p>
            <p class="learning-feedback">이렇게 말할 수도 있어요 — 비슷했나요?</p>
            <ul class="learning-sample-list">${turn.sample.map((s) => `<li>${s}</li>`).join("")}</ul>
            <div class="cta">
              <button class="cta-btn" id="learning-self-good">잘 말했어요</button>
              <button class="cta-btn" id="learning-self-retry">다시 연습할래요</button>
            </div>
          `;
          resultEl.querySelector("#learning-self-good").addEventListener("click", () => {
            markWeak(st.index, false);
            advance();
          });
          resultEl.querySelector("#learning-self-retry").addEventListener("click", () => {
            markWeak(st.index, true);
            advance();
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

  showTurn();
}
