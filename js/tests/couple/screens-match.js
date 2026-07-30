// 배우자와 결과를 합치는 화면들 — 초대 링크·짧은 코드 발급(invite), 배우자 코드 직접
// 입력(pair), 결합 결과(report). 이 하나의 테스트가 문항 화면·개인 결과까지 포함해
// 다른 테스트보다 훨씬 커져서(D-45 짧은 코드 도입 이후 1200줄대), 매칭 흐름만 따로 뺐다
// — 개인 검사만 하는 흐름(screens.js)과 배우자를 엮는 흐름을 파일 경계로도 나눠서,
// 어느 쪽을 고치는 중인지 파일명만 보고 알 수 있게 한다.
//
// screens.js에서 몇 가지를 가져다 쓴다(resetCouple·coupleReady·partnerFromUrl·result·
// foldMarkup·SERVICE_NOTICE·SUPPORT_MARKUP·PRIVACY_MARKUP) — 반대 방향(screens.js가
// 이 파일의 것을 가져다 쓰는 경우)은 없다. 이 파일이 "위층"이라 순환 참조가 안 생긴다.
import { app, go, onLeave } from "../../core/router.js";
import { el, bindNav } from "../../core/dom.js";
import { state } from "../../core/state.js";
import { saveImage } from "../../core/share.js";
import { adSlotMarkup } from "../../core/ads.js";
import { roundRect } from "../../core/util.js";
import { COUPLE_TYPES, ITEM_TOTAL, ATTACH_TYPES, BEHAVIOR_LABELS, GAP_SCRIPTS, CONFLICT_SCRIPTS } from "./data.js";
import {
  combine,
  coupleReportBlock,
  personaName,
  conflictPairText,
  encodePartner,
  decodePartner,
} from "./match.js";
import { isShortCode, normalizeShortCode, formatShortCode } from "./shortcode.js";
import { issueShortCode, resolveShortCode } from "./remote.js";
import { createCoupleCanvas, drawCoupleCardFooter } from "./card.js";
import {
  resetCouple,
  coupleReady,
  partnerFromUrl,
  result,
  foldMarkup,
  SERVICE_NOTICE,
  SUPPORT_MARKUP,
  PRIVACY_MARKUP,
} from "./screens.js";

// ---------------------------------------------------------------- 배우자 초대

export function renderCoupleInvite() {
  const r = result();
  const partnerCode = encodePartner(r);
  const url = `${location.origin}/test/couple/pair?p=${partnerCode}`;

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
      <div class="cp-shortcode-block" id="cp-shortcode-block">
        <div class="cp-block-title">링크 대신 짧은 코드로</div>
        <p class="cp-block-sub">문자나 말로 전하기 편해요. 7일간 유효해요.</p>
        <div class="cp-shortcode" id="cp-shortcode">발급 중...</div>
        <button class="share-mini" id="cp-code-card-btn" disabled>🖼️ 배우자 전용 코드 카드 저장</button>
      </div>
      <div class="cp-guide-link"><button data-nav="couple-guide">📖 합치면 뭐가 달라지나요?</button></div>
      <p class="disclaimer">이 링크에는 결합 결과를 계산하는 데 필요한 내 점수가 담겨 있어요.
      배우자 화면에도 내가 문항마다 어떻게 답했는지는 표시되지 않습니다.
      다만 링크 자체가 암호화된 것은 아니니 <b>배우자 외 다른 사람에게는 보내지 마세요.</b><br/>
      자녀 단계는 배우자도 <b>같은 항목</b>을 골라야 부모·연인 역할 게이지가 나옵니다.</p>
      ${adSlotMarkup("bannerBottom", "margin-top:6px; margin-bottom:22px;")}
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

  // 화면을 떠난 뒤 발급 응답이 와도 지금 떠 있는 다른 화면의 DOM을 건드리면 안 된다 —
  // app은 화면이 바뀌어도 같은 엘리먼트라 살아있는 것처럼 보인다(E-4와 같은 종류의 함정).
  let left = false;
  onLeave(() => {
    left = true;
  });
  wireShortCode(r, partnerCode, () => left);
}

