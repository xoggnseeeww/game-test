// 부부 관계 성향 체크의 화면들 — 문항 진행·개인 결과까지. 배우자와 합치는 흐름
// (초대·코드 입력·결합 결과)은 screens-match.js에 있다. 그쪽이 이 파일의
// resetCouple·coupleReady·partnerFromUrl·result·foldMarkup과 아래 세 상수를
// 가져다 쓴다 — 반대 방향은 없다(이 파일은 screens-match.js를 모른다).
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
  ATTACH_TYPES,
  CONFLICT_STYLES,
  AXIS_LABELS,
  COUPLE_TYPES,
  ROLE_NARRATIVE,
  CHILD_NARRATIVE,
  DOS_BEHAVIOR,
  DOS_ATTACH,
  DONTS_BEHAVIOR,
  DONTS_ATTACH,
  CONFLICT_SCRIPTS,
} from "./data.js";
import { computeCouple, BEHAVIOR_AXES } from "./score.js";
import { assembleQuestionnaire, NOTICE_POSITION } from "./assemble.js";
import { decodePartner, encodePartner } from "./match.js";
import { formatShortCode } from "./shortcode.js";
import { ensureShortCode } from "./remote.js";
import { createCoupleCanvas, drawCoupleCardFooter } from "./card.js";

const COMBO_COUNT = T_AXIS.length * R_AXIS.length * K_AXIS.length;

// 결과 어디에도 진단·예측으로 읽힐 문장을 두지 않는다(§9.3). 이 한 줄이 나머지 안전
// 장치보다 실질적으로 더 중요하다 — 사용자가 결과를 판정이 아니라 대화 소재로 받아들이게
// 만드는 프레이밍이기 때문이다.
export const SERVICE_NOTICE =
  "이 체크는 두 분이 서로를 이해하는 대화를 돕기 위한 도구입니다. 심리 상태를 진단하거나 관계의 미래를 예측하지 않습니다.";

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

