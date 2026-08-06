// "기초 영어회화" 도구: 목차(챕터 목록) → 챕터 하나(문장 하나씩 듣기 → 말하기 → 결과 반복,
// 기획서 2-2). disc-question과 같은 이유로 챕터 진입 시 화면 골격을 한 번만 그리고, 문장이
// 바뀔 때는 #learning-card 안쪽만 갈아끼운다.
import { app, go, onLeave } from "../../core/router.js";
import { el, bindNav } from "../../core/dom.js";
import { state } from "../../core/state.js";
import { saveLearningProgress } from "../cloud.js";
import { CHAPTERS, LEVEL_LABELS } from "./data.js";
import { scoreSpeech, TIER_TEXT } from "../score.js";
import { supportsSpeech, supportsRecognition, speak, listen } from "../speech.js";
import { practicePrefsMarkup, bindPracticePrefs, sentenceMarkup, koMarkup, bindReveal } from "../prefs.js";

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
        ${CHAPTERS.map((ch) => {
          const desc = Object.keys(LEVEL_LABELS)
            .map((level) => `${LEVEL_LABELS[level]} ${ch.sentences.filter((s) => (s.level || "basic") === level).length}`)
            .join(" · ");
          return `
          <button class="test-card" data-nav="learning-basic-conversation-${ch.id}">
            <div class="icon" style="background:#FF9F45;">${ch.emoji}</div>
            <div class="body">
              <div class="name">${ch.title}</div>
              <div class="desc">${desc}</div>
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

// 챕터를 누르면 먼저 단계(기본/중급/심화)를 고른다(D-73) — 심화로 바로 이어지던 흐름이
// 갑자기 어려워진다는 지적에 중급을 끼워 넣으면서, 세 단계를 한 번에 죽 이어 풀기보다
// 원하는 단계만 골라 반복할 수 있게 했다.
export function renderLevelSelect(chapter) {
  app.appendChild(el(`
    <div>
      <div class="back-row">
        <button class="back-btn" data-nav="learning-basic-conversation">‹</button>
        <div class="back-title">${chapter.title}</div>
      </div>
      <div class="section-title">${chapter.emoji} 단계를 골라주세요</div>
      <div class="test-list">
        ${Object.keys(LEVEL_LABELS).map((level) => {
          const count = chapter.sentences.filter((s) => (s.level || "basic") === level).length;
          return `
          <button class="test-card" data-nav="learning-basic-conversation-${chapter.id}-${level}">
            <div class="icon" style="background:#FF9F45;">${chapter.emoji}</div>
            <div class="body">
              <div class="name">${LEVEL_LABELS[level]}</div>
              <div class="desc">문장 ${count}개</div>
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

export function renderChapter(chapter, level) {
  const sentences = chapter.sentences.filter((s) => (s.level || "basic") === level);
  const N = sentences.length;
  const key = `${chapter.id}-${level}`;
  state.learning[key] ??= { index: 0 };

  let activeRecognition = null;
  onLeave(() => {
    window.speechSynthesis?.cancel();
    activeRecognition?.abort();
  });

  app.appendChild(el(`
    <div class="learning-screen">
      <div class="back-row">
        <button class="back-btn" data-nav="learning-basic-conversation-${chapter.id}">‹</button>
        <div class="back-title" id="learning-title"></div>
      </div>
      <div id="learning-card"></div>
    </div>
  `));

  bindNav(app);

  const titleEl = app.querySelector("#learning-title");
  const cardEl = app.querySelector("#learning-card");
  const levelTitle = `${chapter.title} · ${LEVEL_LABELS[level]}`;

  function showDone() {
    titleEl.textContent = levelTitle;
    cardEl.innerHTML = `
      <div class="empty-state">
        <div class="emoji">🎉</div>
        <div class="msg">문장 ${N}개를 다 배웠어요!</div>
      </div>
      <div class="cta"><button class="cta-btn" id="learning-restart">처음부터 다시 놀기</button></div>
      <button class="retry-btn" id="learning-toc">단계 다시 고르기</button>
    `;
    cardEl.querySelector("#learning-restart").addEventListener("click", () => {
      state.learning[key] = { index: 0 };
      saveLearningProgress();
      showCard();
    });
    cardEl.querySelector("#learning-toc").addEventListener("click", () => go(`learning-basic-conversation-${chapter.id}`));
  }

  function showCard() {
    const st = state.learning[key];
    if (st.index >= N) return showDone();
    const card = sentences[st.index];
    titleEl.textContent = `${levelTitle} (${st.index + 1}/${N})`;
    cardEl.innerHTML = `
      <div class="cover">
        ${level !== "basic" ? `<div class="tag">${LEVEL_LABELS[level]}</div>` : ""}
        ${sentenceMarkup(card.text)}
        ${koMarkup(card.ko, supportsSpeech())}
      </div>
      ${practicePrefsMarkup()}
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
      ${st.index > 0 ? `<button class="retry-btn" id="learning-prev">◀ 이전 문장</button>` : ""}
    `;

    cardEl.querySelector("#learning-prev")?.addEventListener("click", () => {
      state.learning[key].index -= 1;
      saveLearningProgress();
      showCard();
    });

    cardEl.querySelectorAll(".learning-listen .cta-btn").forEach((btn) => {
      btn.addEventListener("click", () => speak(card.text, Number(btn.dataset.rate)));
    });

    // 한글을 아직 못 읽는 어린이도 뜻을 알 수 있게 — 한국어 해석도 읽어준다.
    const listenKo = () => speak(card.ko, 1, "ko-KR");
    cardEl.querySelector("#learning-listen-ko")?.addEventListener("click", listenKo);
    // 가리기/접기 토글 — 누르면 카드를 다시 그린다(설정은 세션 내내 유지된다).
    bindPracticePrefs(cardEl, showCard);
    bindReveal(cardEl, { text: card.text, ko: card.ko, withListenBtn: supportsSpeech(), onListenKo: listenKo });

    // 이미 아는 문장이면 듣기/말하기 없이 바로 다음으로 — 강제로 3단계를 다 거치게 하지 않는다.
    cardEl.querySelector("#learning-skip").addEventListener("click", () => {
      state.learning[key].index += 1;
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
          const { tier, tokens } = scoreSpeech(heard, card.text);
          resultEl.innerHTML = `
            <p class="learning-heard">내가 말한 것: "${heard}"</p>
            <p class="learning-words">${tokens.map((t) => `<span class="${t.ok ? "hit" : "miss"}">${t.text}</span>`).join(" ")}</p>
            <p class="learning-feedback tier-${tier}">${TIER_TEXT[tier]}</p>
            <div class="cta"><button class="cta-btn" id="learning-next">${st.index + 1 < N ? "다음 문장" : "완료!"}</button></div>
            <button class="retry-btn" id="learning-again">🎤 이 문장 다시 말하기</button>
          `;
          // 점수가 낮아도 그 자리에서 다시 시도할 길이 없던 문제(A-4) — 같은 인덱스로 카드를
          // 다시 그리면 마이크·건너뛰기가 처음 상태로 돌아온다.
          resultEl.querySelector("#learning-again").addEventListener("click", showCard);
          resultEl.querySelector("#learning-next").addEventListener("click", () => {
            state.learning[key].index += 1;
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