// 짧은 코드는 재진입할 때마다 새로 발급하지 않는다 — 같은 결과(같은 partnerCode)로는
// state.couple.shortCode에 캐시해둔 걸 그대로 쓴다. KV 쓰기 한도가 하루 1,000회라
// 화면을 여러 번 왔다갔다하면 금방 소진된다.
async function wireShortCode(r, partnerCode, isLeft) {
  const block = app.querySelector("#cp-shortcode-block");
  const codeEl = app.querySelector("#cp-shortcode");
  const cardBtn = app.querySelector("#cp-code-card-btn");

  const cached = state.couple.shortCode;
  let short = cached && cached.for === partnerCode ? cached.code : null;
  if (!short) {
    short = await issueShortCode(partnerCode);
    if (isLeft()) return;
    if (short) state.couple.shortCode = { code: short, for: partnerCode };
  }

  if (!short) {
    block.innerHTML = `<p class="cp-note">짧은 코드 발급이 지금 안 돼요. 위 링크로 보내주세요.</p>`;
    return;
  }

  codeEl.textContent = formatShortCode(short);
  cardBtn.disabled = false;
  cardBtn.classList.add("active");
  cardBtn.addEventListener("click", () =>
    saveImage(cardBtn, () => drawCoupleCodeCard(r, short), "과몰입구역-부부코드카드.png")
  );
}

// ---------------------------------------------------------------- 초대 링크로 들어온 화면

// 배우자 코드를 직접 입력받는다. 셋 다 받는다 — 짧은 코드(코드 카드·문자로 받은 것),
// 25자 코드를 그대로 붙여넣은 경우, 링크를 통째로 붙여넣은 경우. 짧은 코드만 네트워크가
// 필요하고, 나머지 둘은 decodePartner()가 바로 순수하게 처리한다(백엔드가 죽어도 25자
// 코드·링크 경로는 그대로 동작한다).
function extractPartnerCandidate(raw) {
  const trimmed = raw.trim();
  const m = trimmed.match(/[?&]p=([^&\s]+)/);
  return m ? decodeURIComponent(m[1]) : trimmed;
}

export function renderCouplePair() {
  const partner = partnerFromUrl();

  app.appendChild(el(`
    <div>
      <div class="back-row">
        <button class="back-btn" data-nav="home">‹</button>
        <div class="back-title">부부 관계 성향 체크</div>
      </div>
      ${adSlotMarkup("bannerTop", "margin-top:10px; margin-bottom:4px;")}
      <div class="cover">
        <div class="emoji">💌</div>
        <div class="tag">${partner ? "배우자가 보낸 초대" : "부부 결과 매칭"}</div>
        <h2>${partner ? "배우자가 먼저<br/>답을 마쳤어요" : "배우자의 코드를<br/>입력해주세요"}</h2>
        <p>${partner
          ? `배우자는 <b>${COUPLE_TYPES[partner.typeKey].name}</b>으로 나왔어요. 이제 같은 문항에 답하면 두 분의 결합 결과가 나옵니다.`
          : "배우자가 결과 화면에서 받은 <b>짧은 코드</b>나 <b>링크</b>를 붙여넣으세요."}</p>
      </div>
      ${partner ? "" : `
        <div class="cp-code-entry">
          <input type="text" id="cp-code-input" placeholder="예: K7M2-QX8P 또는 링크 전체" autocomplete="off" autocapitalize="off" />
          <button class="cta-btn" id="cp-code-submit">확인</button>
          <p class="cp-note cp-code-error" id="cp-code-error" hidden></p>
        </div>
      `}
      ${PRIVACY_MARKUP}
      <p class="disclaimer">${SERVICE_NOTICE}<br/>
      자녀 단계는 배우자와 <b>같은 항목</b>을 골라주세요 — 두 분이 같은 문장을 받아야 비교가 성립합니다.</p>
      ${partner ? `
        <div class="cta">
          <button class="cta-btn" id="cp-pair-start">문항 ${ITEM_TOTAL}개 시작하기</button>
        </div>
      ` : ""}
      <div class="cp-guide-link"><button data-nav="couple-guide">📖 합치면 뭐가 달라지나요?</button></div>
      ${adSlotMarkup("bannerBottom", "margin-top:6px; margin-bottom:22px;")}
    </div>
  `));
  bindNav(app);

  if (partner) {
    app.querySelector("#cp-pair-start").addEventListener("click", () => {
      const saved = state.couple.partner;
      resetCouple();
      state.couple.partner = saved;
      go("couple-setup");
    });
    return;
  }

  wireCodeEntry();
}