// 응답 공개 범위 고지(§6.5.2). 기획서 원문은 "배우자가 볼 수 없습니다"라고 단정하지만,
// 이 사이트는 백엔드가 없어 결과를 링크에 실어 보낸다. 링크에 담기는 것과 화면에 보이는
// 것을 정확히 구분해서 적었다 — 지키지 못할 약속을 해두면 고지 자체가 신뢰를 잃는다.
export const PRIVACY_MARKUP = `
  <div class="cp-privacy">
    <div class="cp-privacy-title">🔒 문항별 답은 배우자에게 보여지지 않아요</div>
    <p>배우자와 결과를 합쳐 봐도, 각 문항에 어떻게 답했는지는 어느 화면에도 표시되지 않습니다.
    두 분의 결과를 비교한 요약만 함께 보시게 됩니다.</p>
    <p><b>솔직하게 답할수록 두 분에게 실제로 도움이 되는 결과가 나옵니다.</b>
    배우자를 배려해서 좋게 답하시면, 정작 두 분이 풀어야 할 문제를 놓치게 됩니다.</p>
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
    partner: state.couple ? state.couple.partner : null,
    shortCode: null,
  };
}

// 문항을 끝까지 마쳤을 때만 true. 진행 상태를 answers 개수로 세지 않는 이유는
// state.js의 `completed` 주석 참고 — 뒤로 가서 답을 다시 보는 중에도 답은 전부 차 있다.
export function coupleReady() {
  const c = state.couple;
  return Boolean(c.completed && c.items && Object.keys(c.answers).length >= c.items.length);
}

// 응답 품질 플래그가 2개 이상이면 결과를 내지 않는다(§5.0). 배우자 초대 링크도 같은 기준으로
// 막는다 — 결과가 안 나올 응답으로 코드를 만들어 보내면 배우자만 헛수고한다.
export function coupleBlocked() {
  return coupleReady() && result().validity.verdict === "blocked";
}

// 결과는 화면을 다시 그릴 때마다 같은 값이어야 한다. 순수 함수라 매번 계산해도 되지만,
// 소요시간만은 완료 시점에 한 번 고정해둔다.
export function result() {
  return computeCouple(state.couple.answers, {
    elapsedMs: state.couple.elapsedMs,
    setup: state.couple.setup,
  });
}

// 배우자 코드는 주소(?p=)에만 있고 state에는 캐시해둔다. 뒤로가기로 이 화면에 다시 와도
// 코드를 잃지 않게 하기 위해서다.
export function partnerFromUrl() {
  const code = new URLSearchParams(location.search).get("p");
  if (!code) return state.couple.partner;
  const decoded = decodePartner(code);
  if (decoded) state.couple.partner = decoded;
  return decoded;
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
        <p>문항 ${ITEM_TOTAL}개에 답하면 나의 관계 성향이 나와요.<br/>배우자와 각자 해보고 결과를 합칠 수도 있어요.</p>
      </div>
      <div class="meta-chips">
        <div class="meta-chip"><div class="value">${ITEM_TOTAL}문항</div><div class="label">약 6분 30초</div></div>
        <div class="meta-chip"><div class="value">${COMBO_COUNT}가지</div><div class="label">상황 조합</div></div>
        <div class="meta-chip"><div class="value">${Object.keys(COUPLE_TYPES).length}가지</div><div class="label">결과 유형</div></div>
      </div>
      ${PRIVACY_MARKUP}
      <p class="disclaimer">${SERVICE_NOTICE}</p>
      <div class="cta">
        <button class="cta-btn" id="cp-start">시작하기</button>
      </div>
      <div class="cp-guide-link"><button data-nav="couple-pair">💌 부부 결과 매칭 — 배우자 코드가 있어요</button></div>
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
      ${axisGroupMarkup("자녀는", "배우자와 함께 결과를 보려면 같은 항목을 골라야 해요", "k", K_AXIS)}
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
        🔒 거의 다 왔어요. 남은 문항도 <b>배우자에게 문항별로 보여지지 않습니다</b> —
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
  // 배우자 초대 링크를 타고 들어와 문항을 마친 경우엔 결합 결과가 목적지다. 개인 결과로
  // 보내면 초대받은 쪽은 "합쳐서 보자"던 것을 스스로 다시 찾아가야 한다.
  bindAdGate(app, () => go(state.couple.partner ? "couple-report" : "couple-result"));
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
function barMarkup(label, value, { midline = false } = {}) {
  return `
    <div class="cp-bar-row">
      <div class="cp-bar-head"><span>${label}</span><b>${Math.round(value)}점</b></div>
      <div class="cp-bar-track">
        ${midline ? '<span class="cp-bar-mid"></span>' : ""}
        <span class="cp-bar-fill" style="width:${Math.max(2, Math.round(value))}%;"></span>
      </div>
    </div>
  `;
}

function profileMarkup(r) {
  return `
    <div class="cp-profile">
      <div class="cp-block-title">네 가지 성향 점수</div>
      ${BEHAVIOR_AXES.map((ax) => barMarkup(BEHAVIOR_LABELS[ax], r.norm[ax])).join("")}
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
          ].filter(Boolean).join("·")}은 딱 가운데쯤이라 어느 쪽이라고 말하기 어려워요.</p>`
        : ""}
      <p class="cp-note">${ATTACH_TYPES[r.attachment.key].desc}</p>
    </div>
  `;
}

// 갈등 스타일은 §6.4의 리포트 블록에 없다 — 대화 스크립트를 고르는 재료다. 표면에
// 성향 유형·애착 유형·갈등 스타일 세 체계를 한꺼번에 내놓으면 읽는 사람이 무엇을 기억해야
// 하는지 알 수 없어져서, 축 점수 막대는 빼고 접어둔다. 필요한 사람만 펼쳐본다.
function conflictBody(r) {
  return `
    <p class="cp-note">부딪혔을 때 <b>${CONFLICT_STYLES[r.conflict.style].name}</b>에 가까워요.
    ${r.conflict.confidence === "edge" ? "다만 경계에 가까워서 상황에 따라 달라질 수 있어요." : ""}</p>
    <p class="cp-note">${CONFLICT_STYLES[r.conflict.style].desc}</p>
    ${barMarkup(AXIS_LABELS.SC, r.norm.SC)}
    ${barMarkup(AXIS_LABELS.OC, r.norm.OC)}
  `;
}

