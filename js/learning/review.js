// "오늘 복습" 화면 — 학습 도구 전체에서 오늘 복습할 문장을 모아 한 줄로 돈다(D-92).
//
// 왜 도구별이 아니라 하나로 모으나: 복습은 "어느 챕터를 하고 있었는지"와 무관하게 **오늘
// 해야 할 것**이 단위다. 도구마다 따로 두면 세 군데를 각각 들어가 봐야 오늘 할 일을 알 수
// 있고, 그러면 D-79에서 지적된 "복습 진입로가 사라진다"가 형태만 바꿔 되풀이된다.
//
// 도구를 import하지 않는다 — `listLearning()`으로 등록된 도구를 훑어 각자의
// `resolveReview(key, id)`에게 "이 key/id가 네 것이냐, 그러면 문장이 뭐냐"를 묻는다.
// 홈·마이페이지가 학습 도구를 import하지 않는다는 경계(D-70)를 복습 화면도 그대로 따른다.
import { app, go, onLeave, listLearning } from "../core/router.js";
import { el, bindNav } from "../core/dom.js";
import { state } from "../core/state.js";
import { saveLearningProgress } from "./cloud.js";
import { scoreSpeech, TIER_TEXT } from "./score.js";
import { supportsSpeech, supportsRecognition, speak, listen } from "./speech.js";
import { recordFallbackMarkup, bindRecordFallback } from "./record.js";
import { collectDue, markCorrect, markWrong } from "./srs.js";
import { practicePrefsMarkup, bindPracticePrefs, sentenceMarkup, koMarkup, bindReveal } from "./prefs.js";
import { grammarDetailMarkup } from "./grammar.js";

// 등록된 도구들에게 차례로 물어 첫 번째로 답하는 도구의 결과를 쓴다. 아무도 못 알아보면
// null — 콘텐츠에서 사라진 옛 문장이거나 형식이 바뀐 key다(그런 항목은 목록에서 조용히 뺀다).
function resolve(key, id) {
  for (const tool of listLearning()) {
    const found = tool.resolveReview && tool.resolveReview(key, id);
    if (found) return found;
  }
  return null;
}

export function collectReviewCards(now = Date.now()) {
  return collectDue(state.learning, now)
    .map((item) => ({ ...item, card: resolve(item.key, item.id) }))
    .filter((item) => item.card);
}

