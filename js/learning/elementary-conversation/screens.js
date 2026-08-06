// "초등 영어회화" 도구: 학년(GRADES) → 챕터(목차) → 단계(기본/중급/심화) → 문장 연습.
// basic-conversation과 같은 in-place 렌더 패턴을 쓰지만, data.js에서 설명한 세 가지
// 보강(D-78) 때문에 연습 화면(renderElementaryChapter)은 basic-conversation의
// renderChapter를 그대로 재사용하지 않고 새로 짰다:
//   - 문장이 `type: "produce"`면 정답을 읽어주지 않고 질문만 던진다(유사도 채점 없음,
//     예시 답안으로 스스로 비교).
//   - "repeat" 문장에서 낮은 점수(retry)를 받거나 produce 문장을 "다시 연습할래요"로
//     자가평가하면 그 문장 id를 state의 weak 목록에 남긴다 — 챕터를 다 풀면 "헷갈렸던
//     문장만 복습하기" 버튼이 그 목록만 다시 돌린다(SRS까지는 아니지만, 최소한 "본 적
//     있다"에서 끝나지 않고 약한 문장이 먼저 다시 나오게 하는 장치).
import { app, go, onLeave } from "../../core/router.js";
import { el, bindNav } from "../../core/dom.js";
import { state } from "../../core/state.js";
import { saveLearningProgress } from "../cloud.js";
import { GRADES, LEVEL_LABELS } from "./data.js";
import { scoreSpeech, TIER_TEXT } from "../score.js";
import { supportsSpeech, supportsRecognition, speak, listen } from "../speech.js";
import { recordFallbackMarkup, bindRecordFallback } from "../record.js";
import { markWrong, markCorrect } from "../srs.js";
import { practicePrefsMarkup, bindPracticePrefs, sentenceMarkup, koMarkup, bindReveal } from "../prefs.js";

function levelCounts(sentences) {
  return Object.keys(LEVEL_LABELS)
    .map((level) => `${LEVEL_LABELS[level]} ${sentences.filter((s) => (s.level || "basic") === level).length}`)
    .join(" · ");
}

