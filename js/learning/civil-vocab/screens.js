// "9급 공무원 영단어" 화면 — 목차(스테이지 → DAY) · DAY 학습 세션 · 오늘 복습 큐.
//
// 다른 학습 도구와 다른 점 하나: **데이터가 화면보다 늦게 온다.** 라우터의 render()는 동기
// 함수라, 여기서는 골격을 먼저 그리고 loadDay()가 끝나면 카드 자리만 채운다. 로딩 중에 화면을
// 떠날 수 있으므로 onLeave에서 left 플래그를 세워 늦게 온 응답을 버린다 — 안 그러면 다른 화면
// 위에 단어 카드를 그린다(docs/ERRORS.md E-4와 같은 종류의 사고).
//
// 학습 방식은 D-99에서 세 가지가 바뀌었다(효율성 검토 결과):
//  1. **뜻·어원 지연 노출** — 카드 앞면은 단어만. 떠올려 본 뒤 뒤집는다(능동 인출).
//  2. **빈칸 채우기** — 예문에서 표제어를 지운 산출 문제(콘텐츠 추가 0).
//  3. **간격 반복** — 모든 응답이 srs.js 일정에 들어가고, "오늘 복습"이 그 일정을 돈다.
import { app, go, onLeave } from "../../core/router.js";
import { el, bindNav } from "../../core/dom.js";
import { state } from "../../core/state.js";
import { speak, supportsSpeech } from "../speech.js";
import { STAGES, DAYS, TOTAL_WORDS, DEFAULT_NEW_PER_DAY, NEW_PER_DAY_OPTIONS, normalizeNewPerDay } from "./manifest.js";
import { ROOT_BY_ID } from "./roots.js";
import { loadDay, dayIdOf } from "./loader.js";
import {
  makeRng, buildQuiz, makeQuestion, primaryMeaning, accuracy,
  makeCloze, checkCloze, buildDailyQueue, retrievalMode,
} from "./session.js";
import { schedule, dueIds, summarize, countNewToday } from "./srs.js";
import { queueVocabSave, flushVocabSave, saveVocabSettings } from "./cloud.js";
import { onLearningSync } from "../cloud.js";

// ── 상태 헬퍼 ───────────────────────────────────────────────────────────────
// state.vocab의 기본값 중 **도구가 정하는 것**은 여기서 채운다 — core/state.js가
// manifest.js를 import하면 "core는 학습 콘텐츠를 모른다"는 의존 방향이 뒤집힌다.
function ensureVocabState() {
  state.vocab.newPerDay = normalizeNewPerDay(state.vocab.newPerDay ?? DEFAULT_NEW_PER_DAY);
  return state.vocab;
}
function dayState(dayId) {
  state.vocab.days[dayId] ??= { index: 0, best: null, wrong: {} };
  const st = state.vocab.days[dayId];
  st.wrong ??= {};   // 필드가 늘어날 자리(M3 계정 저장) — 옛 레코드 방어
  return st;
}

// 단어별 SRS 이력. 예전에는 회차가 끝날 때마다 초기화돼서 "무엇이 반복해서 약한지"가 남지
// 않았다(효율성 검토 #4) — 이제 응답 하나하나가 여기 누적된다.
function gradeWord(wordId, grade) {
  const entry = schedule(state.vocab.cards[wordId], grade);
  state.vocab.cards[wordId] = entry;
  // 로그인했으면 계정에 남긴다(D-100). 비로그인이면 큐에 쌓였다가 그냥 버려진다 —
  // 화면은 로그인 여부를 몰라도 되고, 판단은 cloud.js 한 곳에서만 한다.
  queueVocabSave(wordId, entry);
}

function entryOf(wordId) {
  return state.vocab.cards[wordId];
}

// ── 공용 마크업 ─────────────────────────────────────────────────────────────
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

function progressMarkup(index, total) {
  return `
    <div class="progress-row">
      <div class="progress-track"><div class="progress-fill" style="width:${((index + 1) / total) * 100}%"></div></div>
      <div class="progress-count">${index + 1}<span class="total">/${total}</span></div>
    </div>`;
}

function listenMarkup() {
  return supportsSpeech() ? `<div class="learning-listen"><button class="cta-btn" id="vocab-listen">🔊 발음 듣기</button></div>` : "";
}

