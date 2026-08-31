// 부부 관계 성향 체크의 화면들. 배우자와 결과를 합치는 흐름(초대 링크·짧은 코드·결합
// 리포트)은 D-108에서 통째로 없앴다 — 이 검사는 이제 개인 결과만 낸다. 없앤 이유는
// `docs/couple-architecture.md` §5 참고(응답이 실린 코드가 부부 사이에서 오간다는 것
// 자체가 감당할 수 없는 위험이었다).
import { app, go, onLeave, parseSharedPath, setExitGuard } from "../../core/router.js";
import { el, bindNav, bindAdGate } from "../../core/dom.js";
import { state } from "../../core/state.js";
import { roundRect } from "../../core/util.js";
import { shareBlockMarkup, wireShare } from "../../core/share.js";
import { adSlotMarkup, adGateMarkup } from "../../core/ads.js";
import {
  T_AXIS,
  R_AXIS,
  K_AXIS,
  LIKERT,
  ITEM_TOTAL,
  ANCHOR_ITEMS,
  ANCHOR_CONCEPTS,
  BEHAVIOR_LABELS,
  BEHAVIOR_AXIS_MEANING,
  BEHAVIOR_DEEP,
  ATTACH_TYPES,
  ATTACH_DEEP,
  CONFLICT_STYLES,
  CS5_SHADES,
  AXIS_LABELS,
  COUPLE_TYPES,
  ROLE_NARRATIVE,
  CHILD_NARRATIVE,
  DOS_BEHAVIOR,
  DOS_ATTACH,
  DONTS_BEHAVIOR,
  DONTS_ATTACH,
  CONFLICT_SCRIPTS,
  READING_TEXT,
  ROLE_IDENTITY_NOTE,
  LOVE_AXES,
  LOVE_LABELS,
  LOVE_AXIS_MEANING,
  LOVE_TYPES,
  DOS_LOVE,
  DONTS_LOVE,
} from "./data.js";
import { computeCouple, BEHAVIOR_AXES } from "./score.js";
import { assembleQuestionnaire, NOTICE_POSITION } from "./assemble.js";
import { createCoupleCanvas, drawCoupleCardFooter } from "./card.js";

const COMBO_COUNT = T_AXIS.length * R_AXIS.length * K_AXIS.length;

// 결과 어디에도 진단·예측으로 읽힐 문장을 두지 않는다(§9.3). 이 한 줄이 나머지 안전
// 장치보다 실질적으로 더 중요하다 — 사용자가 결과를 판정이 아니라 대화 소재로 받아들이게
// 만드는 프레이밍이기 때문이다.
export const SERVICE_NOTICE =
  "이 체크는 나를 이해하고 배우자와 나눌 이야기를 찾기 위한 도구입니다. 심리 상태를 진단하거나 관계의 미래를 예측하지 않습니다.";

// 감지·분기 없이 결과 화면 하단에 항상 같은 모습으로 놓인다. 특정 응답에 반응해서
// 나타나는 것이 아니라서 낙인 효과가 없고, 필요한 사람은 언제든 찾을 수 있다(§9.2).
// 번호는 기획서에 적힌 것을 그대로 쓰지 않았다 — 1577-1366은 다누리콜센터(다문화가족),
// 1393은 2024년부터 109로 통합돼 안내 번호로 부적절하다.
export const SUPPORT_MARKUP = `
  <div class="cp-support">
    <div class="cp-support-title">혼자 감당하기 어려운 이야기라면</div>
    <p>이 체크는 두 분의 대화를 돕기 위한 것이며, 의학적·심리학적 진단이 아닙니다.
    관계나 마음이 많이 힘드시다면 전문가와 이야기 나누는 것이 도움이 될 수 있습니다.</p>
    <ul>
      <li>가족센터 가족상담 <b>1577-9337</b> (부부·가족 상담)</li>
      <li>정신건강 상담전화 <b>1577-0199</b></li>
    </ul>
  </div>
`;

// 응답 공개 범위 고지(§6.5.2). D-108 이후로는 지킬 수 있는 약속의 범위가 훨씬 넓어졌다 —
// 응답이 담긴 링크·코드를 만드는 경로 자체가 없어져서, "이 기기 밖으로 나가지 않는다"고
// 그냥 쓸 수 있다. 예전 문구는 "배우자에게 문항별로 보여지지 않는다"까지만 말할 수 있었다.
export const PRIVACY_MARKUP = `
  <div class="cp-privacy">
    <div class="cp-privacy-title">🔒 답한 내용은 이 기기 밖으로 나가지 않아요</div>
    <p>문항에 어떻게 답했는지도, 결과도 서버로 전송되거나 저장되지 않습니다.
    화면을 새로고침하면 그대로 사라집니다.</p>
    <p><b>솔직하게 답할수록 나에게 실제로 도움이 되는 결과가 나옵니다.</b>
    좋게 보이려고 답하시면, 정작 지금 풀어야 할 것을 놓치게 됩니다.</p>
  </div>
`;

export function resetCouple() {
  state.couple = {
    setup: null,
    items: null,
    answers: {},
    index: 0,
    completed: false,
    startedAt: null,
    elapsedMs: null,
  };
}

// 문항을 끝까지 마쳤을 때만 true. 진행 상태를 answers 개수로 세지 않는 이유는
// state.js의 `completed` 주석 참고 — 뒤로 가서 답을 다시 보는 중에도 답은 전부 차 있다.
export function coupleReady() {
  const c = state.couple;
  return Boolean(c.completed && c.items && Object.keys(c.answers).length >= c.items.length);
}

// 결과는 화면을 다시 그릴 때마다 같은 값이어야 한다. 순수 함수라 매번 계산해도 되지만,
// 소요시간만은 완료 시점에 한 번 고정해둔다.
export function result() {
  return computeCouple(state.couple.answers, {
    elapsedMs: state.couple.elapsedMs,
    setup: state.couple.setup,
  });
}