function narrativeBody(r) {
  if (!r.setup) return "";
  return `
    <p>${ROLE_NARRATIVE[r.behavior.primary][r.setup.r]}</p>
    <p>${CHILD_NARRATIVE[r.setup.k]}</p>
  `;
}

function actionMarkup(r) {
  const dos = [...DOS_BEHAVIOR[r.behavior.primary], DOS_ATTACH[r.attachment.key]];
  const donts = [...DONTS_BEHAVIOR[r.behavior.primary], DONTS_ATTACH[r.attachment.key]];
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

// 배우자 코드를 이미 들고 있으면 초대가 아니라 결합 결과가 다음 목적지다.
//
// 예전엔 짧은 코드를 보려면 "배우자 초대 링크 만들기"를 눌러 별도 화면(couple-invite)까지
// 가야 했다 — 코드 자체는 그 화면에서 자동으로 뜨지만, 그 화면에 도달하는 클릭 한 번이
// 불편하다는 피드백을 받았다. 결과 화면에 뜨자마자 코드를 바로 노출한다(아래 wireInlineShortCode).
// "링크로 보내기·코드 카드 저장" 같은 부가 기능은 여전히 couple-invite 화면에 남겨둔다.
function inviteBlockMarkup(r) {
  if (state.couple.partner) {
    return `
      <div class="cp-invite-cta">
        <div class="cp-block-title">배우자 결과가 준비돼 있어요</div>
        <p class="cp-block-sub">같은 질문에 두 분이 얼마나 다르게 답했는지 볼 수 있어요.</p>
        <button class="cta-btn" data-nav="couple-report">두 분의 결합 결과 보기</button>
      </div>
    `;
  }
  return `
    <div class="cp-invite-cta">
      <div class="cp-block-title">배우자와 결과를 합쳐볼까요?</div>
      <p class="cp-block-sub">같은 질문에 두 분이 얼마나 다르게 답했는지 볼 수 있어요.
      <b>혼자서는 알 수 없는 것</b>이에요. (위 결과가 더 정확해지는 건 아니에요.)</p>
      <div class="cp-shortcode-block cp-shortcode-block--inline">
        <div class="cp-block-sub" style="margin:0 0 4px;">짧은 코드를 문자로 바로 보내세요 (7일간 유효)</div>
        <div class="cp-shortcode" id="cp-shortcode-inline">발급 중...</div>
        <button class="share-mini" id="cp-shortcode-inline-copy" hidden>🔗 코드 복사</button>
      </div>
      <button class="cta-btn" data-nav="couple-invite">🔗 링크로 보내기 · 코드 카드 저장</button>
      <button class="cta-btn cp-invite-secondary" data-nav="couple-pair">💌 부부 결과 매칭 — 배우자 코드 입력하기</button>
    </div>
  `;
}

// 결과 화면에 들어오자마자(클릭 없이) 짧은 코드를 발급·표시한다. 같은 결과로 재진입하면
// ensureShortCode()의 캐시를 그대로 쓰므로, 화면을 여러 번 오가도 재발급되지 않는다.
// 화면을 떠난 뒤 응답이 오면 onLeave로 잡은 left 플래그로 DOM 갱신을 건너뛴다(E-4와 같은 함정).
async function wireInlineShortCode(r) {
  const codeEl = app.querySelector("#cp-shortcode-inline");
  if (!codeEl) return; // 이미 배우자 코드를 들고 있는 분기(위)는 이 요소가 없다.
  const copyBtn = app.querySelector("#cp-shortcode-inline-copy");

  let left = false;
  onLeave(() => {
    left = true;
  });

  const partnerCode = encodePartner(r);
  const short = await ensureShortCode(partnerCode);
  if (left) return;

  if (!short) {
    codeEl.textContent = "발급이 지금 안 돼요 — 아래 버튼으로 링크를 보내주세요.";
    return;
  }

  codeEl.textContent = formatShortCode(short);
  copyBtn.hidden = false;
  copyBtn.classList.add("active");
  copyBtn.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(formatShortCode(short));
      const original = copyBtn.textContent;
      copyBtn.textContent = "✅ 복사 완료!";
      setTimeout(() => {
        copyBtn.textContent = original;
      }, 1500);
    } catch (err) {
      console.error("코드 복사 실패", err);
    }
  });
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

  // 플래그가 2개 이상이면 결과를 내지 않는다(§5.0). 부정확한 데이터로 산출된 인지 격차는
  // 부부에게 도움이 되기는커녕 다툼거리만 만든다 — 여기서 막지 않으면 그대로 결합
  // 리포트까지 흘러간다.
  if (r.validity.verdict === "blocked") {
    app.appendChild(el(`
      <div>
        <div class="empty-state">
          <div class="emoji">🙏</div>
          <div class="msg">응답을 다시 한 번 천천히 진행해 주세요</div>
        </div>
        <ul class="cp-flag-list">${r.validity.flags.map((f) => `<li>${f}</li>`).join("")}</ul>
        <p class="disclaimer">지금 응답으로 결과를 내면 실제와 다른 유형이 나올 가능성이 높아요.
        두 분에게 도움이 되는 결과를 위해 결과 산출을 건너뛰었습니다.</p>
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
      ${foldMarkup("지금 이 상황에서는", narrativeBody(r))}
      ${foldMarkup("갈등이 생겼을 때", conflictBody(r))}
      ${actionMarkup(r)}

      ${inviteBlockMarkup(r)}

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

  wireInlineShortCode(r);

  // 공유는 "내 유형 소개 페이지" 주소로만 한다. 배우자 코드가 담긴 주소를 여기에 걸면
  // 아무에게나 내 응답이 실린 링크가 나간다 — 초대 링크는 별도 화면에서만 만든다.
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

// 이 화면이 있는 이유: 사용자는 "둘이 하면 더 정확해진다"고 짐작하기 쉬운데, 실제 설계는
// 그렇지 않다. 개인 점수는 자기 응답만으로 계산되고 배우자 응답은 한 글자도 들어가지 않는다.
// 합쳐서 얻는 것은 정밀도가 아니라 **혼자서는 존재할 수 없는 정보**(인지 격차)다.
// 이 구분을 미리 알려주지 않으면 사용자는 기대와 다른 결과를 받고 "부정확하다"고 느낀다.
// 마케팅 문구도 같은 이유로 "둘이 하면 더 정확해집니다"가 아니라
// "혼자서는 알 수 없는 것을 알게 됩니다" 쪽을 쓴다.
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
        <h2>혼자서는<br/>알 수 없는 것</h2>
        <p>혼자 해도 되고, 배우자와 함께 해도 돼요.<br/>나오는 게 서로 다릅니다.</p>
      </div>

      <div class="cp-profile">
        <div class="cp-block-title">무엇이 나오나요</div>
        <div class="cp-guide-two">
          <div class="cp-guide-col">
            <div class="head">혼자 하면</div>
            <p>나의 관계 성향 유형과 네 가지 성향 점수.</p>
          </div>
          <div class="cp-guide-col">
            <div class="head">둘이 하면</div>
            <p>위는 <b>그대로</b>이고, <b>같은 질문에 두 사람이 얼마나 다르게 답했는지</b>가 더해져요.</p>
          </div>
        </div>
      </div>

      <div class="cp-profile cp-guide-key">
        <div class="cp-block-title">⚠️ 오해하기 쉬운 것</div>
        <p class="cp-guide-lead">둘이 한다고 <b>내 결과가 더 정확해지지는 않습니다.</b></p>
        <p>내 점수는 <b>내가 답한 문항 ${ITEM_TOTAL}개만으로</b> 계산돼요. 배우자의 답은 한 글자도
        들어가지 않습니다. 합쳐서 얻는 건 더 정확한 결과가 아니라
        <b>혼자서는 아예 없는 정보</b>예요.</p>
      </div>

      <div class="cp-profile">
        <div class="cp-block-title">예를 들면</div>
        <div class="cp-guide-story">
          <p>"지금의 분담이 공정하다"에 <b>내가 2점</b>을 눌렀다고 해볼게요.
          내가 예민한 걸까요, 실제로 기울어 있는 걸까요? 이것만으론 알 수 없어요.</p>
          <p><b>배우자가 같은 문장에 4점</b>을 눌렀다는 걸 알아야
          "같은 집을 서로 다르게 보고 있다"는 이야기가 됩니다.</p>
          <p class="punch">재는 대상이 <b>'나'에서 '우리'로</b> 바뀌는 거예요.</p>
        </div>
      </div>

      <div class="cp-profile">
        <div class="cp-block-title">순서</div>
        <ol class="cp-guide-steps">
          <li>상황 고르기 (호칭·역할·자녀 단계)</li>
          <li>문항 ${ITEM_TOTAL}개 답하기 (약 6분 30초)</li>
          <li>내 결과 보기 — 여기서 끝내도 돼요</li>
          <li>결과 화면에서 <b>배우자 초대 링크</b> 만들어 보내기</li>
          <li>배우자가 답하면 <b>배우자 화면</b>에 결합 결과가 나와요</li>
        </ol>
        <p class="cp-note">배우자가 먼저 하고 나에게 링크를 보내도 똑같이 동작해요.</p>
      </div>

      ${foldMarkup(
        "차이 값은 왜 세 단계로만 보여주나요?",
        `<p>두 사람의 답을 빼면 <b>두 사람의 오차가 함께 실려요.</b> 이 체크에서 가장 흔들리기 쉬운
         값이라, 차이를 내는 문항만 개념 하나당 ${anchorPerConcept}문항씩 모두 ${ANCHOR_ITEMS.length}문항을 써서 두껍게 받쳤습니다.</p>
         <p>반대로 <b>두 분에게 공통으로 있는 버릇은 빼는 순간 사라집니다.</b> 둘 다 후하게 답하는
         편이라면 그 후함은 차이에서 상쇄돼요.</p>
         <p>그래도 소수점까지 단정할 만큼 정밀한 값은 아니라서,
         <b>비슷함 / 조금 다름 / 뚜렷하게 다름</b> 세 단계로만 보여드립니다.</p>`
      )}

      ${foldMarkup(
        "한 사람이 대충 답하면 어떻게 되나요?",
        `<p>결합 결과의 신뢰도는 두 사람의 평균이 아니라 <b>약한 쪽</b>을 따릅니다.
         한 분이라도 응답 점검에 두 번 이상 걸리면 결합 결과를 아예 만들지 않아요.
         서로 시간 있을 때 각자 천천히 답해주세요.</p>`
      )}

      ${foldMarkup(
        "자주 묻는 것",
        `<div class="cp-guide-qa">
          <div class="q">자녀 단계는 꼭 같게 골라야 하나요?</div>
          <p>네. 다르면 두 분이 서로 다른 문장을 받게 돼서 비교가 성립하지 않아요.
          <b>역할은 달라도 되고, 둘 다 같은 걸 골라도 괜찮습니다</b> — 두 분 다 "내가 주로 맡고 있다"고
          느끼는 것 자체가 의미 있는 신호라 따로 짚어드려요.</p>

          <div class="q">내 답을 배우자가 보게 되나요?</div>
          <p>어느 화면에도 표시되지 않아요. 비교한 요약만 함께 보시게 됩니다.
          다만 초대 링크에는 계산에 필요한 값이 담기니 <b>배우자 외에는 보내지 마세요.</b></p>

          <div class="q">"결과를 만들 수 없다"고 나와요.</div>
          <p>응답이 너무 빠르거나 한쪽 값으로만 치우쳤을 때예요. 천천히 다시 해주시면 됩니다.</p>

          <div class="q">결과가 나랑 안 맞는 것 같아요.</div>
          <p>유형 이름보다 <b>네 성향 점수</b>를 봐주세요. 1·2위가 거의 붙어 있으면
          결과 화면이 그렇게 알려드리는데, 그런 경우는 원래 단정하기 어려운 값이에요.</p>

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