// 단어 카드. revealed=false면 **단어와 품사만** 보여준다 — 뜻·어원·예문을 정답과 함께 깔아두면
// 읽고 나서 "안다"고 느끼지만 실제로는 떠올려본 적이 없다(유창성 착각). 강제하지는 않고
// 토글로 끌 수 있다(D-61·D-93과 같은 판단 — 처음 보는 단어는 그냥 읽는 게 맞을 때도 있다).
function studyCardMarkup(word, revealed) {
  return `
    <div class="practice-prefs">
      <button class="pref-toggle ${state.vocab.prefs.recall ? "on" : ""}" id="vocab-pref-recall">
        ${state.vocab.prefs.recall ? "🙈 뜻 먼저 떠올리기 켜짐" : "👀 뜻 먼저 떠올리기 꺼짐"}
      </button>
    </div>
    <div class="cover">
      <div class="tag">${word.pos}</div>
      <h2 class="vocab-word">${word.word}</h2>
      ${revealed ? `<p class="cover-ko">${word.ko.join(" · ")}</p>` : `<p class="cover-ko vocab-veil">뜻을 떠올려 보세요</p>`}
    </div>
    ${listenMarkup()}
    ${revealed ? `
      <div class="vocab-detail">
        ${rootChips(word)}
        <p class="vocab-hint">🧠 ${word.hint}</p>
        ${word.sound ? `<p class="vocab-sound">🔤 ${word.sound}</p>` : ""}
        <p class="vocab-ex">${word.ex.en}<span>${word.ex.ko}</span></p>
        ${word.syn && word.syn.length ? `<p class="vocab-syn">비슷한 말 · ${word.syn.join(", ")}</p>` : ""}
      </div>` : ""}
  `;
}

function choiceMarkup(q) {
  return `
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
    <div id="vocab-after"></div>`;
}

function clozeMarkup(cloze) {
  return `
    <div class="question-block">
      <div class="qno">빈칸에 알맞은 단어를 쓰세요</div>
      <h2 class="vocab-cloze-ko">${cloze.meaning}</h2>
    </div>
    <div class="vocab-detail">
      <p class="vocab-cloze-sentence">${cloze.sentence}</p>
      <p class="vocab-ex"><span>${cloze.ko}</span></p>
      <p class="vocab-shape">${cloze.shape}</p>
    </div>
    <div class="vocab-input-row">
      <!-- 모바일 키보드가 첫 글자를 대문자로 바꾸거나 자동 교정하면 철자 연습이 성립하지
           않는다. inputmode는 넣지 않는다(latin은 지금 명세에 없는 값이다). -->
      <input class="vocab-input" id="vocab-cloze-input" type="text"
             autocomplete="off" autocapitalize="none" autocorrect="off" spellcheck="false" placeholder="영어로 입력" />
      <button class="cta-btn" id="vocab-cloze-submit">확인</button>
    </div>
    <div id="vocab-after"></div>`;
}

// ── 목차 화면 ───────────────────────────────────────────────────────────────
function dayBadge(day) {
  const st = state.vocab.days[day.id];
  if (!st) return `${day.count}단어 · ${day.theme}`;
  if (st.best !== null) return `${day.count}단어 · 최고 정답률 ${st.best}%`;
  // 카드를 끝까지 본 상태(index === count)에서 그대로 +1하면 "51번째"가 된다.
  return `${day.count}단어 · 학습 중 (${Math.min(st.index + 1, day.count)}번째)`;
}