// ---------------------------------------------------------------- 인트로

export function renderCoupleIntro() {
  app.appendChild(el(`
    <div>
      <div class="back-row">
        <button class="back-btn" data-nav="psych-list">‹</button>
        <div class="back-title">심리테스트</div>
      </div>
      ${adSlotMarkup("bannerTop", "margin-top:10px; margin-bottom:4px;")}
      <div class="cover">
        <div class="emoji">💞</div>
        <div class="tag">부부 관계 성향 체크</div>
        <h2>우리는 서로를<br/>어떻게 보고 있을까?</h2>
        <p>문항 ${ITEM_TOTAL}개에 답하면 나의 관계 성향이 나와요.<br/>혼자 조용히 보는 결과예요.</p>
      </div>
      <div class="meta-chips">
        <div class="meta-chip"><div class="value">${ITEM_TOTAL}문항</div><div class="label">약 8분 30초</div></div>
        <div class="meta-chip"><div class="value">${COMBO_COUNT}가지</div><div class="label">상황 조합</div></div>
        <div class="meta-chip"><div class="value">${Object.keys(COUPLE_TYPES).length}가지</div><div class="label">결과 유형</div></div>
      </div>
      ${PRIVACY_MARKUP}
      <p class="disclaimer">${SERVICE_NOTICE}</p>
      <div class="cta">
        <button class="cta-btn" id="cp-start">시작하기</button>
      </div>
      <div class="cp-guide-link"><button data-nav="couple-guide">📖 이 체크, 어떻게 쓰는 건가요?</button></div>
      ${adSlotMarkup("bannerBottom", "margin-top:6px; margin-bottom:22px;")}
    </div>
  `));
  bindNav(app);
  app.querySelector("#cp-start").addEventListener("click", () => {
    resetCouple();
    go("couple-setup");
  });
}

// ---------------------------------------------------------------- 상황 선택 (3축)

function axisGroupMarkup(title, hint, name, options) {
  return `
    <div class="cp-axis">
      <div class="cp-axis-title">${title}</div>
      <div class="cp-axis-hint">${hint}</div>
      <div class="cp-axis-options">
        ${options.map((o) => `
          <button class="cp-axis-btn" data-axis="${name}" data-code="${o.code}">
            <span class="lbl">${o.label}</span>
            <span class="sub">${o.desc || ""}</span>
          </button>
        `).join("")}
      </div>
    </div>
  `;
}

export function renderCoupleSetup() {
  const picked = { t: null, r: null, k: null };

  app.appendChild(el(`
    <div>
      <div class="back-row">
        <button class="back-btn" data-nav="couple-intro">‹</button>
        <div class="back-title">상황 고르기</div>
      </div>
      <div class="question-block">
        <div class="qno">시작 전에</div>
        <h2 class="disc-scene">지금 두 분의 상황을 알려주세요</h2>
      </div>
      <p class="cp-setup-lead">고른 내용에 맞춰 문항 문장이 바뀝니다.</p>
      ${axisGroupMarkup("나는", "결과 문구의 호칭에만 쓰이고 점수에는 영향을 주지 않아요", "t", T_AXIS)}
      ${axisGroupMarkup("우리 집에서 나는", "지금 주로 맡고 있는 쪽을 고르세요", "r", R_AXIS)}
      ${axisGroupMarkup("자녀는", "지금 상황에 가장 가까운 것을 고르세요", "k", K_AXIS)}
      <div class="cta">
        <button class="cta-btn" id="cp-setup-next" disabled>문항 시작하기</button>
      </div>
      ${adSlotMarkup("bannerBottom", "margin-top:6px; margin-bottom:22px;")}
    </div>
  `));
  bindNav(app);

  const next = app.querySelector("#cp-setup-next");
  app.querySelectorAll(".cp-axis-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const { axis, code } = btn.dataset;
      picked[axis] = code;
      app.querySelectorAll(`.cp-axis-btn[data-axis="${axis}"]`).forEach((b) => b.classList.remove("picked"));
      btn.classList.add("picked");
      next.disabled = !(picked.t && picked.r && picked.k);
    });
  });

  next.addEventListener("click", () => {
    state.couple.setup = { ...picked };
    state.couple.items = assembleQuestionnaire(picked);
    state.couple.answers = {};
    state.couple.index = 0;
    state.couple.completed = false;
    state.couple.startedAt = null;
    state.couple.elapsedMs = null;
    go("couple-question");
  });
}

// ---------------------------------------------------------------- 문항