function wireCodeEntry() {
  const input = app.querySelector("#cp-code-input");
  const submit = app.querySelector("#cp-code-submit");
  const errorEl = app.querySelector("#cp-code-error");

  let left = false;
  onLeave(() => {
    left = true;
  });

  function showError(msg) {
    errorEl.textContent = msg;
    errorEl.hidden = false;
  }

  submit.addEventListener("click", async () => {
    errorEl.hidden = true;
    const candidate = extractPartnerCandidate(input.value);
    if (!candidate) {
      showError("코드나 링크를 입력해주세요.");
      return;
    }

    submit.disabled = true;
    submit.textContent = "확인 중...";

    let partnerCode = candidate;
    if (isShortCode(candidate)) {
      const resolved = await resolveShortCode(normalizeShortCode(candidate));
      if (left) return;
      if (!resolved) {
        submit.disabled = false;
        submit.textContent = "확인";
        showError("코드를 찾을 수 없어요. 7일이 지났거나 잘못 입력했을 수 있어요.");
        return;
      }
      partnerCode = resolved;
    }

    const decoded = decodePartner(partnerCode);
    submit.disabled = false;
    submit.textContent = "확인";
    if (!decoded) {
      showError("코드를 확인할 수 없어요. 다시 확인해주세요.");
      return;
    }

    state.couple.partner = decoded;
    go(coupleReady() ? "couple-report" : "couple-setup");
  });
}

// ---------------------------------------------------------------- 결합 리포트

// 단일 "궁합 점수"를 만들지 않는다(§7.2). 대신 요인별로 세 구간만 서술하고, 어떤 조합도
// "나쁜 궁합"으로 단정하지 않는다 — 모든 조합에 강점과 유의점이 함께 붙는다.
// 네 성향에 각각 설명을 붙이면 여덟 줄이 된다. 한눈에 보이는 요약 줄(칩)을 먼저 놓고,
// 설명은 **눈여겨볼 것(많이 다른 편)**에만 붙인다 — 전부 같은 무게로 늘어놓으면
// 무엇을 봐야 하는지가 사라진다. 해당 항목이 여럿이면 같은 설명이 반복되므로 한 줄로 묶는다
// (같은 구간이면 levelDesc가 같다는 전제 — DYNAMIC_LEVELS가 구간당 문구 하나만 갖는다).
function dynamicsMarkup(dynamics) {
  const notable = dynamics.filter((d) => d.levelKey === "contrast");
  return `
    <div class="cp-profile">
      <div class="cp-block-title">두 분의 성향은</div>
      <p class="cp-block-sub">닮았다고 좋고 다르다고 나쁜 게 아니에요.</p>
      <div class="cp-chip-row">
        ${dynamics.map((d) => `
          <span class="cp-chip cp-chip-${d.levelKey}">${d.label} · ${d.levelLabel}</span>
        `).join("")}
      </div>
      ${notable.length
        ? `<p class="cp-note"><b>${notable.map((d) => d.label).join(" · ")}</b> — ${notable[0].levelDesc}</p>`
        : `<p class="cp-note">크게 부딪힐 만한 성향 차이는 보이지 않았어요.</p>`}
    </div>
  `;
}

