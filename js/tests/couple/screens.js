// 부부 관계 성향 체크의 모든 화면.
import { app, go, onLeave, parseSharedPath } from "../../core/router.js";
import { el, bindNav, bindExit, bindAdGate } from "../../core/dom.js";
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
  BEHAVIOR_LABELS,
  ATTACH_LABELS,
  CONFLICT_LABELS,
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
import { assembleQuestionnaire, anchorStartIndex } from "./assemble.js";
import { combine, personaName, conflictPairText, encodePartner, decodePartner } from "./match.js";

const COMBO_COUNT = T_AXIS.length * R_AXIS.length * K_AXIS.length;

// 결과 어디에도 진단·예측으로 읽힐 문장을 두지 않는다(§9.3). 이 한 줄이 나머지 안전
// 장치보다 실질적으로 더 중요하다 — 사용자가 결과를 판정이 아니라 대화 소재로 받아들이게
// 만드는 프레이밍이기 때문이다.
const SERVICE_NOTICE =
  "이 체크는 두 분이 서로를 이해하는 대화를 돕기 위한 도구입니다. 심리 상태를 진단하거나 관계의 미래를 예측하지 않습니다.";

// 감지·분기 없이 결과 화면 하단에 항상 같은 모습으로 놓인다. 특정 응답에 반응해서
// 나타나는 것이 아니라서 낙인 효과가 없고, 필요한 사람은 언제든 찾을 수 있다(§9.2).
// 번호는 기획서에 적힌 것을 그대로 쓰지 않았다 — 1577-1366은 다누리콜센터(다문화가족),
// 1393은 2024년부터 109로 통합돼 안내 번호로 부적절하다.
const SUPPORT_MARKUP = `
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
const PRIVACY_MARKUP = `
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
    startedAt: null,
    elapsedMs: null,
    partner: state.couple ? state.couple.partner : null,
  };
}

export function coupleReady() {
  const c = state.couple;
  return Boolean(c.items && c.items.length && Object.keys(c.answers).length >= c.items.length);
}

// 응답 품질 플래그가 2개 이상이면 결과를 내지 않는다(§5.0). 배우자 초대 링크도 같은 기준으로
// 막는다 — 결과가 안 나올 응답으로 코드를 만들어 보내면 배우자만 헛수고한다.
export function coupleBlocked() {
  return coupleReady() && result().validity.verdict === "blocked";
}