// 화면 전체를 문항마다 다시 그리면 광고 슬롯도 매번 새로 만들어져 refreshAds()가
// 문항 수만큼 실행된다 — 로드되다 만 노출만 쌓인다. 껍데기는 한 번만 그리고 문항 내용만
// 갈아끼운다(DISC 문항 화면과 같은 패턴).
export function renderCoupleQuestion() {
  const items = state.couple.items;
  if (state.couple.startedAt === null) state.couple.startedAt = Date.now();

  app.appendChild(el(`
    <div>
      <div class="progress-row">
        <button class="back-btn" id="cp-back">‹</button>
        <div class="progress-track"><div class="progress-fill" id="cp-fill" style="width:0%;"></div></div>
        <div class="progress-count" id="cp-count"></div>
      </div>
      ${adSlotMarkup("bannerTop", "margin-top:10px; margin-bottom:4px;")}
      <div class="cp-anchor-notice" id="cp-anchor-notice" hidden>
        🔒 거의 다 왔어요. 남은 문항의 답도 <b>이 기기 밖으로 나가지 않습니다</b> —
        있는 그대로 답해주세요.
      </div>
      <div class="question-block">
        <div class="qno" id="cp-qno"></div>
        <h2 class="disc-scene" id="cp-text"></h2>
      </div>
      <div class="options cp-likert" id="cp-options"></div>
      ${adSlotMarkup("bannerBottom", "margin-top:18px; margin-bottom:4px;")}
    </div>
  `));

  const fill = app.querySelector("#cp-fill");
  const count = app.querySelector("#cp-count");
  const qno = app.querySelector("#cp-qno");
  const textEl = app.querySelector("#cp-text");
  const optionsEl = app.querySelector("#cp-options");
  const notice = app.querySelector("#cp-anchor-notice");

  function finish() {
    state.couple.elapsedMs = Date.now() - state.couple.startedAt;
    state.couple.completed = true;
    go("couple-ad");
  }

  function renderCurrent() {
    const i = state.couple.index;
    const item = items[i];

    fill.style.width = `${Math.round((i / items.length) * 100)}%`;
    count.innerHTML = `${i + 1}<span class="total">/${items.length}</span>`;
    qno.textContent = `Q${i + 1}.`;
    textEl.textContent = item.text;
    // 재고지는 구간 진입 시점에 딱 한 문항에만 붙인다. 앵커 문항 바로 앞에 붙이면
    // 그 문항이 민감하다는 신호가 되어 그 구간에서만 방어적으로 답하게 된다(§6.5.2 v3.2).
    notice.hidden = i !== NOTICE_POSITION - 1;

    const current = state.couple.answers[item.code];
    optionsEl.innerHTML = "";
    for (const opt of LIKERT) {
      const btn = el(`
        <button class="option-btn cp-likert-btn ${current === opt.value ? "picked-most" : ""}">
          <span class="dot"></span>${opt.label}
        </button>
      `);
      btn.addEventListener("click", () => {
        state.couple.answers[item.code] = opt.value;
        state.couple.index += 1;
        if (state.couple.index >= items.length) finish();
        else renderCurrent();
      });
      optionsEl.appendChild(btn);
    }
  }

  // 뒤로 가도 답을 지우지 않는다. ${ITEM_TOTAL}문항짜리 검사에서 직전에 뭘 골랐는지 못 보고
  // 다시 답해야 하는 건 그 자체로 오답을 부른다. 예전에는 여기서 답을 지웠는데,
  // "답이 다 찼으면 완료"라고 진행 상태를 세고 있어서 지우지 않으면 결과 화면 guard가
  // 통과해버렸기 때문이다 — 진행 상태를 `completed` 플래그로 옮기면서 그럴 이유가 없어졌다.
  app.querySelector("#cp-back").addEventListener("click", () => {
    if (state.couple.index > 0) {
      state.couple.index -= 1;
      renderCurrent();
    } else {
      go("couple-setup");
    }
  });

  setExitGuard(resetCouple);
  renderCurrent();
}

// ---------------------------------------------------------------- 광고 게이트

export function renderCoupleAd() {
  app.appendChild(el(`
    <div>
      <div class="back-row">
        <div class="back-title">결과 준비 중</div>
      </div>
      ${adGateMarkup("수고하셨어요! 결과 보러 가기 전에\n광고 하나만 보고 갈게요 🙏")}
    </div>
  `));
  bindNav(app);
  bindAdGate(app, () => go("couple-result"));
}

// ---------------------------------------------------------------- 결과 부품

function confidenceText(behavior) {
  const first = BEHAVIOR_LABELS[behavior.primary];
  const second = BEHAVIOR_LABELS[behavior.secondary];
  if (behavior.confidence === "clear") return `${first} 성향이 다른 성향들보다 뚜렷하게 높게 나왔어요.`;
  if (behavior.confidence === "moderate") return `${second} 성향도 가깝게 나왔지만, ${first} 쪽이 조금 더 높아요.`;
  return `${first}과 ${second}이 거의 같은 크기로 나왔어요. 상황에 따라 두 모습이 번갈아 나오는 편일 수 있습니다.`;
}

// 성향 막대는 항상 confidenceText()로 풀어주는데, 가까움·거리 막대는 경계선(edge)일 때만
// 문장이 붙어서 "19점이 뭘 뜻하는지" 자체를 알 수 없는 경우가 있었다(edge가 아니어도).
// 두 축을 항상 말로 풀어준다 — 유형 이름(AT1~AT4)이 이미 위 카드에 나와 있지만, 그 이름과
// 지금 이 두 막대가 같은 걸 가리킨다는 연결을 여기서도 한 번 더 지어준다.
function attachmentText(attachment) {
  const anxWord = attachment.anx.high ? "가까움을 자주 확인하고 싶어하는 편" : "가까움을 확인하지 않아도 편안한 편";
  const avoWord = attachment.avo.high ? "혼자만의 거리를 두는 게 편한 편" : "거리를 크게 두지 않아도 괜찮은 편";
  return `${anxWord}이고, ${avoWord}이에요.`;
}

// 한 화면에 전부 펼쳐놓으면 정보가 많아 무겁게 읽힌다. 핵심(유형 + 네 성향 점수 +
// 실행 제안)만 펼쳐두고 나머지는 접는다 — 감추는 게 아니라 순서를 준 것이라, 펼치면
// §6.4가 요구하는 블록이 전부 그대로 있다.
export function foldMarkup(title, body) {
  return `
    <details class="cp-fold">
      <summary>${title}</summary>
      <div class="cp-fold-body">${body}</div>
    </details>
  `;
}