// 학년 선택 — 목차 화면(renderBasicConversationIntro)과 같은 .test-list/.test-card 패턴.
// 아직 안 만든 학년은 GRADES에 아예 없어서(D-78) 이 화면은 항상 실제로 고를 수 있는
// 학년만 보여준다.
export function renderElementaryGrades() {
  app.appendChild(el(`
    <div>
      <div class="back-row">
        <button class="back-btn" data-nav="learning-list">‹</button>
        <div class="back-title">초등 영어회화</div>
      </div>
      <div class="section-title">🔥 학년을 골라주세요</div>
      <div class="test-list">
        ${GRADES.map((grade) => {
          const total = grade.chapters.reduce((sum, ch) => sum + ch.sentences.length, 0);
          return `
          <button class="test-card" data-nav="learning-elementary-${grade.id}">
            <div class="icon" style="background:#4C9AFF;">${grade.emoji}</div>
            <div class="body">
              <div class="name">${grade.label}</div>
              <div class="desc">목차 ${grade.chapters.length}개 · 문장 ${total}개</div>
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

export function renderElementaryChapters(grade) {
  // 학년이 하나뿐이면 "learning-elementary"로 돌아가도 guard가 곧장 여기로 되튕긴다
  // (index.js) — 뒤로가기가 안 먹는 것처럼 보이므로, 그럴 땐 아예 학습 목록으로 보낸다.
  const backTarget = GRADES.length === 1 ? "learning-list" : "learning-elementary";
  app.appendChild(el(`
    <div>
      <div class="back-row">
        <button class="back-btn" data-nav="${backTarget}">‹</button>
        <div class="back-title">${grade.label}</div>
      </div>
      <div class="section-title">${grade.emoji} 목차</div>
      <div class="test-list">
        ${grade.chapters.map((ch) => `
          <button class="test-card" data-nav="learning-elementary-${grade.id}-${ch.id}">
            <div class="icon" style="background:#4C9AFF;">${ch.emoji}</div>
            <div class="body">
              <div class="name">${ch.title}</div>
              <div class="desc">${levelCounts(ch.sentences)}</div>
            </div>
            <div class="chevron">›</div>
          </button>
        `).join("")}
      </div>
    </div>
  `));
  bindNav(app);
}

export function renderElementaryLevelSelect(grade, chapter) {
  app.appendChild(el(`
    <div>
      <div class="back-row">
        <button class="back-btn" data-nav="learning-elementary-${grade.id}">‹</button>
        <div class="back-title">${chapter.title}</div>
      </div>
      <div class="section-title">${chapter.emoji} 단계를 골라주세요</div>
      <div class="test-list">
        ${Object.keys(LEVEL_LABELS).map((level) => {
          const count = chapter.sentences.filter((s) => (s.level || "basic") === level).length;
          return `
          <button class="test-card" data-nav="learning-elementary-${grade.id}-${chapter.id}-${level}">
            <div class="icon" style="background:#4C9AFF;">${chapter.emoji}</div>
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

// 화면 이동(go())은 화면 id만 받고 매개변수를 못 넘긴다 — "헷갈렸던 문장만 복습하기"는
// 새 주소를 만들 만한 상태가 아니라서(공유할 이유가 없는 일시적 연습 모드), 라우터를 타지
// 않고 이 화면 안에서 sentences/N/reviewMode를 직접 바꿔 showCard()를 다시 부르는 식으로
// 처리한다 — router.js의 render()처럼 app.innerHTML을 다시 비우지 않고 #learning-card
// 안쪽만 갈아끼우면 되므로 화면 골격(back-row 등)은 그대로 둔다.
export function renderElementaryChapter(grade, chapter, level) {
  const key = `elementary-${grade.id}-${chapter.id}-${level}`;
  state.learning[key] ??= { index: 0, weak: {} };
  const st = state.learning[key];
  // 엔트리가 이미 있으면 위 `??=`가 통째로 건너뛴다 — weak 필드가 생기기 전에 저장돼
  // 클라우드에서 돌아온 레코드는 weak가 없어서 아래 markWeak가 터진다(A-5).
  st.weak ??= {};

  const allSentences = chapter.sentences.filter((s) => (s.level || "basic") === level);
  let reviewMode = false;
  let sentences = allSentences;
  let N = sentences.length;

  let activeRecognition = null;
  onLeave(() => {
    window.speechSynthesis?.cancel();
    activeRecognition?.abort();
  });

  app.appendChild(el(`
    <div class="learning-screen">
      <div class="back-row">
        <button class="back-btn" data-nav="learning-elementary-${grade.id}-${chapter.id}">‹</button>
        <div class="back-title" id="learning-title"></div>
      </div>
      <div id="learning-card"></div>
    </div>
  `));
  bindNav(app);

  const titleEl = app.querySelector("#learning-title");
  const cardEl = app.querySelector("#learning-card");

  // weak의 값은 이제 불리언이 아니라 SRS 엔트리 { due, step }다(D-92) — 키는 그대로라
  // 아래 "헷갈렸던 문장만 복습하기"의 `st.weak[s.id]` 검사와 마이페이지 집계는 안 바뀐다.
  // 맞히면 다음 칸으로 올리고 마지막 칸을 넘기면 지운다(졸업), 틀리면 처음으로 되돌린다.
  function markWeak(id, isWeak) {
    if (isWeak) { st.weak[id] = markWrong(st.weak[id]); return; }
    if (!st.weak[id]) return;  // 원래 약하지 않던 문장은 일정에 넣지 않는다
    const next = markCorrect(st.weak[id]);
    if (next) st.weak[id] = next;
    else delete st.weak[id];
  }

  function showDone() {
    titleEl.textContent = `${chapter.title} · ${LEVEL_LABELS[level]}${reviewMode ? " · 복습" : ""}`;
    const weakLeft = allSentences.some((s) => st.weak[s.id]);
    cardEl.innerHTML = `
      <div class="empty-state">
        <div class="emoji">🎉</div>
        <div class="msg">문장 ${N}개를 다 배웠어요!</div>
      </div>
      ${weakLeft && !reviewMode
        ? `<div class="cta"><button class="cta-btn" id="learning-review-weak">🔁 헷갈렸던 문장만 복습하기</button></div>`
        : ""}
      <div class="cta"><button class="cta-btn" id="learning-listen-quiz">🎧 듣고 뜻 맞히기</button></div>
      <div class="cta"><button class="cta-btn" id="learning-restart">처음부터 다시 놀기</button></div>
      <button class="retry-btn" id="learning-toc">단계 다시 고르기</button>
    `;
    cardEl.querySelector("#learning-listen-quiz").addEventListener("click", () => go(`learning-elementary-${grade.id}-${chapter.id}-${level}-listen`));
    cardEl.querySelector("#learning-review-weak")?.addEventListener("click", () => {
      reviewMode = true;
      sentences = allSentences.filter((s) => st.weak[s.id]);
      N = sentences.length;
      st.index = 0;
      showCard();
    });
    cardEl.querySelector("#learning-restart").addEventListener("click", () => {
      reviewMode = false;
      sentences = allSentences;
      N = sentences.length;
      st.index = 0;
      st.weak = {};
      saveLearningProgress();
      showCard();
    });
    cardEl.querySelector("#learning-toc").addEventListener("click", () => go(`learning-elementary-${grade.id}-${chapter.id}`));
  }

  function advance() {
    st.index += 1;
    saveLearningProgress();
    showCard();
  }

  function prev() {
    if (st.index === 0) return;
    st.index -= 1;
    saveLearningProgress();
    showCard();
  }

  // 문법 태그(grammar)는 원래 콘텐츠 저작 시점의 내부 장치(반복 규칙 검사용)라 학습자
  // 화면엔 안 보였다 — "지금 뭘 배우는지" 의식하는 게 공부를 쉽게 만든다는 지적(D-78
  // 후속)에 따라 카드에 한 줄 노출한다.
  function grammarPoint(card) {
    return grade.grammarPoints.find((g) => g.id === card.grammar);
  }

  // 카드에는 **아이 말(kidLabel)**을 띄운다(D-94) — "조동사"·"관계대명사"·"수동태" 같은 용어는
  // 초등학생이 모르니, 그대로 띄우면 "지금 뭘 배우는지 알려준다"는 원래 목적이 무너진다.
  // label(문법 용어)은 콘텐츠 저작·문서·테스트가 계속 쓴다.
  function grammarLabel(card) {
    const gp = grammarPoint(card);
    return gp?.kidLabel ?? gp?.label ?? card.grammar;
  }

  function showCard() {
    if (st.index >= N) return showDone();
    const card = sentences[st.index];
    titleEl.textContent = `${chapter.title} · ${LEVEL_LABELS[level]}${reviewMode ? " · 복습" : ""} (${st.index + 1}/${N})`;
    if (card.type === "produce") showProduceCard(card);
    else showRepeatCard(card);
  }

  function showRepeatCard(card) {
    cardEl.innerHTML = `
      <div class="cover">
        ${level !== "basic" ? `<div class="tag">${LEVEL_LABELS[level]}</div>` : ""}
        ${sentenceMarkup(card.text)}
        ${koMarkup(card.ko, supportsSpeech())}
      </div>
      ${practicePrefsMarkup()}
      <p class="learning-grammar-focus">🔤 오늘의 문법: ${grammarLabel(card)}</p>
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
      <button class="retry-btn" id="learning-skip">✓ 이미 할 수 있어요 · 다음 문장</button>
      ${st.index > 0 ? `<button class="retry-btn" id="learning-prev">◀ 이전 문장</button>` : ""}
    `;

    cardEl.querySelectorAll(".learning-listen .cta-btn").forEach((btn) => {
      btn.addEventListener("click", () => speak(card.text, Number(btn.dataset.rate)));
    });
    const listenKo = () => speak(card.ko, 1, "ko-KR");
    cardEl.querySelector("#learning-listen-ko")?.addEventListener("click", listenKo);
    bindPracticePrefs(cardEl, showCard);
    bindReveal(cardEl, { text: card.text, ko: card.ko, withListenBtn: supportsSpeech(), onListenKo: listenKo });
    cardEl.querySelector("#learning-skip").addEventListener("click", advance);
    cardEl.querySelector("#learning-prev")?.addEventListener("click", prev);

    const micBtn = cardEl.querySelector("#learning-mic");
    // STT가 없으면(iOS Safari) 녹음-되듣기 폴백으로 대체한다(D-95). 자가평가 결과만
    // 여기서 받아 STT 경로와 똑같이 처리한다.
    if (!micBtn) {
      bindRecordFallback(cardEl, {
        onDone: (ok) => { markWeak(card.id, !ok); advance(); },
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
          const { tier, tokens } = scoreSpeech(heard, card.text);
          markWeak(card.id, tier === "retry");
          resultEl.innerHTML = `
            <p class="learning-heard">내가 말한 것: "${heard}"</p>
            <p class="learning-words">${tokens.map((t) => `<span class="${t.ok ? "hit" : "miss"}">${t.text}</span>`).join(" ")}</p>
            <p class="learning-feedback tier-${tier}">${TIER_TEXT[tier]}</p>
            <div class="cta"><button class="cta-btn" id="learning-next">${st.index + 1 < N ? "다음 문장" : "완료!"}</button></div>
            <button class="retry-btn" id="learning-again">🎤 이 문장 다시 말하기</button>
          `;
          resultEl.querySelector("#learning-next").addEventListener("click", advance);
          // 점수가 낮게 나와도 그 자리에서 다시 시도할 길이 없어 "다음"밖에 못 누르던 문제(A-4).
          // 같은 인덱스로 카드를 다시 그리면 마이크·건너뛰기 버튼이 처음 상태로 돌아온다.
          resultEl.querySelector("#learning-again").addEventListener("click", showCard);
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

  // produce 카드: 정답 문장을 읽어주지 않는다 — 질문을 던지고 아이가 스스로 영어 문장을
  // 만들어 답하게 한 뒤, 예시 답안(sample)과 스스로 비교하게 한다. 유사도 채점은 안 한다
  // (정답이 하나가 아니라서 Levenshtein으로 잴 대상이 없다) — 자가평가(잘했다/다시 연습)만
  // weak 목록에 반영한다. 아무 참고 없이 백지에서 시작하면 얼어붙는 아이가 있을 수 있어,
  // 시도 전에 문장 시작 조각(hint)을 먼저 보여준다 — 정답은 아니고 어디서부터 말을
  // 시작하면 될지 감만 준다(D-78 후속).
  function showProduceCard(card) {
    cardEl.innerHTML = `
      <div class="cover">
        <div class="tag">질문</div>
        <h2>${card.text}</h2>
        <p class="cover-ko">
          ${card.ko}
          ${supportsSpeech() ? `<button class="ko-listen-btn" id="learning-listen-ko" aria-label="한국어 뜻 듣기">🔊</button>` : ""}
        </p>
      </div>
      <p class="learning-grammar-focus">🔤 오늘의 문법: ${grammarLabel(card)}</p>
      <p class="learning-hint">💡 이렇게 시작해보세요: <b>${card.hint}</b></p>
      ${!supportsSpeech()
        ? `<p class="learning-warn">이 브라우저는 음성 재생을 지원하지 않아요.</p>`
        : `<div class="learning-listen">
             <button class="cta-btn" data-rate="1">🔊 질문 듣기</button>
           </div>`}
      ${!supportsRecognition()
        ? recordFallbackMarkup()
        : `<button class="btn-mic btn-mic-labeled" id="learning-mic">🎤 내 생각 말하기</button>
           <div class="learning-mic-status" id="learning-mic-status"></div>`}
      <div class="learning-result" id="learning-result"></div>
      <button class="retry-btn" id="learning-skip">✓ 다음 문장</button>
      ${st.index > 0 ? `<button class="retry-btn" id="learning-prev">◀ 이전 문장</button>` : ""}
    `;

    cardEl.querySelectorAll(".learning-listen .cta-btn").forEach((btn) => {
      btn.addEventListener("click", () => speak(card.text, Number(btn.dataset.rate)));
    });
    cardEl.querySelector("#learning-listen-ko")?.addEventListener("click", () => speak(card.ko, 1, "ko-KR"));
    cardEl.querySelector("#learning-skip").addEventListener("click", advance);
    cardEl.querySelector("#learning-prev")?.addEventListener("click", prev);

    // 질문형(produce) 카드는 텍스트를 읽어야 하는 아이에게 진입 장벽이라, 버튼을 누르기 전에
    // 질문을 자동으로 한 번 읽어준다 — 반복 카드는 아이가 스스로 페이스를 조절해야 해서
    // 자동 재생을 안 하지만, 질문·답변형은 실제 대화처럼 질문이 먼저 들려야 자연스럽다.
    if (supportsSpeech()) speak(card.text, 1);

    const micBtn = cardEl.querySelector("#learning-mic");
    // STT가 없으면(iOS Safari) 녹음-되듣기 폴백으로 대체한다(D-95). 자가평가 결과만
    // 여기서 받아 STT 경로와 똑같이 처리한다.
    if (!micBtn) {
      bindRecordFallback(cardEl, {
        onDone: (ok) => { markWeak(card.id, !ok); advance(); },
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
          // 자유 발화라 유사도 채점은 못 해도, **목표 문법 형태를 넣어 말했는지**는 잴 수
          // 있다(D-94) — produce 문장에 줄 수 있는 유일한 객관적 신호다. check가 없는
          // 문법(형태가 뚜렷하지 않은 항목)이면 이 줄은 아예 안 나온다.
          const gp = grammarPoint(card);
          const usedForm = gp?.check ? gp.check.test(heard) : null;
          resultEl.innerHTML = `
            <p class="learning-heard">내가 말한 것: "${heard}"</p>
            ${usedForm === null ? "" : `<p class="learning-formcheck ${usedForm ? "ok" : "no"}">${
              usedForm
                ? `✅ 오늘의 문법을 잘 넣어 말했어요! (${gp.kidLabel})`
                : `💡 이번엔 ${gp.kidLabel}에 도전해볼까요?`
            }</p>`}
            <p class="learning-feedback">예시 답안이에요 — 비슷하게 말했나요?</p>
            <ul class="learning-sample-list">${card.sample.map((s) => `<li>${s}</li>`).join("")}</ul>
            <div class="cta">
              <button class="cta-btn" id="learning-self-good">잘 말했어요</button>
              <button class="cta-btn" id="learning-self-retry">다시 연습할래요</button>
            </div>
          `;
          resultEl.querySelector("#learning-self-good").addEventListener("click", () => {
            markWeak(card.id, false);
            advance();
          });
          resultEl.querySelector("#learning-self-retry").addEventListener("click", () => {
            markWeak(card.id, true);
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

  showCard();
}

// "듣고 뜻 맞히기"(D-95, C-2). 문장을 **글자 없이 소리로만** 들려주고 한국어 뜻 3개 중에서
// 고르게 한다 — 지금까지의 카드는 전부 "따라 말하기"라, 들은 걸 **이해했는지**는 한 번도
// 확인하지 않았다(가리기 토글 D-93도 산출 연습이지 이해 확인은 아니다).
//
// 콘텐츠를 새로 안 만든다: 오답 보기는 **같은 챕터의 다른 문장 뜻**을 가져다 쓴다. 소재가
// 같아서 "대충 찍어도 맞는" 보기가 안 나오고, 문장을 추가할 때마다 문제도 저절로 늘어난다.
// 채점은 틀린 것만 weak(SRS)에 넣는다 — 맞힌 걸 굳이 일정에 올릴 이유가 없다.
export function renderElementaryListen(grade, chapter, level) {
  const key = `elementary-${grade.id}-${chapter.id}-${level}`;
  state.learning[key] ??= { index: 0, weak: {} };
  const st = state.learning[key];
  st.weak ??= {};

  // 들려줄 수 있는 문장만 — produce 문장은 text가 질문이라 "뜻 맞히기"가 성립하지 않는다.
  const quiz = chapter.sentences.filter((s) => (s.level || "basic") === level && s.type !== "produce");
  const pool = chapter.sentences.filter((s) => s.type !== "produce");
  let i = 0;
  let correct = 0;

  onLeave(() => window.speechSynthesis?.cancel());

  app.appendChild(el(`
    <div class="learning-screen">
      <div class="back-row">
        <button class="back-btn" data-nav="learning-elementary-${grade.id}-${chapter.id}-${level}">‹</button>
        <div class="back-title" id="learning-title"></div>
      </div>
      <div id="learning-card"></div>
    </div>
  `));
  bindNav(app);
  const titleEl = app.querySelector("#learning-title");
  const cardEl = app.querySelector("#learning-card");

  // 오답 2개 + 정답 1개를 섞는다. 같은 뜻이 두 번 나오지 않게 ko 기준으로 거른다.
  function options(answer) {
    const others = pool.filter((s) => s.ko !== answer.ko);
    const picked = [];
    while (picked.length < 2 && others.length) {
      picked.push(others.splice(Math.floor(Math.random() * others.length), 1)[0]);
    }
    return [answer, ...picked].sort(() => Math.random() - 0.5);
  }

  function show() {
    if (i >= quiz.length) {
      titleEl.textContent = `${chapter.title} · 듣기`;
      cardEl.innerHTML = `
        <div class="empty-state">
          <div class="emoji">${correct === quiz.length ? "🎉" : "👂"}</div>
          <div class="msg">${quiz.length}개 중 ${correct}개를 맞혔어요!</div>
        </div>
        ${correct < quiz.length ? `<p class="learning-hint">틀린 문장은 복습 목록에 담아뒀어요.</p>` : ""}
        <div class="cta"><button class="cta-btn" id="learning-again">다시 풀기</button></div>
        <button class="retry-btn" id="learning-toc">연습으로 돌아가기</button>
      `;
      cardEl.querySelector("#learning-again").addEventListener("click", () => { i = 0; correct = 0; show(); });
      cardEl.querySelector("#learning-toc").addEventListener("click", () => go(`learning-elementary-${grade.id}-${chapter.id}-${level}`));
      return;
    }
    const card = quiz[i];
    titleEl.textContent = `${chapter.title} · 듣기 (${i + 1}/${quiz.length})`;
    cardEl.innerHTML = `
      <div class="cover">
        <div class="tag">듣고 뜻 맞히기</div>
        <h2 class="masked">🎧</h2>
      </div>
      <div class="learning-listen">
        <button class="cta-btn" data-rate="1">🔊 다시 듣기</button>
        <button class="cta-btn" data-rate="0.75">🐢 천천히</button>
      </div>
      <div class="test-list">
        ${options(card).map((o) => `
          <button class="test-card listen-choice" data-ko="${o.ko}">
            <div class="body"><div class="name">${o.ko}</div></div>
          </button>
        `).join("")}
      </div>
      <div class="learning-result" id="learning-result"></div>
    `;
    cardEl.querySelectorAll(".learning-listen .cta-btn").forEach((btn) => {
      btn.addEventListener("click", () => speak(card.text, Number(btn.dataset.rate)));
    });
    const resultEl = cardEl.querySelector("#learning-result");
    cardEl.querySelectorAll(".listen-choice").forEach((btn) => {
      btn.addEventListener("click", () => {
        const ok = btn.dataset.ko === card.ko;
        if (ok) correct += 1;
        else markWeak(card.id, true);
        saveLearningProgress();
        cardEl.querySelectorAll(".listen-choice").forEach((b) => {
          b.disabled = true;
          if (b.dataset.ko === card.ko) b.classList.add("choice-ok");
          else if (b === btn) b.classList.add("choice-no");
        });
        resultEl.innerHTML = `
          <p class="learning-heard">${card.text}</p>
          <p class="learning-feedback tier-${ok ? "perfect" : "retry"}">${ok ? "맞았어요!" : "다시 들어볼까요?"}</p>
          <div class="cta"><button class="cta-btn" id="learning-next">${i + 1 < quiz.length ? "다음 문제" : "완료!"}</button></div>
        `;
        resultEl.querySelector("#learning-next").addEventListener("click", () => { i += 1; show(); });
      });
    });

    // 문제는 소리가 먼저다 — 들려주지 않으면 고를 근거가 없다.
    if (supportsSpeech()) speak(card.text, 1);
  }

  // 이 화면 안에서만 쓰는 weak 기록(연습 화면의 markWeak와 같은 SRS 형식).
  function markWeak(id) {
    st.weak[id] = markWrong(st.weak[id]);
  }

  show();
}