export function renderVocabIntro() {
  ensureVocabState();
  const stats = summarize(state.vocab.cards);
  // 오늘 새로 시작할 수 있는 단어 수 = (하루 상한 − 오늘 이미 시작한 수)와 아직 안 만난 단어 중
  // 작은 쪽. 상한을 "큐를 만들 때마다"가 아니라 **오늘 하루 기준**으로 적용해야 한다(D-101).
  const newTodayCount = Math.max(0, Math.min(
    state.vocab.newPerDay - countNewToday(state.vocab.cards),
    TOTAL_WORDS - stats.seen
  ));
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
      <div class="section-title">📅 오늘 학습</div>
      <div class="test-list">
        <button class="test-card" data-nav="learning-civil-vocab-today">
          <div class="icon" style="background:#E8642E;">📅</div>
          <div class="body">
            <div class="name">오늘 학습 시작하기</div>
            <div class="desc">다시 볼 단어 ${stats.due}개 · 새 단어 ${newTodayCount}개</div>
          </div>
          <div class="chevron">›</div>
        </button>
      </div>
      <p class="learning-warn">
        <b>DAY</b>는 단어를 처음 훑는 곳이고, <b>오늘 학습</b>은 그렇게 만난 단어를 날짜를 두고
        다시 만나는 곳이에요. 오늘 본 단어는 내일부터 차례로 다시 올라와요(맞힐수록 간격이 길어져요).
      </p>
      ${stats.seen > 0 ? `<p class="learning-warn">지금까지 만난 단어 ${stats.seen}개 · 일정에 올라간 단어 ${stats.learned}개${stats.leech > 0 ? ` · 자꾸 틀리는 단어 ${stats.leech}개` : ""}</p>` : ""}
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
      <div class="section-title">⚙️ 하루 목표</div>
      <div class="vocab-goal-row">
        ${NEW_PER_DAY_OPTIONS.map((n) => `
          <button class="pref-toggle ${state.vocab.newPerDay === n ? "on" : ""}" data-goal="${n}">${n}</button>
        `).join("")}
      </div>
      <p class="learning-warn">하루에 <b>새로</b> 시작할 단어 수예요(복습은 여기에 안 들어가요).
         이 값이 코스 속도를 정해요 — 지금 목표라면 ${TOTAL_WORDS}단어를 ${Math.ceil(TOTAL_WORDS / state.vocab.newPerDay)}일에 한 바퀴 돌아요.</p>
      <p class="learning-warn">로그인하면 이 일정과 목표가 계정에 저장돼 다른 기기에서도 이어져요.</p>
    </div>
  `));
  bindNav(app);
  app.querySelectorAll("[data-goal]").forEach((btn) => btn.addEventListener("click", () => {
    state.vocab.newPerDay = normalizeNewPerDay(btn.dataset.goal);
    saveVocabSettings();
    app.innerHTML = "";
    renderVocabIntro();
  }));
  // 로그인 동기화는 화면이 그려진 뒤에 끝난다 — 그때 다시 그리지 않으면 방금 로그인한
  // 사용자에게 "만난 단어 0개"가 계속 보인다(D-101).
  onLeave(onLearningSync(() => {
    app.innerHTML = "";
    renderVocabIntro();
  }));
}

// 로딩·에러 골격을 두 화면(DAY 세션·오늘 복습)이 같이 쓴다.
function renderShell(title, backScreen) {
  app.appendChild(el(`
    <div class="learning-screen">
      <div class="back-row">
        <button class="back-btn" data-nav="${backScreen}">‹</button>
        <div class="back-title" id="vocab-title">${title}</div>
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
  return { titleEl: app.querySelector("#vocab-title"), cardEl: app.querySelector("#vocab-card") };
}

function showLoadError(cardEl, err) {
  console.error("단어 데이터를 불러오지 못했다", err);
  cardEl.innerHTML = `
    <div class="empty-state">
      <div class="emoji">⚠️</div>
      <div class="msg">단어를 불러오지 못했어요<br/>잠시 후 다시 시도해 주세요</div>
    </div>
    <div class="cta"><button class="cta-btn" id="vocab-retry">목록으로 돌아가기</button></div>`;
  cardEl.querySelector("#vocab-retry").addEventListener("click", () => go("learning-civil-vocab"));
}