// 백분위·석차 표현은 쓰지 않는다. 비교할 규준 표본이 없는 상태에서 "상위 20%"라고 쓰는
// 것은 허위 정보다 — 절대값과 기준선만 보여주고 사용자가 직접 위치를 읽게 한다(§6.2).
function barMarkup(label, value, { midline = false, desc = "", valueText = "" } = {}) {
  return `
    <div class="cp-bar-row">
      <div class="cp-bar-head"><span>${label}</span><b>${valueText || `${Math.round(value)}점`}</b></div>
      <div class="cp-bar-track">
        ${midline ? '<span class="cp-bar-mid"></span>' : ""}
        <span class="cp-bar-fill" style="width:${Math.max(2, Math.round(value))}%;"></span>
      </div>
      ${desc ? `<div class="cp-bar-desc">${desc}</div>` : ""}
    </div>
  `;
}

function profileMarkup(r) {
  return `
    <div class="cp-profile">
      <div class="cp-block-title">네 가지 성향 점수</div>
      ${BEHAVIOR_AXES.map((ax) =>
        barMarkup(BEHAVIOR_LABELS[ax], r.norm[ax], { desc: BEHAVIOR_AXIS_MEANING[ax] })
      ).join("")}
      <p class="cp-note">${confidenceText(r.behavior)}</p>
      <div class="cp-block-title" style="margin-top:18px;">가까움과 거리</div>
      <p class="cp-block-sub">가운데 선이 중간이에요.</p>
      ${barMarkup(AXIS_LABELS.ANX, r.norm.ANX, { midline: true })}
      ${barMarkup(AXIS_LABELS.AVO, r.norm.AVO, { midline: true })}
      <p class="cp-note">${attachmentText(r.attachment)}</p>
      ${r.attachment.anx.edge || r.attachment.avo.edge
        ? `<p class="cp-note">${[
            r.attachment.anx.edge ? AXIS_LABELS.ANX : null,
            r.attachment.avo.edge ? AXIS_LABELS.AVO : null,
          ].filter(Boolean).join("·")}는 딱 가운데쯤이라 어느 쪽이라고 말하기 어려워요.</p>`
        : ""}
      <p class="cp-note">${ATTACH_TYPES[r.attachment.key].desc}</p>
    </div>
  `;
}

// 심화 서술의 한 조각(제목 + 문단들). 개인 성향 카드와 갈등 접기 블록이 같이 쓴다 —
// 두 곳에 따로 쓰면 문단 간격·제목 크기가 갈라진다.
function deepSection(label, paragraphs) {
  const body = paragraphs.filter(Boolean).map((p) => `<p class="cp-note">${p}</p>`).join("");
  return `
    <div class="cp-deep-sec">
      <div class="cp-deep-label">${label}</div>
      ${body}
    </div>
  `;
}

// 유형 카드 한 문단 + 막대 여덟 개만으로는 "그래서 나는 어떤 배우자인가"가 남지 않는다는
// 지적(2026-08-11, D-107)에 대응한 블록. 성향(가장 높게 나온 축)과 애착(가까움·거리 조합)을
// 같은 다섯 갈래로 나란히 읽어준다 — 두 체계를 따로 두 문단씩 늘어놓는 것보다, 같은 질문에
// 대한 두 답으로 묶는 편이 읽는 사람에게 하나의 상으로 맺힌다.
//
// **접어둔다(D-113, §7-2 다듬기).** D-107 당시엔 "이 블록이 없어서 결과가 부실하다"는
// 지적이 막 나온 참이라, 접으면 지적받은 내용이 안 보이는 상태로 남을까 봐 일부러
// 펼쳐뒀다. 이후 D-110·D-111·D-112으로 결과 전체가 몇 배로 두꺼워졌고, 이 블록(성향×애착
// 다섯 갈래)이 펼침 구간 중 가장 길어서 첫 화면 체감 분량을 가장 많이 차지하고 있었다 —
// "그래서 늘어난 콘텐츠를 한 번 정리(다듬기)하자"는 후속 요청에 따라, 이제 결과의 핵심
// 3요소(유형 라벨·연속 프로필·확신도, §6.1)는 그대로 펼쳐둔 채 이 블록만 다른 심화
// 서술들(역할·자녀·갈등·애정 표현)과 같은 자리로 옮긴다 — 내용을 줄이는 게 아니라
// 순서를 다시 준 것이라, 펼치면 전부 그대로 있다(§7-2 원칙 그대로).
function personaBody(r) {
  const b = BEHAVIOR_DEEP[r.behavior.primary];
  const a = ATTACH_DEEP[r.attachment.key];
  // 두 성향이 가깝게 나온 경우(§5.3 확신도 clear가 아님) 1위만 길게 설명하면 설명의
  // 절반이 틀린 말이 된다. 확신도 문장(confidenceText)이 이미 위에 있지만, 그건 점수
  // 얘기라 "그래서 어떤 모습이 더 나오나"까지는 말해주지 않는다.
  const blend =
    r.behavior.confidence === "clear"
      ? ""
      : `${BEHAVIOR_LABELS[r.behavior.secondary]} 성향도 가깝게 나왔어요 — ${BEHAVIOR_DEEP[r.behavior.secondary].short} 상황에 따라 이쪽이 더 크게 나올 수 있습니다.`;

  return `
    <p class="cp-block-sub">가장 높게 나온 ${BEHAVIOR_LABELS[r.behavior.primary]} 성향과
    가까움·거리에서 나온 ${ATTACH_TYPES[r.attachment.key].name}을 함께 읽은 설명이에요.</p>
    ${deepSection("🧩 평소 관계에서는", [b.nature, a.nature, blend])}
    ${deepSection("💭 속으로 자주 하는 생각", [b.thought, a.thought])}
    ${deepSection("🌧️ 힘든 일이 닥쳤을 때", [b.crisis, a.crisis])}
    ${deepSection("🗣️ 이렇게 말하면 잘 통해요", [b.talk, a.talk])}
    ${deepSection("🙊 이런 말은 조심하세요", [b.avoid, a.avoid])}
  `;
}

