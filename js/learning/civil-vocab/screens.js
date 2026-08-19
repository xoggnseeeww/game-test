// "9급 공무원 영단어" 화면 — 목차(스테이지 → DAY)와 DAY 하나의 학습 세션.
//
// 다른 학습 도구와 다른 점이 하나 있다: **데이터가 화면보다 늦게 온다.** 라우터의
// render()는 동기 함수라, 여기서는 골격을 먼저 그리고 loadDay()가 끝나면 카드 자리만
// 채운다(elementary의 in-place 렌더 패턴과 같은 구조에 "불러오는 중" 상태가 하나 더 붙은 것).
// 로딩 중에 화면을 떠날 수 있으므로 onLeave에서 left 플래그를 세워 늦게 온 응답을 버린다 —
// 안 그러면 다른 화면 위에 단어 카드를 그린다(docs/ERRORS.md E-4와 같은 종류의 사고).
import { app, go, onLeave } from "../../core/router.js";
import { el, bindNav } from "../../core/dom.js";
import { state } from "../../core/state.js";
import { speak, supportsSpeech } from "../speech.js";
import { STAGES, DAYS, TOTAL_WORDS } from "./manifest.js";
import { ROOT_BY_ID } from "./roots.js";
import { loadDay } from "./loader.js";
import { makeRng, buildQuiz, primaryMeaning, accuracy } from "./session.js";

function dayState(dayId) {
  state.vocab.days[dayId] ??= { index: 0, best: null, wrong: {} };
  const st = state.vocab.days[dayId];
  // 옛 레코드 방어 — cloud 동기화가 붙는 단계(M3)에서 필드가 늘어날 자리다.
  st.wrong ??= {};
  return st;
}

function dayBadge(day) {
  const st = state.vocab.days[day.id];
  if (!st) return `${day.count}단어 · ${day.theme}`;
  if (st.best !== null) return `${day.count}단어 · 최고 정답률 ${st.best}%`;
  return `${day.count}단어 · 학습 중 (${st.index + 1}번째)`;
}

export function renderVocabIntro() {
  app.appendChild(el(`
    <div>
      <div class="back-row">
        <button class="back-btn" data-nav="learning-list">‹</button>
        <div class="back-title">9급 공무원 영단어</div>
      </div>
      <div class="cover">
        <div class="emoji">📕</div>
        <h2>어원으로 외우는 공무원 영단어</h2>
        <p>단어를 통째로 외우지 않고 <b>접두사 + 어근</b>으로 쪼개서 기억해요.
           지금 준비된 단어 ${TOTAL_WORDS}개 · DAY ${DAYS.length}개.</p>
      </div>
      ${STAGES.map((stage) => `
        <div class="section-title">${stage.emoji} ${stage.label}</div>
        <div class="test-list">
          ${stage.days.map((day) => `
            <button class="test-card" data-nav="learning-civil-vocab-${day.id}">
              <div class="icon" style="background:#2F6FED;">${day.label.replace("DAY ", "")}</div>
              <div class="body">
                <div class="name">${day.label} · ${day.theme}</div>
                <div class="desc">${dayBadge(day)}</div>
              </div>
              <div class="chevron">›</div>
            </button>
          `).join("")}
        </div>
      `).join("")}
      <p class="learning-warn">지금은 진행 상황이 이 브라우저 세션에만 남아요 — 계정별 저장은 준비 중이에요.</p>
    </div>
  `));
  bindNav(app);
}

// 어근 칩. 사전(roots.js)에 없는 id면 조용히 빼지 않고 id를 그대로 보여준다 —
// 테스트가 먼저 잡아주지만, 화면에서도 "뭔가 빠졌다"가 보이는 편이 낫다.
function rootChips(word) {
  if (!word.roots || word.roots.length === 0) return "";
  return `
    <div class="vocab-roots">
      ${word.roots.map((id) => {
        const root = ROOT_BY_ID.get(id);
        return `<span class="root-chip"><b>${root ? root.form : id}</b>${root ? ` ${root.ko}` : ""}</span>`;
      }).join("")}
    </div>`;
}