// 누가 낮게 답했는지를 지목하지 않는다(§6.5.3). 나아가 v3.2부터는 **방향 자체를 내보내지
// 않는다** — 공개하는 것은 "어느 개념에서 얼마나 벌어졌는가"뿐이고, 누구의 응답이 어느
// 쪽이었는지는 §6.5.1 원칙에 따라 끝까지 비공개다.
//
// 격차가 작은 항목을 먼저 배치한다(§8.2). 부정적인 내용으로 리포트를 시작하지 않기 위해서다.
function gapMarkup(c) {
  // 비슷한 항목까지 각각 막대와 문장을 붙이면 같은 말이 세 번 반복된다. 비슷한 것은
  // 한 줄로 묶고, **다른 것만** 펼쳐서 대화 스타터를 붙인다. 순서는 §8.2대로 비슷한 쪽이
  // 먼저 — 부정적인 내용으로 블록을 시작하지 않는다.
  const low = c.gapOrdered.filter((i) => i.levelKey === "low");
  const notable = c.gapOrdered.filter((i) => i.levelKey !== "low");

  const lowLine = low.length
    ? `<p class="cp-note">${low.map((i) => `<b>${i.label}</b>`).join(" · ")}은 두 분이 비슷하게 느끼고 있어요.</p>`
    : "";

  const rows = notable.map((item) => `
    <div class="cp-gap-row">
      <div class="cp-bar-head"><span>${item.label}</span><b>${item.levelLabel}</b></div>
      <div class="cp-bar-track"><span class="cp-bar-fill" style="width:${Math.max(3, Math.round((item.diff / 4) * 100))}%;"></span></div>
      <div class="cp-bar-desc">${item.levelText}</div>
      <div class="cp-script"><div class="cp-script-title">💬 이렇게 꺼내보세요</div><p>${GAP_SCRIPTS[item.key]}</p></div>
    </div>
  `).join("");

  return `
    <div class="cp-profile">
      <div class="cp-block-title">같은 질문, 서로의 대답</div>
      ${notable.length
        ? `<p class="cp-block-sub">누가 맞고 틀린 게 아니라, 서로 다른 자리에서 보고 있다는 신호예요.</p>`
        : ""}
      ${lowLine}
      ${rows}
      ${c.gapHidden.length
        ? `<p class="cp-note">${c.gapHidden.map((i) => i.label).join("·")}은 두 문항 사이 답이 갈려서
           이번엔 비교하지 않았어요.</p>`
        : ""}
    </div>
  `;
}

function envMarkup(c) {
  if (!c.envTop.length) {
    return `<p class="cp-note">역할·자녀 관련 항목은 두 분의 체감이 대체로 비슷했어요.</p>`;
  }
  return c.envTop.slice(0, 2).map((item) => `
    <div class="cp-gap-row">
      <div class="cp-bar-head"><span>${item.label}</span><b>${item.levelLabel}</b></div>
      <div class="cp-bar-desc">${item.levelText}</div>
      ${GAP_SCRIPTS[item.code] ? `<div class="cp-script"><div class="cp-script-title">💬 이렇게 꺼내보세요</div><p>${GAP_SCRIPTS[item.code]}</p></div>` : ""}
    </div>
  `).join("");
}