// 갈등 스타일은 §6.4의 리포트 블록에 없다 — 대화 스크립트를 고르는 재료다. 표면에
// 성향 유형·애착 유형·갈등 스타일 세 체계를 한꺼번에 내놓으면 읽는 사람이 무엇을 기억해야
// 하는지 알 수 없어져서, 축 점수 막대는 빼고 접어둔다. 필요한 사람만 펼쳐본다.
//
// "🕊️ 나에게 와닿는 화해법"은 애정 표현 유형(D-111)을 여기 엮은 것이다. 갈등 스타일(5) ×
// 애정 표현(5) = 25개 문장을 새로 쓰는 대신, 애정 표현 유형 쪽의 `repair` 문장 하나를
// 그대로 얹었다 — 두 체계가 서로 무관하게 따로 놀지 않으면서도 조합 폭발을 피하는
// 자리다("결과들이 서로 엮여야지 따로 놀면 안 된다"는 지적에 대한 구체적 답).
function conflictBody(r) {
  const style = CONFLICT_STYLES[r.conflict.style];
  // 절충형(CS5)에만 붙는 한 문단(D-114). CS1~CS4는 shape과 스타일이 1:1이라
  // 여기서 undefined가 되고, 그때는 문단 자체가 안 나간다.
  const shade = CS5_SHADES[r.conflict.shape];
  return `
    <p class="cp-note">부딪혔을 때 <b>${style.name}</b>에 가까워요.
    ${r.conflict.confidence === "edge" ? "다만 경계에 가까워서 상황에 따라 달라질 수 있어요." : ""}</p>
    <p class="cp-note">${style.desc}</p>
    ${shade ? `<p class="cp-note cp-shade"><b>${shade.lean}.</b> ${shade.text}</p>` : ""}
    ${deepSection("🌪️ 다툼이 커질 때", [style.crisis])}
    ${deepSection("🩹 다투고 난 뒤에는", [style.repair])}
    ${deepSection("🙊 이런 말은 조심하세요", [style.avoid])}
    ${deepSection("🕊️ 나에게 와닿는 화해법", [LOVE_TYPES[r.love.primary].repair])}
    ${barMarkup(AXIS_LABELS.SC, r.norm.SC)}
    ${barMarkup(AXIS_LABELS.OC, r.norm.OC)}
  `;
}

// 애정 표현 5유형(D-111) 결과 블록. 유형 하나(가장 높게 나온 것)만 배지처럼 보여주지
// 않고, 다른 유형 체계와 같은 무게로 다섯 축 막대 + 구간 설명을 전부 편다 — "구체적인
// 결과값"을 원한 요청에 답하는 자리라, 여기서마저 아끼면 목적이 무색해진다.
function loveBody(r) {
  const t = LOVE_TYPES[r.love.primary];
  return `
    <p class="cp-note">사랑받는다고 느끼는 방식은 <b>${t.emoji} ${t.name}</b>에 가까워요.
    ${r.love.confidence === "edge" ? "다만 경계에 가까워서 다른 방식도 비슷하게 크게 느낄 수 있어요." : ""}</p>
    <p class="cp-note">${t.desc}</p>
    ${deepSection("💡 이런 오해는 조심하세요", [t.avoid])}
    ${LOVE_AXES.map((ax) =>
      barMarkup(LOVE_LABELS[ax], r.norm[ax], { desc: LOVE_AXIS_MEANING[ax] })
    ).join("")}
  `;
}

// 자기보고 항목(앵커·역할·자녀) 한 줄. 1~5 척도라 0~100 막대와 눈금이 다르므로 숫자를
// 그대로 쓰지 않고 "5점 중 3.5"로 적는다 — 63점짜리 성향 막대와 나란히 놓였을 때
// 같은 척도로 오해하지 않게 하는 게 목적이다.
//
// `watch` 방향으로 나온 항목에만 대화 문장이 붙는다(READING_TEXT 주석 참고).
function readingMarkup(reading) {
  const t = READING_TEXT[reading.key];
  const pct = ((reading.score - 1) / 4) * 100;
  return `
    <div class="cp-reading">
      ${barMarkup(t.label, pct, {
        midline: true,
        desc: t.desc,
        valueText: `5점 중 ${reading.score.toFixed(1)}`,
      })}
      <p class="cp-note">${t[reading.level]}</p>
      ${reading.consistent
        ? ""
        : `<p class="cp-note cp-reading-shaky">이 항목은 비슷한 두 문항에 서로 다르게 답하셔서, 참고로만 봐주세요.</p>`}
      ${reading.watched
        ? `<div class="cp-script"><div class="cp-script-title">💬 이렇게 말문을 열어보세요</div><p>${t.script}</p></div>`
        : ""}
    </div>
  `;
}

function readingsOf(r, group) {
  return r.readings.filter((x) => x.group === group).map(readingMarkup).join("");
}

// 앵커 세 문항은 예전엔 부부의 인지 격차를 내는 데에만 쓰였다(D-108로 그 흐름이 사라짐).
// 지금은 내 답을 그대로 읽어주는 자리다 — 결과에서 가장 "지금의 나"에 가까운 값이라
// 접지 않고 펼쳐둔다. 비교 대상이 없으니 방향·지목 문제(§6.5.3)도 성립하지 않는다.
function feelingsMarkup(r) {
  return `
    <div class="cp-profile cp-feelings">
      <div class="cp-block-title">지금 내가 느끼고 있는 것</div>
      <p class="cp-block-sub">성향과 달리 이 값들은 <b>시기에 따라 움직여요.</b>
      지금 이 시기의 상태로 읽어주세요.</p>
      ${readingsOf(r, "feel")}
    </div>
  `;
}