export function renderReview() {
  const items = collectReviewCards();
  let index = 0;

  let activeRecognition = null;
  onLeave(() => {
    window.speechSynthesis?.cancel();
    activeRecognition?.abort();
  });

  app.appendChild(el(`
    <div class="learning-screen">
      <div class="back-row">
        <button class="back-btn" data-nav="learning-list">‹</button>
        <div class="back-title" id="learning-title">오늘 복습</div>
      </div>
      <div id="learning-card"></div>
    </div>
  `));
  bindNav(app);

  const titleEl = app.querySelector("#learning-title");
  const cardEl = app.querySelector("#learning-card");

  // 정답/오답을 SRS 일정에 반영한다. 맞히면 다음 칸으로 올리고, 마지막 칸을 넘기면
  // weak에서 지운다(졸업). 틀리면 처음으로 되돌린다.
  function schedule(item, correct) {
    const chapter = state.learning[item.key];
    if (!chapter || !chapter.weak) return;
    const next = correct ? markCorrect(chapter.weak[item.id]) : markWrong(chapter.weak[item.id]);
    if (next) chapter.weak[item.id] = next;
    else delete chapter.weak[item.id];
    saveLearningProgress();
  }

  function advance() {
    index += 1;
    show();
  }

  function showDone() {
    titleEl.textContent = "오늘 복습";
    cardEl.innerHTML = `
      <div class="empty-state">
        <div class="emoji">${items.length ? "🎉" : "☀️"}</div>
        <div class="msg">${items.length ? "오늘 복습을 다 했어요!" : "오늘 복습할 문장이 없어요"}</div>
      </div>
      <p class="learning-hint">${items.length
        ? "맞힌 문장은 다음 복습까지 시간이 더 길어져요. 틀린 문장은 오늘 다시 나와요."
        : "학습을 하다가 헷갈렸던 문장이 생기면 여기 모여요."}</p>
      <div class="cta"><button class="cta-btn" id="learning-toc">학습하러 가기</button></div>
    `;
    cardEl.querySelector("#learning-toc").addEventListener("click", () => go("learning-list"));
  }

  function show() {
    if (index >= items.length) return showDone();
    const item = items[index];
    titleEl.textContent = `오늘 복습 (${index + 1}/${items.length})`;
    if (item.card.type === "produce") showProduce(item);
    else showRepeat(item);
  }

  function showRepeat(item) {
    const { text, ko, where, grammar } = item.card;
    cardEl.innerHTML = `
      <div class="cover">
        <div class="tag">복습</div>
        ${sentenceMarkup(text)}
        ${koMarkup(ko, supportsSpeech())}
      </div>
      ${practicePrefsMarkup()}
      <p class="learning-grammar-focus">📍 ${where}</p>
      ${grammarDetailMarkup(grammar, text, { label: "🔤 문법" })}
      ${!supportsSpeech()
        ? `<p class="learning-warn">이 브라우저는 음성 재생을 지원하지 않아요.</p>`
        : `<div class="learning-listen">
             <button class="cta-btn" data-rate="1">🔊 듣기</button>
             <button class="cta-btn" data-rate="0.75">🐢 천천히</button>
           </div>`}
      ${!supportsRecognition()
        ? recordFallbackMarkup()
        : `<button class="btn-mic" id="learning-mic">🎤</button>
           <div class="learning-mic-status" id="learning-mic-status"></div>`}
      <div class="learning-result" id="learning-result"></div>
      <button class="retry-btn" id="learning-skip">✓ 건너뛰기</button>
    `;

    cardEl.querySelectorAll(".learning-listen .cta-btn").forEach((btn) => {
      btn.addEventListener("click", () => speak(text, Number(btn.dataset.rate)));
    });
    const listenKo = () => speak(ko, 1, "ko-KR");
    cardEl.querySelector("#learning-listen-ko")?.addEventListener("click", listenKo);
    bindPracticePrefs(cardEl, show);
    bindReveal(cardEl, { text, ko, withListenBtn: supportsSpeech(), onListenKo: listenKo });
    // 건너뛰기는 일정을 건드리지 않는다 — 안 풀었으니 맞힌 것도 틀린 것도 아니다.
    cardEl.querySelector("#learning-skip").addEventListener("click", advance);

    const micBtn = cardEl.querySelector("#learning-mic");
    // STT가 없으면(iOS Safari) 녹음-되듣기 폴백으로 대체한다(D-95). 자가평가 결과만
    // 여기서 받아 STT 경로와 똑같이 처리한다.
    if (!micBtn) {
      bindRecordFallback(cardEl, {
        onDone: (ok) => { schedule(item, ok); advance(); },
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
          const { tier, tokens } = scoreSpeech(heard, text);
          schedule(item, tier !== "retry");
          resultEl.innerHTML = `
            <p class="learning-heard">내가 말한 것: "${heard}"</p>
            <p class="learning-words">${tokens.map((t) => `<span class="${t.ok ? "hit" : "miss"}">${t.text}</span>`).join(" ")}</p>
            <p class="learning-feedback tier-${tier}">${TIER_TEXT[tier]}</p>
            <div class="cta"><button class="cta-btn" id="learning-next">${index + 1 < items.length ? "다음 문장" : "완료!"}</button></div>
            <button class="retry-btn" id="learning-again">🎤 이 문장 다시 말하기</button>
          `;
          resultEl.querySelector("#learning-next").addEventListener("click", advance);
          resultEl.querySelector("#learning-again").addEventListener("click", show);
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

  // produce(정답이 여럿) 문장은 여기서도 유사도 채점을 안 한다 — 자가평가가 곧 일정 입력이다.
  function showProduce(item) {
    const { text, where, sample, hint, grammar } = item.card;
    cardEl.innerHTML = `
      <div class="cover cover-you">
        <div class="tag">복습 · 질문</div>
        <h2>${text}</h2>
      </div>
      <p class="learning-grammar-focus">📍 ${where}</p>
      ${grammarDetailMarkup(grammar, "", { label: "🔤 문법" })}
      ${hint ? `<p class="learning-hint">💡 이렇게 시작해보세요: <b>${hint}</b></p>` : ""}
      ${!supportsRecognition()
        ? recordFallbackMarkup()
        : `<button class="btn-mic btn-mic-labeled" id="learning-mic">🎤 내 생각 말하기</button>
           <div class="learning-mic-status" id="learning-mic-status"></div>`}
      <div class="learning-result" id="learning-result"></div>
      <button class="retry-btn" id="learning-skip">✓ 건너뛰기</button>
    `;
    cardEl.querySelector("#learning-skip").addEventListener("click", advance);

    const micBtn = cardEl.querySelector("#learning-mic");
    // STT가 없으면(iOS Safari) 녹음-되듣기 폴백으로 대체한다(D-95). 자가평가 결과만
    // 여기서 받아 STT 경로와 똑같이 처리한다.
    if (!micBtn) {
      bindRecordFallback(cardEl, {
        onDone: (ok) => { schedule(item, ok); advance(); },
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
          // 연습 화면과 같은 문법 형태 자동 확인(D-94).
          const usedForm = grammar && grammar.check ? grammar.check.test(heard) : null;
          resultEl.innerHTML = `
            <p class="learning-heard">내가 말한 것: "${heard}"</p>
            ${usedForm === null ? "" : `<p class="learning-formcheck ${usedForm ? "ok" : "no"}">${
              usedForm
                ? `✅ 오늘의 문법을 잘 넣어 말했어요! (${grammar.kidLabel})`
                : `💡 이번엔 ${grammar.kidLabel}에 도전해볼까요?`
            }</p>`}
            <p class="learning-feedback">이렇게 말할 수도 있어요 — 비슷했나요?</p>
            <ul class="learning-sample-list">${(sample || []).map((s) => `<li>${s}</li>`).join("")}</ul>
            <div class="cta">
              <button class="cta-btn" id="learning-self-good">잘 말했어요</button>
              <button class="cta-btn" id="learning-self-retry">다시 연습할래요</button>
            </div>
          `;
          resultEl.querySelector("#learning-self-good").addEventListener("click", () => {
            schedule(item, true);
            advance();
          });
          resultEl.querySelector("#learning-self-retry").addEventListener("click", () => {
            schedule(item, false);
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

  show();
}

export const reviewScreens = [
  {
    id: "learning-review",
    path: "/learning/review",
    title: "오늘 복습 | 과몰입구역",
    render: renderReview,
    theme: "learning",
  },
];