// 결과는 화면을 다시 그릴 때마다 같은 값이어야 한다. 순수 함수라 매번 계산해도 되지만,
// 소요시간만은 완료 시점에 한 번 고정해둔다.
function result() {
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
        <button class="exit-btn" data-nav="home" aria-label="홈으로 가기">🏠</button>
      </div>
      ${adSlotMarkup("banner", "margin-top:10px; margin-bottom:4px;")}
      <div class="cover">
        <div class="emoji">💞</div>
        <div class="tag">부부 관계 성향 체크</div>
        <h2>우리는 서로를<br/>어떻게 보고 있을까?</h2>
        <p>문항 ${ITEM_TOTAL}개에 답하면 나의 관계 성향이 나와요.<br/>배우자와 각자 해보고 결과를 합칠 수도 있어요.</p>
      </div>
      <div class="meta-chips">
        <div class="meta-chip"><div class="value">${ITEM_TOTAL}문항</div><div class="label">약 6분</div></div>
        <div class="meta-chip"><div class="value">${COMBO_COUNT}가지</div><div class="label">상황 조합</div></div>
        <div class="meta-chip"><div class="value">${Object.keys(COUPLE_TYPES).length}가지</div><div class="label">결과 유형</div></div>
      </div>
      ${PRIVACY_MARKUP}
      <p class="disclaimer">${SERVICE_NOTICE}<br/>
      먼저 호칭·역할·자녀 단계를 고르면, 그 상황에 맞는 문장으로 문항이 나옵니다.
      결과는 유형 하나로 단정하지 않고 <b>네 성향 점수와 확신도를 함께</b> 보여줘요.</p>
      <div class="cta">
        <button class="cta-btn" id="cp-start">시작하기</button>
      </div>
      ${adSlotMarkup("banner", "margin-top:6px; margin-bottom:22px;")}
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
        <button class="exit-btn" data-nav="home" aria-label="홈으로 가기">🏠</button>
      </div>
      <div class="question-block">
        <div class="qno">시작 전에</div>
        <h2 class="disc-scene">지금 두 분의 상황을 알려주세요</h2>
      </div>
      <p class="cp-setup-lead">고른 내용에 따라 문항 문장이 바뀝니다. 문항 수와 채점 기준은 어느 조합에서도 같아요.</p>
      ${axisGroupMarkup("나는", "결과 문구의 호칭에만 쓰이고 점수에는 영향을 주지 않아요", "t", T_AXIS)}
      ${axisGroupMarkup("우리 집에서 나는", "지금 주로 맡고 있는 쪽을 고르세요", "r", R_AXIS)}
      ${axisGroupMarkup("자녀는", "배우자와 함께 결과를 보려면 같은 항목을 골라야 해요", "k", K_AXIS)}
      <div class="cta">
        <button class="cta-btn" id="cp-setup-next" disabled>문항 시작하기</button>
      </div>
      ${adSlotMarkup("banner", "margin-top:6px; margin-bottom:22px;")}
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
  const anchorAt = anchorStartIndex(items);
  if (state.couple.startedAt === null) state.couple.startedAt = Date.now();

  app.appendChild(el(`
    <div>
      <div class="progress-row">
        <button class="back-btn" id="cp-back">‹</button>
        <div class="progress-track"><div class="progress-fill" id="cp-fill" style="width:0%;"></div></div>
        <div class="progress-count" id="cp-count"></div>
        <button class="exit-btn" aria-label="홈으로 가기">🏠</button>
      </div>
      ${adSlotMarkup("banner", "margin-top:10px; margin-bottom:4px;")}
      <div class="cp-anchor-notice" id="cp-anchor-notice" hidden>
        🔒 여기서부터는 두 분에게 똑같이 나가는 문항이에요.
        <b>이 답도 배우자에게 문항별로 보여지지 않습니다</b> — 있는 그대로 답해주세요.
      </div>
      <div class="question-block">
        <div class="qno" id="cp-qno"></div>
        <h2 class="disc-scene" id="cp-text"></h2>
      </div>
      <div class="options cp-likert" id="cp-options"></div>
      ${adSlotMarkup("banner", "margin-top:18px; margin-bottom:4px;")}
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
    go("couple-ad");
  }

  function renderCurrent() {
    const i = state.couple.index;
    const item = items[i];

    fill.style.width = `${Math.round((i / items.length) * 100)}%`;
    count.innerHTML = `${i + 1}<span class="total">/${items.length}</span>`;
    qno.textContent = `Q${i + 1}.`;
    textEl.textContent = item.text;
    notice.hidden = i < anchorAt;

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

  app.querySelector("#cp-back").addEventListener("click", () => {
    if (state.couple.index > 0) {
      state.couple.index -= 1;
      // 되돌아간 문항의 답은 지운다. 남겨두면 "이미 답했다"는 표시와 실제 진행 상태가
      // 어긋나서, 마지막 문항에서 뒤로 갔다 오면 완료로 착각하는 경우가 생긴다.
      delete state.couple.answers[items[state.couple.index].code];
      renderCurrent();
    } else {
      go("couple-setup");
    }
  });

  bindExit(app, resetCouple);
  renderCurrent();
}

// ---------------------------------------------------------------- 광고 게이트

export function renderCoupleAd() {
  app.appendChild(el(`
    <div>
      <div class="back-row">
        <div class="back-title">결과 준비 중</div>
        <button class="exit-btn" data-nav="home" aria-label="홈으로 가기">🏠</button>
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
  const second = BEHAVIOR_LABELS[behavior.secondary];
  if (behavior.confidence === "clear") return `${BEHAVIOR_LABELS[behavior.primary]} 성향이 다른 성향들보다 뚜렷하게 높게 나왔어요.`;
  if (behavior.confidence === "moderate") return `${second} 성향도 가깝게 나왔지만, ${BEHAVIOR_LABELS[behavior.primary]} 쪽이 조금 더 높아요.`;
  return `${BEHAVIOR_LABELS[behavior.primary]}과 ${second}이 거의 같은 크기로 나왔어요. 상황에 따라 두 모습이 번갈아 나오는 편일 수 있습니다.`;
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
      <div class="cp-block-title">나의 성향 프로필</div>
      <p class="cp-block-sub">유형 라벨 하나가 버리는 정보를 그대로 보여드려요. 네 성향 점수를 모두 확인하세요.</p>
      ${BEHAVIOR_AXES.map((ax) => barMarkup(BEHAVIOR_LABELS[ax], r.norm[ax])).join("")}
      <div class="cp-block-sub" style="margin-top:14px;">애착 두 축 · 가운데 선이 중간값이에요</div>
      ${barMarkup(AXIS_LABELS.ANX, r.norm.ANX, { midline: true })}
      ${barMarkup(AXIS_LABELS.AVO, r.norm.AVO, { midline: true })}
      <p class="cp-note">${confidenceText(r.behavior)}</p>
      ${r.attachment.anx.mixed || r.attachment.avo.mixed
        ? `<p class="cp-note">${[
            r.attachment.anx.mixed ? AXIS_LABELS.ANX : null,
            r.attachment.avo.mixed ? AXIS_LABELS.AVO : null,
          ].filter(Boolean).join("·")} 축은 중간값 근처라 어느 쪽이라고 단정하기 어려워요. "중간 정도"로 읽어주세요.</p>`
        : ""}
    </div>
  `;
}

function conflictMarkup(r) {
  return `
    <div class="cp-profile">
      <div class="cp-block-title">갈등이 생겼을 때</div>
      ${barMarkup(AXIS_LABELS.SC, r.norm.SC)}
      ${barMarkup(AXIS_LABELS.OC, r.norm.OC)}
      <p class="cp-note">두 축의 위치로 보면 <b>${CONFLICT_LABELS[r.conflict.style]}</b>에 가까워요.
      ${r.conflict.confidence === "edge" ? "다만 경계에 가까워서, 상황에 따라 옆 스타일로도 나올 수 있어요." : ""}</p>
    </div>
  `;
}

function narrativeMarkup(r) {
  if (!r.setup) return "";
  return `
    <div class="cp-narrative">
      <div class="cp-block-title">지금 이 상황에서는</div>
      <p>${ROLE_NARRATIVE[r.behavior.primary][r.setup.r]}</p>
      <p>${CHILD_NARRATIVE[r.setup.k]}</p>
    </div>
  `;
}

function actionMarkup(r) {
  const dos = [...DOS_BEHAVIOR[r.behavior.primary], DOS_ATTACH[r.attachment.key]];
  const donts = [...DONTS_BEHAVIOR[r.behavior.primary], DONTS_ATTACH[r.attachment.key]];
  return `
    <div class="cp-action">
      <div class="cp-block-title">배우자에게 보여주세요</div>
      <p class="cp-block-sub">나를 대할 때 이렇게 해주면 좋아요.</p>
      <div class="cp-do-list">
        ${dos.map((d) => `<div class="cp-do">✅ ${d}</div>`).join("")}
        ${donts.map((d) => `<div class="cp-dont">🚫 ${d}</div>`).join("")}
      </div>
      <div class="cp-script">
        <div class="cp-script-title">💬 나에게는 이렇게 말해주면 좋아요</div>
        <p>${CONFLICT_SCRIPTS[r.conflict.style]}</p>
      </div>
    </div>
  `;
}

// 배우자 코드를 이미 들고 있으면 초대가 아니라 결합 결과가 다음 목적지다.
function inviteBlockMarkup() {
  if (state.couple.partner) {
    return `
      <div class="cp-invite-cta">
        <div class="cp-block-title">배우자 결과가 준비돼 있어요</div>
        <p class="cp-block-sub">두 분의 답을 합쳐서, 서로를 어떻게 다르게 보고 있는지 확인해보세요.</p>
        <button class="cta-btn" data-nav="couple-report">두 분의 결합 결과 보기</button>
      </div>
    `;
  }
  return `
    <div class="cp-invite-cta">
      <div class="cp-block-title">배우자와 결과를 합쳐볼까요?</div>
      <p class="cp-block-sub">배우자도 각자 답한 뒤 두 결과를 합치면, 서로를 어떻게 다르게 보고 있는지 볼 수 있어요.</p>
      <button class="cta-btn" data-nav="couple-invite">배우자 초대 링크 만들기</button>
    </div>
  `;
}

function warnMarkup(validity) {
  if (validity.verdict !== "warn") return "";
  return `<div class="cp-warn">⚠️ ${validity.flags[0]}. 결과 정확도가 낮을 수 있어요.</div>`;
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
        <div class="back-row">
          <button class="exit-btn" data-nav="home" aria-label="홈으로 가기">🏠</button>
        </div>
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
      <div class="back-row">
        <button class="exit-btn" data-nav="home" aria-label="홈으로 가기">🏠</button>
      </div>
      ${warnMarkup(r.validity)}
      <div class="result-card">
        <div class="eyebrow">나의 관계 성향은</div>
        <div class="emoji">${t.emoji}</div>
        <h2>${t.name}</h2>
        <div class="result-subtitle">${ATTACH_LABELS[r.attachment.key]} · ${BEHAVIOR_LABELS[r.behavior.primary]}</div>
        <p>${t.desc}</p>
      </div>

      ${profileMarkup(r)}
      ${conflictMarkup(r)}
      ${narrativeMarkup(r)}
      ${actionMarkup(r)}

      ${inviteBlockMarkup()}

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

  // 공유는 "내 유형 소개 페이지" 주소로만 한다. 배우자 코드가 담긴 주소를 여기에 걸면
  // 아무에게나 내 응답이 실린 링크가 나간다 — 초대 링크는 별도 화면에서만 만든다.
  wireShare(app, {
    url: `${location.origin}/test/couple/result/${t.slug}`,
    text: `부부 관계 성향 체크에서 "${t.name}"이 나왔어요. 당신은 어떤 유형인가요?`,
    filename: "과몰입구역-부부관계성향-결과카드.png",
    draw: () => drawCoupleCard(r),
  });
}

// ---------------------------------------------------------------- 배우자 초대

export function renderCoupleInvite() {
  const r = result();
  const url = `${location.origin}/test/couple/pair?p=${encodePartner(r)}`;

  app.appendChild(el(`
    <div>
      <div class="back-row">
        <button class="back-btn" data-nav="couple-result">‹</button>
        <div class="back-title">배우자 초대</div>
        <button class="exit-btn" data-nav="home" aria-label="홈으로 가기">🏠</button>
      </div>
      <div class="cover">
        <div class="emoji">🔗</div>
        <div class="tag">결과 합치기</div>
        <h2>이 링크를<br/>배우자에게 보내세요</h2>
        <p>배우자가 링크를 열고 문항에 답하면,<br/>배우자 화면에서 두 분의 결합 결과가 나와요.</p>
      </div>
      <div class="cp-invite-link" id="cp-link">${url}</div>
      <div class="share-block">
        <button class="share-kakao active" data-share="native">📤 배우자에게 보내기</button>
        <div class="share-row">
          <button class="share-mini active" data-share="copy">🔗 링크 복사</button>
        </div>
      </div>
      <p class="disclaimer">이 링크에는 결합 결과를 계산하는 데 필요한 내 점수가 담겨 있어요.
      배우자 화면에도 내가 문항마다 어떻게 답했는지는 표시되지 않습니다.
      다만 링크 자체가 암호화된 것은 아니니 <b>배우자 외 다른 사람에게는 보내지 마세요.</b><br/>
      자녀 단계는 배우자도 <b>같은 항목</b>을 골라야 부모·연인 역할 게이지가 나옵니다.</p>
      ${adSlotMarkup("banner", "margin-top:6px; margin-bottom:22px;")}
    </div>
  `));
  bindNav(app);

  const copyBtn = app.querySelector('[data-share="copy"]');
  const shareBtn = app.querySelector('[data-share="native"]');

  function flash(btn, text) {
    const original = btn.textContent;
    btn.textContent = text;
    setTimeout(() => {
      btn.textContent = original;
    }, 1500);
  }

  copyBtn.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(url);
      flash(copyBtn, "✅ 복사 완료!");
    } catch (err) {
      console.error("링크 복사 실패", err);
      flash(copyBtn, "복사 실패, 직접 복사해주세요");
    }
  });

  shareBtn.addEventListener("click", async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: "과몰입구역", text: "우리 결과를 합쳐보자", url });
      } catch (err) {
        console.error("공유 시트 실패", err);
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      flash(shareBtn, "✅ 링크를 복사했어요!");
    } catch (err) {
      console.error("링크 복사 실패", err);
      flash(shareBtn, "공유 실패, 직접 복사해주세요");
    }
  });
}

// ---------------------------------------------------------------- 초대 링크로 들어온 화면

export function renderCouplePair() {
  const partner = partnerFromUrl();

  app.appendChild(el(`
    <div>
      <div class="back-row">
        <button class="back-btn" data-nav="home">‹</button>
        <div class="back-title">부부 관계 성향 체크</div>
      </div>
      ${adSlotMarkup("banner", "margin-top:10px; margin-bottom:4px;")}
      <div class="cover">
        <div class="emoji">💌</div>
        <div class="tag">배우자가 보낸 초대</div>
        <h2>배우자가 먼저<br/>답을 마쳤어요</h2>
        <p>${partner ? `배우자는 <b>${COUPLE_TYPES[partner.typeKey].name}</b>으로 나왔어요.` : ""}
        이제 같은 문항에 답하면 두 분의 결합 결과가 나옵니다.</p>
      </div>
      ${PRIVACY_MARKUP}
      <p class="disclaimer">${SERVICE_NOTICE}<br/>
      자녀 단계는 배우자와 <b>같은 항목</b>을 골라주세요 — 두 분이 같은 문장을 받아야 비교가 성립합니다.</p>
      <div class="cta">
        <button class="cta-btn" id="cp-pair-start">문항 ${ITEM_TOTAL}개 시작하기</button>
      </div>
      ${adSlotMarkup("banner", "margin-top:6px; margin-bottom:22px;")}
    </div>
  `));
  bindNav(app);
  app.querySelector("#cp-pair-start").addEventListener("click", () => {
    const saved = state.couple.partner;
    resetCouple();
    state.couple.partner = saved;
    go("couple-setup");
  });
}

// ---------------------------------------------------------------- 결합 리포트

function componentMarkup(components) {
  const rows = [
    ["성향 차이", components.delta, "두 분의 행동 성향이 얼마나 다른지"],
    ["애착 조합", components.risk, "두 분의 애착 방식이 부딪히기 쉬운 조합인지"],
    ["인지 격차", components.gap, "같은 상황을 서로 다르게 느끼고 있는 정도"],
  ];
  return `
    <div class="cp-profile">
      <div class="cp-block-title">이 결과를 만든 것들</div>
      <p class="cp-block-sub">무엇 때문에 이런 결과가 나왔는지 알아야, 함께 다듬을 지점을 찾을 수 있어요. 막대가 길수록 영향이 컸다는 뜻이에요.</p>
      ${rows.map(([label, c, desc]) => `
        <div class="cp-bar-row">
          <div class="cp-bar-head"><span>${label}</span><b>${["거의 없음", "조금", "보통", "큼"][Math.min(3, Math.floor((c.weighted / c.max) * 4))]}</b></div>
          <div class="cp-bar-track"><span class="cp-bar-fill" style="width:${Math.max(2, Math.round((c.weighted / c.max) * 100))}%;"></span></div>
          <div class="cp-bar-desc">${desc}</div>
        </div>
      `).join("")}
    </div>
  `;
}

// 누가 낮게 답했는지를 지목하지 않는다(§6.5.3). "아내분이 공정하지 않다고 답했습니다"가
// 아니라 "두 분이 느끼는 정도에 차이가 있습니다"로 적는다 — 결과를 본 부부가 다투게 되면
// 다음 재검사에서 솔직도가 급락한다.
function gapMarkup(gap, mine, myLabel, partnerLabel) {
  return `
    <div class="cp-profile">
      <div class="cp-block-title">서로 다르게 느끼고 있는 것</div>
      <p class="cp-block-sub">누가 맞고 틀린 게 아니라, 서로 다른 자리에서 보고 있다는 신호예요.</p>
      ${gap.items.map((item) => {
        const level = item.gap >= 50 ? "큼" : item.gap >= 25 ? "보통" : "작음";
        const who = item.direction > 0 ? myLabel : partnerLabel;
        const dirText = item.gap < 25
          ? "두 분이 비슷하게 느끼고 있어요."
          : `<b>${who}</b> 쪽이 더 크게 느끼고 있어요.`;
        return `
          <div class="cp-gap-row">
            <div class="cp-bar-head"><span>${item.label}</span><b>차이 ${level}</b></div>
            <div class="cp-bar-track"><span class="cp-bar-fill" style="width:${Math.max(2, Math.round(item.gap))}%;"></span></div>
            <div class="cp-bar-desc">${item.desc} · ${dirText}</div>
          </div>
        `;
      }).join("")}
      <div class="cp-script">
        <div class="cp-script-title">💬 이 이야기를 꺼낼 때</div>
        <p>${CONFLICT_SCRIPTS[mine]}</p>
      </div>
    </div>
  `;
}

function romanceMarkup(romance) {
  if (!romance) {
    return `<p class="cp-note">자녀 단계를 서로 다르게 고르셔서, 부모·연인 역할 게이지는 계산하지 않았어요.
    두 분이 같은 항목을 골라야 같은 문장을 받고, 그래야 비교가 성립합니다.</p>`;
  }
  return `
    <div class="cp-gauge">
      <div class="cp-gauge-track">
        <span class="cp-gauge-parent" style="width:${Math.round(romance.parenting)}%;">부모 ${Math.round(romance.parenting)}</span>
        <span class="cp-gauge-romance" style="width:${Math.round(romance.romance)}%;">연인 ${Math.round(romance.romance)}</span>
      </div>
      <p class="cp-block-sub">지금 두 분의 무게중심이에요. 어느 쪽이 옳은 배치는 없고, 시기에 따라 자연스럽게 움직입니다.</p>
    </div>
  `;
}

export function renderCoupleReport() {
  const mine = result();
  const partner = state.couple.partner;

  // 한쪽이라도 플래그 2개 이상이면 결합 리포트를 발급하지 않는다(§5.0).
  if (mine.validity.verdict === "blocked" || partner.validity.verdict === "blocked") {
    app.appendChild(el(`
      <div>
        <div class="back-row">
          <button class="exit-btn" data-nav="home" aria-label="홈으로 가기">🏠</button>
        </div>
        <div class="empty-state">
          <div class="emoji">🙏</div>
          <div class="msg">두 분의 결과를 합치기 어려워요</div>
        </div>
        <p class="disclaimer">두 분 중 한 분의 응답이 매우 빠르거나 한쪽으로 치우쳐 있어요.
        부정확한 데이터로 나온 차이는 두 분에게 도움이 되기 어려워서, 결합 결과를 만들지 않았습니다.
        천천히 다시 답해보시면 결합 결과를 보실 수 있어요.</p>
        <div class="cta">
          <button class="cta-btn" data-nav="couple-intro">다시 해보기</button>
        </div>
      </div>
    `));
    bindNav(app);
    return;
  }

  const c = combine(mine, partner);
  const myType = COUPLE_TYPES[mine.typeKey];
  const partnerType = COUPLE_TYPES[partner.typeKey];
  // 방향을 서술할 땐 두 사람을 같은 방식으로 부른다("나 쪽이" vs "남편 쪽이"처럼 섞이면
  // 한쪽만 지목당하는 것처럼 읽힌다). 호칭을 같게 고른 경우엔 호칭으로 구분이 안 되므로
  // 둘 다 중립 표기로 떨어뜨린다.
  const sameLabel = mine.setup.t === partner.setup.t;
  const myLabel = sameLabel ? "나" : T_AXIS.find((t) => t.code === mine.setup.t).label;
  const partnerLabel = sameLabel ? "배우자" : T_AXIS.find((t) => t.code === partner.setup.t).label;

  app.appendChild(el(`
    <div>
      <div class="back-row">
        <button class="exit-btn" data-nav="home" aria-label="홈으로 가기">🏠</button>
      </div>
      <div class="result-card">
        <div class="eyebrow">두 분의 조합</div>
        <div class="cp-pair-emoji">${myType.emoji}<span>×</span>${partnerType.emoji}</div>
        <h2 class="cp-pair-name">${personaName(mine, partner)}</h2>
        <p>${c.band.tone}</p>
      </div>

      ${c.lowConfidence
        ? `<div class="cp-warn">⚠️ 한 분의 응답이 빠르게 진행돼, 아래 내용은 오차가 있을 수 있어요.</div>`
        : ""}

      ${componentMarkup(c.components)}
      ${gapMarkup(c.gap, mine.conflict.style, myLabel, partnerLabel)}

      <div class="cp-profile">
        <div class="cp-block-title">부모 역할과 연인 역할</div>
        ${romanceMarkup(c.romance)}
      </div>

      <div class="cp-profile">
        <div class="cp-block-title">갈등이 생겼을 때 두 분은</div>
        <p class="cp-note">${conflictPairText(mine, partner)} 조합이에요.
        배우자에게는 아래처럼 말을 꺼내면 대화가 덜 부딪혀요.</p>
        <div class="cp-script">
          <p>${CONFLICT_SCRIPTS[partner.conflict.style]}</p>
        </div>
      </div>

      ${adSlotMarkup("rect")}

      ${SUPPORT_MARKUP}
      <p class="disclaimer">${SERVICE_NOTICE}<br/>
      이 결과는 두 분이 각자 답한 내용을 비교한 것이며, 문항별 응답은 어느 화면에도 표시되지 않습니다.</p>

      <button class="retry-btn" data-nav="couple-result">내 결과 다시 보기</button>
    </div>
  `));
  bindNav(app);
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
      ${adSlotMarkup("banner", "margin-top:10px; margin-bottom:4px;")}
      <div class="result-card">
        <div class="eyebrow">이 유형은</div>
        <div class="emoji">${t.emoji}</div>
        <h2>${t.name}</h2>
        <div class="result-subtitle">${ATTACH_LABELS[attach]} · ${BEHAVIOR_LABELS[primary]}</div>
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
      ${adSlotMarkup("banner", "margin-top:6px; margin-bottom:22px;")}
    </div>
  `));
  bindNav(app);
}

// ---------------------------------------------------------------- 공유 카드

async function drawCoupleCard(r) {
  const t = COUPLE_TYPES[r.typeKey];
  const W = 1080;
  const H = 1080;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");

  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, "#E2557F");
  bg.addColorStop(1, "#A32A5A");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  ctx.textAlign = "center";
  ctx.fillStyle = "rgba(255,255,255,.85)";
  ctx.font = "700 30px Pretendard, sans-serif";
  ctx.fillText("과몰입구역 · 부부 관계 성향 체크", W / 2, 90);

  ctx.font = "150px sans-serif";
  ctx.fillText(t.emoji, W / 2, 290);

  ctx.fillStyle = "#fff";
  ctx.font = "800 66px Pretendard, sans-serif";
  ctx.fillText(t.name, W / 2, 396);

  ctx.font = "700 30px Pretendard, sans-serif";
  const sub = `${ATTACH_LABELS[r.attachment.key]} · ${BEHAVIOR_LABELS[r.behavior.primary]}`;
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
  ctx.font = "600 26px Pretendard, sans-serif";
  ctx.fillStyle = "rgba(255,255,255,.72)";
  ctx.fillText(`${location.origin}/test/couple`, W / 2, 1014);

  return canvas;
}