function roleBody(r) {
  if (!r.setup) return "";
  const identity = r.roleIdentity >= 4 ? ROLE_IDENTITY_NOTE.high : r.roleIdentity <= 2 ? ROLE_IDENTITY_NOTE.low : "";
  return `
    <p>${ROLE_NARRATIVE[r.behavior.primary][r.setup.r]}</p>
    ${identity ? `<p>${identity}</p>` : ""}
    ${readingsOf(r, "role")}
  `;
}

function childBody(r) {
  if (!r.setup) return "";
  return `
    <p>${CHILD_NARRATIVE[r.setup.k]}</p>
    ${readingsOf(r, "child")}
  `;
}

function actionMarkup(r) {
  // 애정 표현 유형(D-111)의 실행 제안도 여기 세 번째 항목으로 합류한다 — 새 블록을
  // 만들지 않고 기존 목록에 얹는 방식이라 "배우자에게 보여주세요" 자리 하나로 세
  // 체계(성향·애착·애정 표현)의 결론이 모인다.
  const dos = [...DOS_BEHAVIOR[r.behavior.primary], DOS_ATTACH[r.attachment.key], DOS_LOVE[r.love.primary]];
  const donts = [...DONTS_BEHAVIOR[r.behavior.primary], DONTS_ATTACH[r.attachment.key], DONTS_LOVE[r.love.primary]];
  return `
    <div class="cp-action">
      <div class="cp-block-title">배우자에게 보여주세요</div>
      <p class="cp-block-sub">나를 이렇게 대해주면 좋아요.</p>
      <div class="cp-do-list">
        ${dos.map((d) => `<div class="cp-do">✅ ${d}</div>`).join("")}
        ${donts.map((d) => `<div class="cp-dont">🚫 ${d}</div>`).join("")}
      </div>
      <div class="cp-script">
        <div class="cp-script-title">💬 나에게는 이렇게 말해주세요</div>
        <p>${CONFLICT_SCRIPTS[r.conflict.style]}</p>
      </div>
    </div>
  `;
}

// 사유를 특정하지 않는다. 속도 외의 사유로 플래그가 섰을 때 "빠르게 진행되어"라고
// 안내하면 사실과 다른 말이 나간다(§5.0 v3.1 교정 3).
function warnMarkup(validity) {
  if (validity.verdict !== "warn") return "";
  return `<div class="cp-warn">⚠️ 일부 문항의 응답이 서로 엇갈려 결과 정확도가 낮을 수 있어요.</div>`;
}

// ---------------------------------------------------------------- 개인 결과

export function renderCoupleResult() {
  const r = result();

  // 플래그가 2개 이상이면 결과를 내지 않는다(§5.0). 부정확한 데이터로 산출된 성향
  // 서술은 도움이 되기는커녕 자기 이해를 엉뚱한 쪽으로 굳힌다.
  if (r.validity.verdict === "blocked") {
    app.appendChild(el(`
      <div>
        <div class="empty-state">
          <div class="emoji">🙏</div>
          <div class="msg">응답을 다시 한 번 천천히 진행해 주세요</div>
        </div>
        <ul class="cp-flag-list">${r.validity.flags.map((f) => `<li>${f}</li>`).join("")}</ul>
        <p class="disclaimer">지금 응답으로 결과를 내면 실제와 다른 유형이 나올 가능성이 높아요.
        도움이 되는 결과를 위해 결과 산출을 건너뛰었습니다.</p>
        <div class="cta">
          <button class="cta-btn" id="cp-retry">처음부터 다시 하기</button>
        </div>
      </div>
    `));
    bindNav(app);
    app.querySelector("#cp-retry").addEventListener("click", () => {
      resetCouple();
      go("couple-intro");
    });
    return;
  }

  const t = COUPLE_TYPES[r.typeKey];

  app.appendChild(el(`
    <div>
      ${warnMarkup(r.validity)}
      <div class="result-card">
        <div class="eyebrow">나의 관계 성향은</div>
        <div class="emoji">${t.emoji}</div>
        <h2>${t.name}</h2>
        <div class="result-subtitle">${ATTACH_TYPES[r.attachment.key].name} · ${BEHAVIOR_LABELS[r.behavior.primary]}</div>
        <p>${t.desc}</p>
      </div>

      ${profileMarkup(r)}
      ${feelingsMarkup(r)}
      ${foldMarkup("나는 어떤 배우자일까요", personaBody(r))}
      ${foldMarkup("무엇으로 사랑받는다고 느끼나요", loveBody(r))}
      ${foldMarkup("지금의 역할, 나에게는", roleBody(r))}
      ${foldMarkup("자녀 시기와 두 사람", childBody(r))}
      ${foldMarkup("갈등이 생겼을 때", conflictBody(r))}
      ${actionMarkup(r)}

      ${shareBlockMarkup("내 유형을 친구에게 보여주기")}

      ${adSlotMarkup("rect")}

      ${SUPPORT_MARKUP}
      <p class="disclaimer">${SERVICE_NOTICE}</p>

      <div class="next-block">
        <div class="section-title" style="padding:0 0 9px;">이런 것도 해봤어? 🎲</div>
        <div class="next-row">
          <button class="next-card" data-nav="disc-intro"><div class="icon">🎭</div><div class="label">직장인 유형검사</div></button>
        </div>
      </div>

      <button class="retry-btn" id="cp-retry">🔄 다시 해보기</button>
    </div>
  `));
  bindNav(app);

  app.querySelector("#cp-retry").addEventListener("click", () => {
    resetCouple();
    go("couple-intro");
  });

  // 공유는 "내 유형 소개 페이지" 주소로만 한다. 응답이 담긴 주소는 이 앱 어디에서도
  // 만들지 않는다(D-108에서 그 경로 자체를 없앴다).
  wireShare(app, {
    url: `${location.origin}/test/couple/result/${t.slug}`,
    text: `부부 관계 성향 체크에서 "${t.name}"이 나왔어요. 당신은 어떤 유형인가요?`,
    filename: "과몰입구역-부부관계성향-결과카드.png",
    draw: () => drawCoupleCard(r),
  });
}