export function renderVocabDay(day) {
  const st = dayState(day.id);
  let left = false;
  onLeave(() => {
    left = true;
    window.speechSynthesis?.cancel();
  });

  app.appendChild(el(`
    <div class="learning-screen">
      <div class="back-row">
        <button class="back-btn" data-nav="learning-civil-vocab">‹</button>
        <div class="back-title" id="vocab-title">${day.label}</div>
      </div>
      <div id="vocab-card">
        <div class="empty-state">
          <div class="emoji">📖</div>
          <div class="msg">단어를 불러오는 중이에요…</div>
        </div>
      </div>
    </div>
  `));
  bindNav(app);

  const titleEl = app.querySelector("#vocab-title");
  const cardEl = app.querySelector("#vocab-card");

  loadDay(day.id).then((words) => {
    if (left) return;   // 로딩 도중 다른 화면으로 떠났으면 아무것도 그리지 않는다
    run(words);
  }).catch((err) => {
    console.error("단어 데이터를 불러오지 못했다", err);
    if (left) return;
    cardEl.innerHTML = `
      <div class="empty-state">
        <div class="emoji">⚠️</div>
        <div class="msg">단어를 불러오지 못했어요<br/>잠시 후 다시 시도해 주세요</div>
      </div>
      <div class="cta"><button class="cta-btn" id="vocab-retry">목록으로 돌아가기</button></div>`;
    cardEl.querySelector("#vocab-retry").addEventListener("click", () => go("learning-civil-vocab"));
  });

  function run(words) {
    let quiz = null;
    let qIndex = 0;
    let right = 0;
    // 카드로 다시 보기 모드(틀린 단어만). 라우터를 타지 않는 일시적 상태라 새 주소를 만들지
    // 않는다 — elementary의 "헷갈렸던 문장만 복습하기"와 같은 판단.
    let cards = words;

    function showCard() {
      if (st.index >= cards.length) return showQuizIntro();
      const word = cards[st.index];
      titleEl.textContent = `${day.label} · 단어 익히기`;
      cardEl.innerHTML = `
        <div class="progress-row">
          <div class="progress-track"><div class="progress-fill" style="width:${((st.index + 1) / cards.length) * 100}%"></div></div>
          <div class="progress-count">${st.index + 1}<span class="total">/${cards.length}</span></div>
        </div>
        <div class="cover">
          <div class="tag">${word.pos}</div>
          <h2 class="vocab-word">${word.word}</h2>
          <p class="cover-ko">${word.ko.join(" · ")}</p>
        </div>
        ${supportsSpeech() ? `<div class="learning-listen"><button class="cta-btn" id="vocab-listen">🔊 발음 듣기</button></div>` : ""}
        <div class="vocab-detail">
          ${rootChips(word)}
          <p class="vocab-hint">🧠 ${word.hint}</p>
          ${word.sound ? `<p class="vocab-sound">🔤 ${word.sound}</p>` : ""}
          <p class="vocab-ex">${word.ex.en}<span>${word.ex.ko}</span></p>
          ${word.syn && word.syn.length ? `<p class="vocab-syn">비슷한 말 · ${word.syn.join(", ")}</p>` : ""}
        </div>
        <div class="cta"><button class="cta-btn" id="vocab-next">${st.index + 1 === cards.length ? "확인 문제 풀기 →" : "다음 단어"}</button></div>
        ${st.index > 0 ? `<button class="retry-btn" id="vocab-prev">◀ 이전 단어</button>` : ""}
      `;
      cardEl.querySelector("#vocab-listen")?.addEventListener("click", () => speak(word.word, 1));
      cardEl.querySelector("#vocab-next").addEventListener("click", () => {
        st.index += 1;
        showCard();
      });
      cardEl.querySelector("#vocab-prev")?.addEventListener("click", () => {
        st.index -= 1;
        showCard();
      });
    }

    function showQuizIntro() {
      titleEl.textContent = `${day.label} · 확인 문제`;
      cardEl.innerHTML = `
        <div class="empty-state">
          <div class="emoji">✅</div>
          <div class="msg">${cards.length}단어를 다 봤어요!<br/>이제 뜻을 맞혀볼까요?</div>
        </div>
        <div class="cta"><button class="cta-btn" id="vocab-quiz-start">확인 문제 풀기</button></div>
        <button class="retry-btn" id="vocab-again">단어 카드 다시 보기</button>
      `;
      cardEl.querySelector("#vocab-quiz-start").addEventListener("click", () => startQuiz());
      cardEl.querySelector("#vocab-again").addEventListener("click", () => {
        st.index = 0;
        showCard();
      });
    }

    function startQuiz() {
      quiz = buildQuiz(cards, makeRng(Date.now()));
      qIndex = 0;
      right = 0;
      st.wrong = {};
      showQuestion();
    }

    function showQuestion() {
      if (qIndex >= quiz.length) return showDone();
      const q = quiz[qIndex];
      titleEl.textContent = `${day.label} · 확인 문제`;
      cardEl.innerHTML = `
        <div class="progress-row">
          <div class="progress-track"><div class="progress-fill" style="width:${((qIndex + 1) / quiz.length) * 100}%"></div></div>
          <div class="progress-count">${qIndex + 1}<span class="total">/${quiz.length}</span></div>
        </div>
        <div class="question-block">
          <div class="qno">뜻을 고르세요</div>
          <h2>${q.word}</h2>
        </div>
        <div class="options">
          ${q.options.map((text, i) => `
            <button class="option-btn vocab-choice" data-choice="${i}">
              <span class="dot"></span>${text}
            </button>
          `).join("")}
        </div>
        <div id="vocab-after"></div>
      `;
      const buttons = [...cardEl.querySelectorAll(".vocab-choice")];
      buttons.forEach((btn) => btn.addEventListener("click", () => pick(Number(btn.dataset.choice), q, buttons)));
    }

    function pick(choice, q, buttons) {
      const correct = choice === q.answerIndex;
      if (correct) right += 1;
      else st.wrong[q.id] = true;
      buttons.forEach((btn, i) => {
        btn.disabled = true;
        if (i === q.answerIndex) btn.classList.add("choice-ok");
        else if (i === choice) btn.classList.add("choice-no");
      });
      cardEl.querySelector("#vocab-after").innerHTML = `
        <p class="learning-feedback ${correct ? "tier-perfect" : "tier-retry"}">${correct ? "정답이에요!" : `정답은 "${q.answer}"예요`}</p>
        <div class="cta"><button class="cta-btn" id="vocab-next-q">${qIndex + 1 === quiz.length ? "결과 보기" : "다음 문제"}</button></div>
      `;
      cardEl.querySelector("#vocab-next-q").addEventListener("click", () => {
        qIndex += 1;
        showQuestion();
      });
    }

    function showDone() {
      const pct = accuracy(right, quiz.length);
      if (st.best === null || pct > st.best) st.best = pct;
      const wrongWords = words.filter((w) => st.wrong[w.id]);
      titleEl.textContent = `${day.label} · 결과`;
      cardEl.innerHTML = `
        <div class="empty-state">
          <div class="emoji">${pct === 100 ? "🎉" : "📊"}</div>
          <div class="msg">정답률 ${pct}%<br/>${right}/${quiz.length} 맞혔어요</div>
        </div>
        ${wrongWords.length
          ? `<p class="vocab-wrong-list">틀린 단어 · ${wrongWords.map((w) => `${w.word}(${primaryMeaning(w)})`).join(", ")}</p>
             <div class="cta"><button class="cta-btn" id="vocab-review-wrong">🔁 틀린 단어만 다시 보기</button></div>`
          : ""}
        <div class="cta"><button class="cta-btn" id="vocab-retry-quiz">확인 문제 다시 풀기</button></div>
        <button class="retry-btn" id="vocab-toc">DAY 목록으로</button>
      `;
      cardEl.querySelector("#vocab-review-wrong")?.addEventListener("click", () => {
        cards = wrongWords;
        st.index = 0;
        showCard();
      });
      cardEl.querySelector("#vocab-retry-quiz").addEventListener("click", () => {
        cards = words;
        startQuiz();
      });
      cardEl.querySelector("#vocab-toc").addEventListener("click", () => go("learning-civil-vocab"));
    }

    // 이전 세션에서 끝까지 봤던 DAY로 다시 들어오면 카드 첫 장부터 다시 시작한다 —
    // 마지막 장 다음(= 문제 안내)으로 곧장 떨어지면 "뒤로 왔더니 문제부터 나온다"가 된다.
    if (st.index >= words.length) st.index = 0;
    showCard();
  }
}