export function renderCoupleReport() {
  const mine = result();
  const partner = state.couple.partner;
  const blocked = coupleReportBlock(mine, partner);

  // §7.6 발급 조건. 두 사유는 사용자가 할 일이 달라서 문구를 나눈다.
  if (blocked) {
    const body =
      blocked === "childStage"
        ? {
            msg: "자녀 단계를 다시 확인해 주세요",
            detail: `두 분이 고른 자녀 단계가 서로 달라요. 자녀 단계는 두 분에게 같은 사실이고,
              이 값이 갈리면 같은 문항인데도 서로 다른 문장을 받게 돼 비교가 성립하지 않습니다.
              한 분이 상황 고르기부터 다시 진행해 주세요.`,
          }
        : {
            msg: "두 분의 결과를 합치기 어려워요",
            // 상대방의 응답 태도를 평가한 정보를 전달하지 않는다(§7.6 v3.2 안내 문구 중립화).
            detail: `아직 두 분의 결과가 모두 준비되지 않았어요. 한 분이 문항을 다시 한 번
              천천히 진행해 주시면 결합 결과를 보실 수 있습니다.`,
          };
    app.appendChild(el(`
      <div>
        <div class="back-row">
          <button class="exit-btn" data-nav="home" aria-label="홈으로 가기">🏠</button>
        </div>
        <div class="empty-state">
          <div class="emoji">🙏</div>
          <div class="msg">${body.msg}</div>
        </div>
        <p class="disclaimer">${body.detail}</p>
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

  app.appendChild(el(`
    <div>
      <div class="back-row">
        <button class="exit-btn" data-nav="home" aria-label="홈으로 가기">🏠</button>
      </div>
      <div class="result-card">
        <div class="eyebrow">두 분의 조합</div>
        <div class="cp-pair-emoji">${myType.emoji}<span>×</span>${partnerType.emoji}</div>
        <h2 class="cp-pair-name">${personaName(mine, partner)}</h2>
        <p>${c.attachTag.tag} · ${c.attachTag.desc}</p>
      </div>

      ${c.lowConfidence
        ? `<div class="cp-warn">⚠️ 한 분의 응답에 엇갈리는 부분이 있어, 아래 내용은 오차가 있을 수 있어요.</div>`
        : ""}

      ${dynamicsMarkup(c.dynamics)}
      ${gapMarkup(c)}

      <div class="cp-profile">
        <div class="cp-block-title">역할과 자녀 이야기</div>
        <p class="cp-block-sub">차이가 큰 것부터 보여드려요.</p>
        ${envMarkup(c)}
        ${c.roleOverlap ? `<p class="cp-note">${c.roleOverlap.text}</p>` : ""}
      </div>

      ${foldMarkup(
        "갈등이 생겼을 때 두 분은",
        `<p class="cp-note">${conflictPairText(mine, partner)} 조합이에요.
         배우자에게는 아래처럼 말을 꺼내면 대화가 덜 부딪혀요.</p>
         <div class="cp-script"><p>${CONFLICT_SCRIPTS[partner.conflict.style]}</p></div>`
      )}

      ${adSlotMarkup("rect")}

      ${SUPPORT_MARKUP}
      <p class="disclaimer">${SERVICE_NOTICE}<br/>
      이 결과는 두 분이 각자 답한 내용을 비교한 것이며, 문항별 응답은 어느 화면에도 표시되지 않습니다.</p>

      <div class="cp-guide-link"><button data-nav="couple-guide">📖 이 결과, 어떻게 읽나요?</button></div>
      <button class="retry-btn" data-nav="couple-result">내 결과 다시 보기</button>
    </div>
  `));
  bindNav(app);
}

// 공유용 카드(drawCoupleCard, screens.js)와 일부러 분리한다. 공유 카드는 SNS에 올려도
// 되게 만든 물건이고, 이 카드는 배우자에게 **결과를 합치는 데 쓰이는 코드**가 찍혀 있어서
// 공개 게시를 전제로 하면 안 된다. 하나로 합치면 사람들이 자기 매칭 코드가 찍힌 이미지를
// 공개적으로 올리고도 모르게 된다.
async function drawCoupleCodeCard(r, shortCode) {
  const t = COUPLE_TYPES[r.typeKey];
  const { canvas, ctx, W } = createCoupleCanvas();

  // 코드는 항상 이 y좌표(140~370) 구간에 고정해서 그린다. 이 카드에서 실제로 바뀌는 건
  // 코드뿐이라 값을 담는 자리는 매번 같은 곳에 있어야 한다 — 다른 값을 넣는 카드를
  // 새로 만들 때도 이 구간은 건드리지 않는다.
  ctx.font = "700 32px Pretendard, sans-serif";
  ctx.fillStyle = "rgba(255,255,255,.9)";
  ctx.fillText("🔒 배우자 전용 코드", W / 2, 200);

  ctx.font = "800 100px 'SF Mono', Menlo, Consolas, monospace";
  ctx.fillStyle = "#fff";
  ctx.fillText(formatShortCode(shortCode), W / 2, 320);

  ctx.font = "600 28px Pretendard, sans-serif";
  ctx.fillStyle = "rgba(255,255,255,.75)";
  ctx.fillText("7일 동안 이 코드로 결과를 합칠 수 있어요", W / 2, 370);

  ctx.font = "130px sans-serif";
  ctx.fillStyle = "#fff";
  ctx.fillText(t.emoji, W / 2, 560);

  ctx.font = "800 56px Pretendard, sans-serif";
  ctx.fillText(t.name, W / 2, 650);

  ctx.font = "600 28px Pretendard, sans-serif";
  ctx.fillStyle = "rgba(255,255,255,.8)";
  ctx.fillText(`${ATTACH_TYPES[r.attachment.key].name} · ${BEHAVIOR_LABELS[r.behavior.primary]}`, W / 2, 696);

  const warnW = 760;
  ctx.fillStyle = "rgba(255,255,255,.16)";
  roundRect(ctx, W / 2 - warnW / 2, 830, warnW, 106, 20);
  ctx.fill();
  ctx.font = "700 30px Pretendard, sans-serif";
  ctx.fillStyle = "#fff";
  ctx.fillText("⚠️ 배우자 외 다른 사람에게는", W / 2, 878);
  ctx.fillText("보여주지 마세요", W / 2, 918);

  drawCoupleCardFooter(ctx, W);
  return canvas;
}