// ---------------------------------------------------------------- 공유된 유형 페이지

export function renderCoupleShared() {
  const shared = parseSharedPath(location.pathname);
  const t = COUPLE_TYPES[shared.key];
  const [primary, attach] = shared.key.split("-");

  app.appendChild(el(`
    <div>
      <div class="back-row">
        <button class="back-btn" data-nav="home">‹</button>
        <div class="back-title">심리테스트</div>
      </div>
      ${adSlotMarkup("bannerTop", "margin-top:10px; margin-bottom:4px;")}
      <div class="result-card">
        <div class="eyebrow">이 유형은</div>
        <div class="emoji">${t.emoji}</div>
        <h2>${t.name}</h2>
        <div class="result-subtitle">${ATTACH_TYPES[attach].name} · ${BEHAVIOR_LABELS[primary]}</div>
        <p>${t.desc}</p>
      </div>
      <div class="cp-action">
        <div class="cp-block-title">이 유형을 대할 때</div>
        <div class="cp-do-list">
          ${[...DOS_BEHAVIOR[primary], DOS_ATTACH[attach]].map((d) => `<div class="cp-do">✅ ${d}</div>`).join("")}
          ${[...DONTS_BEHAVIOR[primary], DONTS_ATTACH[attach]].map((d) => `<div class="cp-dont">🚫 ${d}</div>`).join("")}
        </div>
      </div>
      <p class="disclaimer">${SERVICE_NOTICE}</p>
      <div class="cta" style="padding-top:18px;">
        <button class="cta-btn" data-nav="couple-intro">나는 어떤 유형인지 해보기</button>
      </div>
      ${adSlotMarkup("bannerBottom", "margin-top:6px; margin-bottom:22px;")}
    </div>
  `));
  bindNav(app);
}

// ---------------------------------------------------------------- 공유 카드

async function drawCoupleCard(r) {
  const t = COUPLE_TYPES[r.typeKey];
  const { canvas, ctx, W } = createCoupleCanvas();

  ctx.font = "150px sans-serif";
  ctx.fillText(t.emoji, W / 2, 290);

  ctx.fillStyle = "#fff";
  ctx.font = "800 66px Pretendard, sans-serif";
  ctx.fillText(t.name, W / 2, 396);

  ctx.font = "700 30px Pretendard, sans-serif";
  const sub = `${ATTACH_TYPES[r.attachment.key].name} · ${BEHAVIOR_LABELS[r.behavior.primary]}`;
  const subW = ctx.measureText(sub).width + 60;
  ctx.fillStyle = "rgba(255,255,255,.18)";
  roundRect(ctx, W / 2 - subW / 2, 430, subW, 56, 28);
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.fillText(sub, W / 2, 468);

  // 네 성향 점수를 카드에도 그대로 싣는다 — 라벨만 공유되면 결과 화면이 애써 보존한
  // 연속 프로필 정보가 공유 단계에서 다시 사라진다(§6.1).
  const barW = 620;
  const left = (W - barW) / 2;
  let y = 570;
  ctx.font = "600 30px Pretendard, sans-serif";
  for (const ax of BEHAVIOR_AXES) {
    const v = r.norm[ax];
    ctx.textAlign = "left";
    ctx.fillStyle = "rgba(255,255,255,.85)";
    ctx.fillText(BEHAVIOR_LABELS[ax], left, y - 12);
    ctx.textAlign = "right";
    ctx.fillText(`${Math.round(v)}`, left + barW, y - 12);
    ctx.fillStyle = "rgba(255,255,255,.22)";
    roundRect(ctx, left, y, barW, 20, 10);
    ctx.fill();
    ctx.fillStyle = "#fff";
    roundRect(ctx, left, y, Math.max(20, (barW * v) / 100), 20, 10);
    ctx.fill();
    y += 78;
  }

  ctx.textAlign = "center";
  ctx.font = "700 34px Pretendard, sans-serif";
  ctx.fillStyle = "#fff";
  ctx.fillText("우리는 서로를 어떻게 보고 있을까?", W / 2, 968);
  drawCoupleCardFooter(ctx, W);

  return canvas;
}

// ---------------------------------------------------------------- 이용 안내