// ── DAY 세션 ────────────────────────────────────────────────────────────────
export function renderVocabDay(day) {
  ensureVocabState();
  const st = dayState(day.id);
  let left = false;
  onLeave(() => {
    left = true;
    window.speechSynthesis?.cancel();
    flushVocabSave();   // 모아둔 응답을 화면을 뜨기 전에 넘긴다
  });

  const { titleEl, cardEl } = renderShell(day.label, "learning-civil-vocab");

  loadDay(day.id)
    .then((words) => { if (!left) run(words); })
    .catch((err) => { if (!left) showLoadError(cardEl, err); });

  function run(words) {
    let quiz = null;
    let qIndex = 0;
    let right = 0;
    let cards = words;          // "틀린 단어만 다시 보기"에서 부분 집합으로 바뀐다
    let revealed = false;

    function showCard() {
      if (st.index >= cards.length) return showQuizIntro();
      const word = cards[st.index];
      const isOpen = revealed || !state.vocab.prefs.recall;
      titleEl.textContent = `${day.label} · 단어 익히기`;
      cardEl.innerHTML = `
        ${progressMarkup(st.index, cards.length)}
        ${studyCardMarkup(word, isOpen)}
        ${isOpen
          ? `<div class="vocab-grade-row">
               <button class="cta-btn vocab-grade-again" id="vocab-again">😅 헷갈려요</button>
               <button class="cta-btn" id="vocab-good">👍 알겠어요</button>
             </div>`
          : `<div class="cta"><button class="cta-btn" id="vocab-reveal">뜻 확인하기</button></div>`}
        ${st.index > 0 ? `<button class="retry-btn" id="vocab-prev">◀ 이전 단어</button>` : ""}
      `;
      cardEl.querySelector("#vocab-listen")?.addEventListener("click", () => speak(word.word, 1));
      cardEl.querySelector("#vocab-pref-recall").addEventListener("click", () => {
        state.vocab.prefs.recall = !state.vocab.prefs.recall;
        showCard();
      });
      cardEl.querySelector("#vocab-reveal")?.addEventListener("click", () => {
        revealed = true;
        showCard();
      });
      cardEl.querySelector("#vocab-good")?.addEventListener("click", () => next("good"));
      cardEl.querySelector("#vocab-again")?.addEventListener("click", () => next("again"));
      cardEl.querySelector("#vocab-prev")?.addEventListener("click", () => {
        st.index -= 1;
        revealed = false;
        showCard();
      });
    }

    function next(grade) {
      gradeWord(cards[st.index].id, grade);
      st.index += 1;
      revealed = false;
      showCard();
    }

    function showQuizIntro() {
      titleEl.textContent = `${day.label} · 확인 문제`;
      cardEl.innerHTML = `
        <div class="empty-state">
          <div class="emoji">✅</div>
          <div class="msg">${cards.length}단어를 다 봤어요!<br/>이제 뜻을 맞혀볼까요?</div>
        </div>
        <div class="cta"><button class="cta-btn" id="vocab-quiz-start">확인 문제 풀기</button></div>
        <button class="retry-btn" id="vocab-again-cards">단어 카드 다시 보기</button>
      `;
      cardEl.querySelector("#vocab-quiz-start").addEventListener("click", () => startQuiz());
      cardEl.querySelector("#vocab-again-cards").addEventListener("click", () => {
        st.index = 0;
        revealed = false;
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
      cardEl.innerHTML = progressMarkup(qIndex, quiz.length) + choiceMarkup(q);
      const buttons = [...cardEl.querySelectorAll(".vocab-choice")];
      buttons.forEach((btn) => btn.addEventListener("click", () => pick(Number(btn.dataset.choice), q, buttons)));
    }

    function pick(choice, q, buttons) {
      const correct = choice === q.answerIndex;
      if (correct) right += 1;
      else st.wrong[q.id] = true;
      gradeWord(q.id, correct ? "good" : "again");
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
      // "틀린 단어만 다시 보기" 뒤에 푼 회차는 문제지가 그 몇 개뿐이라, 여기서 best를 갱신하면
      // 3단어 100%가 DAY 전체의 "최고 정답률 100%"로 남는다 — 전체를 푼 회차에서만 기록한다.
      const fullRun = quiz.length === words.length;
      if (fullRun && (st.best === null || pct > st.best)) st.best = pct;
      const wrongWords = words.filter((w) => st.wrong[w.id]);
      titleEl.textContent = `${day.label} · 결과`;
      cardEl.innerHTML = `
        <div class="empty-state">
          <div class="emoji">${pct === 100 ? "🎉" : "📊"}</div>
          <div class="msg">정답률 ${pct}%<br/>${right}/${quiz.length} 맞혔어요</div>
        </div>
        ${fullRun ? "" : `<p class="learning-warn">복습 회차라 기록에는 남기지 않아요 — 최고 정답률은 전체를 풀 때만 갱신돼요.</p>`}
        ${wrongWords.length
          ? `<p class="vocab-wrong-list">틀린 단어 · ${wrongWords.map((w) => `${w.word}(${primaryMeaning(w)})`).join(", ")}</p>
             <div class="cta"><button class="cta-btn" id="vocab-review-wrong">🔁 틀린 단어만 다시 보기</button></div>`
          : ""}
        <div class="cta"><button class="cta-btn" id="vocab-cloze-start">✍️ 빈칸 채우기(철자)</button></div>
        <div class="cta"><button class="cta-btn" id="vocab-retry-quiz">확인 문제 다시 풀기</button></div>
        <button class="retry-btn" id="vocab-toc">DAY 목록으로</button>
      `;
      cardEl.querySelector("#vocab-review-wrong")?.addEventListener("click", () => {
        cards = wrongWords;
        st.index = 0;
        revealed = false;
        showCard();
      });
      cardEl.querySelector("#vocab-cloze-start").addEventListener("click", () => startCloze(cards));
      cardEl.querySelector("#vocab-retry-quiz").addEventListener("click", () => {
        cards = words;
        startQuiz();
      });
      cardEl.querySelector("#vocab-toc").addEventListener("click", () => go("learning-civil-vocab"));
    }

    // 빈칸 채우기 — 4지선다(재인)만으로는 "보기 중에 고르기"에서 끝난다. 같은 단어를 예문
    // 안에서 직접 써 보게 하는 단계(콘텐츠 추가 없이 예문에서 표제어만 지운 것).
    function startCloze(list) {
      const items = list.map((word) => ({ word, cloze: makeCloze(word) })).filter((it) => it.cloze);
      let i = 0;
      let correctCount = 0;

      function show() {
        if (i >= items.length) return showClozeDone();
        const { word, cloze } = items[i];
        titleEl.textContent = `${day.label} · 빈칸 채우기`;
        cardEl.innerHTML = progressMarkup(i, items.length) + clozeMarkup(cloze);
        const input = cardEl.querySelector("#vocab-cloze-input");
        const submit = () => grade(word, cloze, input.value);
        cardEl.querySelector("#vocab-cloze-submit").addEventListener("click", submit);
        input.addEventListener("keydown", (e) => {
          if (e.key === "Enter") submit();
        });
        input.focus();
      }

      function grade(word, cloze, value) {
        const correct = checkCloze(cloze, value, word);
        if (correct) correctCount += 1;
        gradeWord(word.id, correct ? "good" : "again");
        cardEl.querySelector("#vocab-cloze-input").disabled = true;
        cardEl.querySelector("#vocab-cloze-submit").disabled = true;
        cardEl.querySelector("#vocab-after").innerHTML = `
          <p class="learning-feedback ${correct ? "tier-perfect" : "tier-retry"}">${correct ? "정답이에요!" : `정답은 "${cloze.answer}"예요`}</p>
          <p class="vocab-ex">${word.ex.en}<span>${word.ex.ko}</span></p>
          <div class="cta"><button class="cta-btn" id="vocab-next-cloze">${i + 1 === items.length ? "결과 보기" : "다음 문제"}</button></div>
        `;
        cardEl.querySelector("#vocab-next-cloze").addEventListener("click", () => {
          i += 1;
          show();
        });
      }

      function showClozeDone() {
        titleEl.textContent = `${day.label} · 빈칸 결과`;
        cardEl.innerHTML = `
          <div class="empty-state">
            <div class="emoji">✍️</div>
            <div class="msg">정답률 ${accuracy(correctCount, items.length)}%<br/>${correctCount}/${items.length} 맞혔어요</div>
          </div>
          <div class="cta"><button class="cta-btn" id="vocab-cloze-retry">다시 풀기</button></div>
          <button class="retry-btn" id="vocab-toc2">DAY 목록으로</button>
        `;
        cardEl.querySelector("#vocab-cloze-retry").addEventListener("click", () => startCloze(list));
        cardEl.querySelector("#vocab-toc2").addEventListener("click", () => go("learning-civil-vocab"));
      }

      show();
    }

    // 이전 세션에서 끝까지 봤던 DAY로 다시 들어오면 카드 첫 장부터 다시 시작한다 —
    // 마지막 장 다음(= 문제 안내)으로 곧장 떨어지면 "뒤로 왔더니 문제부터 나온다"가 된다.
    if (st.index >= words.length) st.index = 0;
    showCard();
  }
}

// ── 오늘 복습 큐 ────────────────────────────────────────────────────────────
// 여기가 이 도구의 본체다. DAY 화면은 "처음 훑는 곳"이고, 기억에 남기는 일은 날짜를 두고
// 다시 만나는 이 화면에서 일어난다(효율성 검토 #1).
export function renderVocabToday() {
  ensureVocabState();
  let left = false;
  onLeave(() => {
    left = true;
    window.speechSynthesis?.cancel();
    flushVocabSave();
  });

  const { titleEl, cardEl } = renderShell("오늘 학습", "learning-civil-vocab");

  collectToday()
    .then((data) => { if (!left) run(data); })
    .catch((err) => { if (!left) showLoadError(cardEl, err); });

  function run({ queue, poolByDay, dueCount, newCount }) {
    // 오늘 큐에 들어온 단어는 **맞힐 때까지** 다시 나온다(사용자 요청). 예전에는 같은 세션
    // 재노출을 두 번으로 막았는데, 그러면 못 외운 단어를 남긴 채 화면이 끝나서 "오늘 학습"이
    // 무엇을 끝낸 건지 알 수 없었다. 대신 두 가지를 함께 뒀다:
    //  - 틀린 항목은 **바로 다음이 아니라 몇 장 뒤**에 끼워 넣는다(바로 다시 물으면 답을
    //    외운 게 아니라 방금 본 걸 기억하는 것이다)
    //  - 언제든 "오늘은 여기까지"로 끝낼 수 있다(모르는 단어에 갇히지 않게)
    const REINSERT_AFTER = 3;
    if (queue.length === 0) {
      titleEl.textContent = "오늘 학습";
      const stats = summarize(state.vocab.cards);
      const startedToday = countNewToday(state.vocab.cards);
      let why;
      if (stats.seen === 0) why = "아직 시작한 단어가 없어요. 아래에서 DAY를 골라 첫 단어부터 만나보세요.";
      else if (startedToday >= state.vocab.newPerDay) why = `오늘 새 단어 몫(${state.vocab.newPerDay}개)을 다 했어요. 지금까지 만난 단어 ${stats.seen}개는 각자 정해진 날짜에 다시 올라와요 — 방금 본 단어가 바로 다시 안 나오는 건 그래서예요.`;
      else why = `오늘 몫은 끝났어요. 지금까지 만난 단어 ${stats.seen}개는 각자 정해진 날짜에 다시 올라와요 — 방금 본 단어가 바로 다시 안 나오는 건 그래서예요.`;
      cardEl.innerHTML = `
        <div class="empty-state">
          <div class="emoji">🌱</div>
          <div class="msg">오늘 볼 단어가 없어요</div>
        </div>
        <p class="learning-warn">${why}</p>
        <div class="cta"><button class="cta-btn" id="vocab-go-days">DAY 목록으로</button></div>`;
      cardEl.querySelector("#vocab-go-days").addEventListener("click", () => go("learning-civil-vocab"));
      return;
    }

    let done = 0;
    let revealed = false;

    function poolOf(word) {
      return poolByDay.get(dayIdOf(word.id)) || [word];
    }

    // 지금 카드가 "처음 보는 단어"인지 "다시 만나는 단어"인지 한 줄로 알린다.
    function itemBadge(item, word) {
      if (item.kind === "new") return "🌱 처음 만나는 단어";
      if (item.kind === "again") return "🔁 방금 헷갈린 단어 — 다시 한 번";
      const reps = entryOf(word.id)?.reps || 0;
      return `📅 다시 만난 단어 · ${reps + 1}번째`;
    }

    // 이 답을 고르면 다음에 언제 나오는지. schedule()은 순수 함수라 미리 계산해도 상태가
    // 안 바뀐다 — "왜 방금 본 단어가 오늘 다시 안 나오나"에 화면이 직접 답하게 하는 장치다.
    function nextText(word, grade) {
      const next = schedule(entryOf(word.id), grade);
      return next.ivl === 0 ? "오늘 안에 다시 나와요" : `다음엔 ${next.ivl}일 뒤에 나와요`;
    }

    function advance(word, grade) {
      gradeWord(word.id, grade);
      const item = queue.shift();
      if (grade === "again") {
        const retries = (item.retries || 0) + 1;
        queue.splice(Math.min(REINSERT_AFTER, queue.length), 0, { ...item, kind: "again", retries });
      } else {
        done += 1;
      }
      revealed = false;
      show();
    }

    function show() {
      if (queue.length === 0) return showDone();
      const item = queue[0];
      const word = item.word;
      titleEl.textContent = `오늘 학습 · 남은 ${queue.length}`;
      // 틀린 항목이 다시 들어오면 총량이 늘어난다 — 처음 개수를 분모로 고정하면 진행바가
      // 멈춘 것처럼 보이므로, 지금까지 끝낸 수와 남은 수를 더해 매번 다시 잰다.
      // 오늘의 구성(복습 N · 새 단어 M)과 지금 카드가 어느 쪽인지도 같이 보여준다 — 이게
      // 없으면 "복습 화면인데 처음 보는 단어만 나온다"로 읽힌다(D-101에서 받은 지적).
      const head = progressMarkup(done, done + queue.length) + `
        <p class="vocab-plan">오늘 구성 · 다시 볼 단어 ${dueCount}개 + 새 단어 ${newCount}개 · 외운 단어 ${done}개</p>
        <div class="vocab-item-badge ${item.kind === "new" ? "is-new" : "is-review"}">${itemBadge(item, word)}</div>`;

      // 새 단어는 카드로 만나고, 이미 만난 단어는 문제로 만난다(뜻 고르기 → 익숙해지면 빈칸).
      if (item.kind === "new") {
        const isOpen = revealed || !state.vocab.prefs.recall;
        cardEl.innerHTML = head + studyCardMarkup(word, isOpen) + (isOpen
          ? `<div class="vocab-grade-row">
               <button class="cta-btn vocab-grade-again" id="vocab-again">😅 헷갈려요</button>
               <button class="cta-btn" id="vocab-good">👍 알겠어요</button>
             </div>`
          : `<div class="cta"><button class="cta-btn" id="vocab-reveal">뜻 확인하기</button></div>`)
          + (isOpen ? `<p class="vocab-plan">👍는 ${nextText(word, "good")} · 😅는 오늘 안에 다시 나와요</p>` : "");
        cardEl.querySelector("#vocab-listen")?.addEventListener("click", () => speak(word.word, 1));
        cardEl.querySelector("#vocab-pref-recall").addEventListener("click", () => {
          state.vocab.prefs.recall = !state.vocab.prefs.recall;
          show();
        });
        cardEl.querySelector("#vocab-reveal")?.addEventListener("click", () => {
          revealed = true;
          show();
        });
        cardEl.querySelector("#vocab-good")?.addEventListener("click", () => advance(word, "good"));
        cardEl.querySelector("#vocab-again")?.addEventListener("click", () => advance(word, "again"));
        addStopButton();
        return;
      }

      if (retrievalMode(entryOf(word.id)) === "cloze") {
        const cloze = makeCloze(word);
        cardEl.innerHTML = head + clozeMarkup(cloze);
        const input = cardEl.querySelector("#vocab-cloze-input");
        const submit = () => {
          const correct = checkCloze(cloze, input.value, word);
          input.disabled = true;
          cardEl.querySelector("#vocab-cloze-submit").disabled = true;
          cardEl.querySelector("#vocab-after").innerHTML = `
            <p class="learning-feedback ${correct ? "tier-perfect" : "tier-retry"}">${correct ? "정답이에요!" : `정답은 "${cloze.answer}"예요`}</p>
            <p class="vocab-hint">🧠 ${word.hint}</p>
            <p class="vocab-plan">${nextText(word, correct ? "good" : "again")}</p>
            <div class="cta"><button class="cta-btn" id="vocab-next-item">다음</button></div>`;
          cardEl.querySelector("#vocab-next-item").addEventListener("click", () => advance(word, correct ? "good" : "again"));
        };
        cardEl.querySelector("#vocab-cloze-submit").addEventListener("click", submit);
        input.addEventListener("keydown", (e) => {
          if (e.key === "Enter") submit();
        });
        input.focus();
        addStopButton();
        return;
      }

      const q = makeQuestion(word, poolOf(word), makeRng(Date.now()));
      cardEl.innerHTML = head + choiceMarkup(q);
      const buttons = [...cardEl.querySelectorAll(".vocab-choice")];
      buttons.forEach((btn) => btn.addEventListener("click", () => {
        const choice = Number(btn.dataset.choice);
        const correct = choice === q.answerIndex;
        buttons.forEach((b, i) => {
          b.disabled = true;
          if (i === q.answerIndex) b.classList.add("choice-ok");
          else if (i === choice) b.classList.add("choice-no");
        });
        cardEl.querySelector("#vocab-after").innerHTML = `
          <p class="learning-feedback ${correct ? "tier-perfect" : "tier-retry"}">${correct ? "정답이에요!" : `정답은 "${q.answer}"예요`}</p>
          <p class="vocab-hint">🧠 ${word.hint}</p>
          <p class="vocab-plan">${nextText(word, correct ? "good" : "again")}</p>
          <div class="cta"><button class="cta-btn" id="vocab-next-item">다음</button></div>`;
        cardEl.querySelector("#vocab-next-item").addEventListener("click", () => advance(word, correct ? "good" : "again"));
      }));
      addStopButton();
    }

    // 맞힐 때까지 다시 나오는 구조라 **나갈 문**이 반드시 있어야 한다 — 오늘 도저히 안 외워지는
    // 단어에 갇히면 학습이 아니라 벌이 된다. 남은 것은 어차피 내일 일정에 올라 있다.
    function addStopButton() {
      const btn = el(`<button class="retry-btn" id="vocab-stop">오늘은 여기까지</button>`);
      cardEl.appendChild(btn);
      btn.addEventListener("click", () => showDone({ stopped: true }));
    }

    function showDone({ stopped = false } = {}) {
      const stats = summarize(state.vocab.cards);
      // 내일 몇 개가 올라오는지 미리 보여준다 — "이 화면이 뭘 위한 건지" 가장 잘 설명하는 숫자다.
      const tomorrow = Date.now() + 24 * 60 * 60 * 1000;
      const dueTomorrow = dueIds(state.vocab.cards, tomorrow).length;
      const left = queue.length;
      titleEl.textContent = stopped ? "오늘 학습 · 중단" : "오늘 학습 · 완료";
      cardEl.innerHTML = `
        <div class="empty-state">
          <div class="emoji">${stopped ? "🌙" : "🎉"}</div>
          <div class="msg">${stopped
            ? `오늘은 여기까지!<br/>${done}단어를 외웠어요${left > 0 ? ` · ${left}개는 남겨뒀어요` : ""}`
            : `오늘 몫을 다 외웠어요!<br/>${done}단어를 끝까지 맞혔어요`}</div>
        </div>
        <p class="learning-warn">지금까지 만난 단어 ${stats.seen}개 · 일정에 올라간 단어 ${stats.learned}개.
           <b>내일은 ${dueTomorrow}개</b>가 다시 올라와요 — 맞힐수록 다음 간격이 길어져요.</p>
        <div class="cta"><button class="cta-btn" id="vocab-go-days">DAY 목록으로</button></div>`;
      cardEl.querySelector("#vocab-go-days").addEventListener("click", () => go("learning-civil-vocab"));
    }

    show();
  }
}

// 오늘 큐를 만들기 위해 **필요한 DAY 파일만** 연다: 복습 대상이 사는 DAY + 새 단어를 채울
// 만큼의 앞쪽 DAY. 8000단어가 되어도 하루치를 만드는 데 파일 몇 개면 된다.
async function collectToday(now = Date.now()) {
  const poolByDay = new Map();
  const load = async (dayId) => {
    if (!poolByDay.has(dayId)) poolByDay.set(dayId, await loadDay(dayId));
    return poolByDay.get(dayId);
  };

  const due = dueIds(state.vocab.cards, now);
  const dueWords = [];
  for (const id of due) {
    const dayId = dayIdOf(id);
    if (!dayId) continue;                      // 콘텐츠에서 사라진 옛 id는 조용히 건너뛴다
    const word = (await load(dayId)).find((w) => w.id === id);
    if (word) dueWords.push(word);
  }

  // **오늘 이미 시작한 신규는 상한에서 뺀다.** 이걸 안 하면 화면을 다시 열 때마다 새 단어가
  // 상한만큼 또 나오고, 정작 아까 본 단어는 (내일 일정이라) 안 나온다 — 사용자가 "봤던 단어가
  // 거기 나오는 것도 아닌 것 같다"고 지적한 상태가 정확히 이것이다(D-101).
  const remainingNew = Math.max(0, state.vocab.newPerDay - countNewToday(state.vocab.cards, now));
  const newWords = [];
  for (const day of DAYS) {
    if (newWords.length >= remainingNew) break;
    for (const word of await load(day.id)) {
      if (state.vocab.cards[word.id]) continue;   // 이미 만난 단어
      newWords.push(word);
      if (newWords.length >= remainingNew) break;
    }
  }

  return {
    queue: buildDailyQueue(dueWords, newWords, makeRng(now)),
    poolByDay,
    dueCount: dueWords.length,
    newCount: newWords.length,
  };
}