// 이 화면이 있는 이유(D-108로 목적이 바뀜): 예전에는 "둘이 하면 더 정확해지는 게 아니라
// 다른 게 나온다"는 오해를 미리 풀어주는 화면이었다. 배우자와 합치는 흐름을 없앤 뒤로는
// **결과를 어떻게 읽어야 하는가**를 맡는다 — 유형 이름 하나로 자기를 규정해버리는 것이
// 이 검사에서 가장 흔한 오독이고, 결과 화면 안에 다 적으면 정작 결과가 안 읽힌다.
export function renderCoupleGuide() {
  const anchorPerConcept = ANCHOR_ITEMS.length / ANCHOR_CONCEPTS.length;

  app.appendChild(el(`
    <div>
      <div class="back-row">
        <button class="back-btn" data-nav="couple-intro">‹</button>
        <div class="back-title">이용 안내</div>
      </div>
      ${adSlotMarkup("bannerTop", "margin-top:10px; margin-bottom:4px;")}

      <div class="cover">
        <div class="emoji">📖</div>
        <div class="tag">부부 관계 성향 체크</div>
        <h2>결과를<br/>어떻게 읽을까?</h2>
        <p>유형 이름 하나로 나를 규정하지 않는 게<br/>이 결과를 제대로 쓰는 방법이에요.</p>
      </div>

      <div class="cp-profile">
        <div class="cp-block-title">무엇이 나오나요</div>
        <ol class="cp-guide-steps">
          <li>관계 성향 유형과 <b>네 가지 성향 점수</b></li>
          <li>평소 모습 · 속마음 · 힘들 때 · 대화법 <b>심화 서술</b></li>
          <li>지금 <b>내가 느끼고 있는 것</b>(알아줌 · 부담 · 분담)</li>
          <li>지금의 <b>역할과 자녀 시기</b>가 나에게 어떤지</li>
          <li>배우자에게 보여줄 <b>실행 제안</b>과 대화 문장</li>
        </ol>
      </div>

      <div class="cp-profile cp-guide-key">
        <div class="cp-block-title">⚠️ 오해하기 쉬운 것</div>
        <p class="cp-guide-lead">이 결과는 <b>지금의 나</b>를 찍은 사진이지, 정해진 성격표가 아닙니다.</p>
        <p>점수는 <b>내가 답한 문항 ${ITEM_TOTAL}개만으로</b> 계산돼요. 요즘 유난히 지쳐 있다면
        그 상태가 그대로 실립니다 — 그래서 시기를 달리해 다시 해보면 값이 조금씩 움직여요.
        <b>그게 오류가 아니라 이 검사가 재는 것의 성질</b>입니다.</p>
      </div>

      <div class="cp-profile">
        <div class="cp-block-title">이렇게 써보세요</div>
        <div class="cp-guide-story">
          <p>결과를 <b>배우자에게 보여주는 것</b>까지가 이 체크의 절반이에요. 특히 "배우자에게
          보여주세요" 블록은 처음부터 그러라고 만든 문장들입니다.</p>
          <p>혼자 읽고 끝내도 괜찮아요. 다만 <b>마음에 걸린 항목 하나</b>만 골라
          그 밑에 붙은 대화 문장을 그대로 꺼내보시면, 평소에 안 하던 이야기가 시작됩니다.</p>
          <p class="punch">읽는 게 아니라 <b>말을 걸어보는 것</b>이 목적이에요.</p>
        </div>
      </div>

      ${foldMarkup(
        "배우자와 결과를 합쳐 볼 수는 없나요?",
        `<p>예전에는 짧은 코드로 두 사람의 결과를 합쳐 <b>같은 질문에 서로 얼마나 다르게 답했는지</b>를
         보여줬지만, 지금은 그 기능을 <b>없앴습니다.</b></p>
         <p>차이를 숫자로 받아든 두 사람이 그걸 대화가 아니라 근거로 쓰게 되는 순간,
         이 도구는 도움이 아니라 다툼의 재료가 됩니다. 그 위험을 화면 문구로 막는 데에는
         한계가 있어서 <b>기능 자체를 내려놓는 쪽</b>을 택했어요.</p>
         <p>대신 각자 해보고 <b>결과 화면을 서로 보여주는 것</b>은 언제든 할 수 있습니다 —
         그게 원래 얻고 싶었던 대화에 더 가깝습니다.</p>`
      )}

      ${foldMarkup(
        "왜 문항이 이렇게 많나요?",
        `<p>성향 하나를 문항 하나로 재면 그날 기분이 그대로 결과가 됩니다. 그래서 성향마다
         여러 문항을 두고 평균을 냈고, 특히 흔들리기 쉬운 항목은 개념 하나당
         ${anchorPerConcept}문항씩 모두 ${ANCHOR_ITEMS.length}문항을 써서 두껍게 받쳤습니다.</p>
         <p>중간에 방향이 반대인 문장이 섞여 있는 것도 같은 이유예요 — 읽지 않고 한쪽으로만
         찍으면 그게 드러나서, 그때는 결과를 내지 않고 다시 해달라고 안내합니다.</p>`
      )}

      ${foldMarkup(
        "자주 묻는 것",
        `<div class="cp-guide-qa">
          <div class="q">내 답이 어디에 저장되나요?</div>
          <p>저장되지 않습니다. 답과 결과 모두 이 기기의 메모리에만 있고,
          <b>새로고침하면 사라집니다.</b> 서버로 전송되는 값도 없어요.</p>

          <div class="q">"결과를 만들 수 없다"고 나와요.</div>
          <p>응답이 너무 빠르거나 한쪽 값으로만 치우쳤을 때예요. 천천히 다시 해주시면 됩니다.</p>

          <div class="q">결과가 나랑 안 맞는 것 같아요.</div>
          <p>유형 이름보다 <b>네 성향 점수</b>를 봐주세요. 1·2위가 거의 붙어 있으면
          결과 화면이 그렇게 알려드리는데, 그런 경우는 원래 단정하기 어려운 값이에요.</p>

          <div class="q">역할이나 자녀 단계를 잘못 골랐어요.</div>
          <p>처음부터 다시 하시면 됩니다. 그 세 가지는 문항 문장을 고르는 데 쓰여서,
          중간에 바꾸면 이미 답한 문항과 문장이 어긋나거든요.</p>

          <div class="q">다시 해도 되나요?</div>
          <p>언제든지요. 다만 짧은 간격으로 반복하면 성향이 아니라
          "지난번에 뭐라고 답했는지"를 재게 됩니다.</p>
        </div>`
      )}

      ${SUPPORT_MARKUP}
      <p class="disclaimer">${SERVICE_NOTICE}</p>

      <div class="cta">
        <button class="cta-btn" data-nav="couple-intro">시작하러 가기</button>
      </div>
      ${adSlotMarkup("bannerBottom", "margin-top:6px; margin-bottom:22px;")}
    </div>
  `));
  bindNav(app);
}
