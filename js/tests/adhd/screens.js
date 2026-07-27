// 성인 ADHD 성향 체크의 모든 화면 + 반응속도 게임 화면.
import { app, go, onLeave, parseSharedPath } from "../../core/router.js";
import { el, bindNav, showModal } from "../../core/dom.js";
import { shareBlockMarkup, wireShare } from "../../core/share.js";
import { state } from "../../core/state.js";
import { roundRect, shuffle, bestReactionTime, saveBestReactionTime } from "../../core/util.js";
import {
  QUESTIONS,
  OPTIONS,
  RESULT_TYPES,
  PROFILE_TO_SLUG,
  CPT_ROUNDS,
  CPT_NOGO_COUNT,
  CPT_GO_WINDOW,
  CPT_NOGO_WINDOW,
} from "./data.js";
import {
  computeResult,
  axisBreakdown,
  summarizeGameResults,
  reactionComment,
} from "./score.js";

export function renderTestIntro() {
  app.appendChild(el(`
    <div>
      <div class="back-row">
        <button class="back-btn" data-nav="psych-list">‹</button>
        <div class="back-title">심리테스트</div>
      </div>
      <div class="cover">
        <div class="emoji">🎯</div>
        <div class="tag">집중력 성향 체크</div>
        <h2>성인 ADHD<br/>성향 체크</h2>
        <p>요즘 유독 집중이 안 되고<br/>깜빡깜빡한다면?</p>
      </div>
      <div class="meta-chips">
        <div class="meta-chip"><div class="value">${QUESTIONS.length}문항</div><div class="label">약 1분</div></div>
        <div class="meta-chip"><div class="value">${Object.keys(RESULT_TYPES).length}가지</div><div class="label">결과 유형</div></div>
      </div>
      <p class="disclaimer">DSM-5가 다루는 증상 영역(부주의·충동성·과잉행동)을 참고해<br/>재구성한 자체 문항이며, 특정 임상 척도나 의학적 진단이 아닙니다.</p>
      <div class="cta">
        <button class="cta-btn" id="start-btn">테스트 시작하기</button>
      </div>
      <div class="ad-slot banner" style="margin:6px 20px 22px;">카카오 AdFit · 320×50</div>
    </div>
  `));
  bindNav(app);
  app.querySelector("#start-btn").addEventListener("click", () => {
    showModal({
      title: "⚠️ 시작 전 안내",
      body: "이 테스트는 재미를 위한 자가 참고용 콘텐츠이며,\n의학적 진단 도구가 아닙니다.\n\n결과만으로 ADHD 여부를 판단할 수 없으니,\n정확한 진단은 반드시 정신건강의학과 등\n전문 의료기관에서 전문가와 상담을 통해\n받으시길 권해드립니다.",
      confirmLabel: "확인했어요, 시작할게요",
      cancelLabel: "취소",
      onConfirm: () => {
        state.answers = [];
        state.lastReaction = null;
        go("test-question");
      },
    });
  });
}

export function renderQuestion() {
  const i = state.answers.length;
  const q = QUESTIONS[i];
  const pct = Math.round((i / QUESTIONS.length) * 100);

  app.appendChild(el(`
    <div>
      <div class="progress-row">
        <button class="back-btn" id="q-back">‹</button>
        <div class="progress-track"><div class="progress-fill" style="width:${pct}%;"></div></div>
        <div class="progress-count">${i + 1}<span class="total">/${QUESTIONS.length}</span></div>
      </div>
      <div class="question-block">
        <div class="qno">Q${i + 1}.</div>
        <h2>${q.text}</h2>
      </div>
      <div class="options"></div>
    </div>
  `));

  const optionsEl = app.querySelector(".options");
  OPTIONS.forEach((opt) => {
    const btn = el(`
      <button class="option-btn">
        <span class="dot"></span>${opt.label}
      </button>
    `);
    btn.addEventListener("click", () => {
      const value = q.reverse ? 4 - opt.value : opt.value;
      state.answers.push({ group: q.group, value });
      if (state.answers.length >= QUESTIONS.length) {
        // 반응속도 게임은 별도 보너스가 아니라 이 테스트의 마지막 단계라, 문항이
        // 끝나면 바로 게임으로 이어간다. 결과는 게임까지 마쳐야 볼 수 있다.
        go("reaction-intro");
      } else {
        go("test-question");
      }
    });
    optionsEl.appendChild(btn);
  });

  app.querySelector("#q-back").addEventListener("click", () => {
    if (state.answers.length === 0) {
      go("test-intro");
    } else {
      state.answers.pop();
      go("test-question");
    }
  });
}

// 카톡·인스타에 바로 올릴 수 있는 결과 카드를 캔버스로 그려서 PNG로 내보낸다.
// 웹폰트 로딩 대기와 저장/공유는 core/share.js가 맡는다.
async function drawResultCard(r) {
  const W = 1080;
  const H = 1080;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");

  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, "#6E58F5");
  bg.addColorStop(1, "#4A32D6");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  ctx.textAlign = "center";

  ctx.fillStyle = "rgba(255,255,255,.85)";
  ctx.font = "700 30px Pretendard, sans-serif";
  ctx.fillText("과몰입구역", W / 2, 90);

  ctx.font = "160px sans-serif";
  ctx.fillText(r.type.emoji, W / 2, 300);

  ctx.fillStyle = "#fff";
  ctx.font = "800 62px Pretendard, sans-serif";
  ctx.fillText(r.type.name, W / 2, 400);

  const subtitleText = r.type.subtitle;
  ctx.font = "700 28px Pretendard, sans-serif";
  const subtitleWidth = ctx.measureText(subtitleText).width + 56;
  ctx.fillStyle = "rgba(255,255,255,.18)";
  roundRect(ctx, W / 2 - subtitleWidth / 2, 430, subtitleWidth, 52, 26);
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.fillText(subtitleText, W / 2, 465);

  ctx.font = "600 30px Pretendard, sans-serif";
  ctx.fillStyle = "#D8D2FF";
  ctx.fillText(r.type.tags.join("   "), W / 2, 545);

  const barData = [
    { label: "집중", pct: r.focus },
    { label: "충동", pct: r.impulse },
    { label: "에너지", pct: r.energy },
  ];
  barData.forEach((b, i) => {
    const y = 630 + i * 90;
    ctx.textAlign = "left";
    ctx.font = "700 30px Pretendard, sans-serif";
    ctx.fillStyle = "#fff";
    ctx.fillText(b.label, 100, y);
    ctx.textAlign = "right";
    ctx.fillText(`${b.pct}%`, W - 100, y);

    const trackX = 100;
    const trackY = y + 16;
    const trackW = W - 200;
    ctx.fillStyle = "rgba(255,255,255,.2)";
    roundRect(ctx, trackX, trackY, trackW, 16, 8);
    ctx.fill();
    ctx.fillStyle = "#fff";
    roundRect(ctx, trackX, trackY, Math.max(16, (trackW * b.pct) / 100), 16, 8);
    ctx.fill();
  });

  ctx.textAlign = "center";
  ctx.font = "700 34px Pretendard, sans-serif";
  ctx.fillStyle = "#fff";
  ctx.fillText("너도 테스트 해볼래?", W / 2, 950);
  ctx.font = "600 26px Pretendard, sans-serif";
  ctx.fillStyle = "rgba(255,255,255,.7)";
  ctx.fillText(`${location.origin}/test/adhd`, W / 2, 992);

  return canvas;
}

export function renderResult() {
  const r = computeResult();
  const g = state.lastReaction;
  app.appendChild(el(`
    <div>
      <div class="result-card">
        <div class="eyebrow">설문 + 반응속도 게임으로 본 나의 집중 유형은</div>
        <div class="emoji">${r.type.emoji}</div>
        <h2>${r.type.name}</h2>
        <div class="result-subtitle">${r.type.subtitle}</div>
        <div class="result-tags">${r.type.tags.map((t) => `<span>${t}</span>`).join("")}</div>
        <p>${r.type.desc}</p>
        ${g ? `<p>🎮 ${reactionComment(g)}</p>` : ""}
        <div class="result-stats">
          <span>집중 ${r.focus}</span><span class="sep">·</span>
          <span>충동 ${r.impulse}</span><span class="sep">·</span>
          <span>에너지 ${r.energy}</span>
        </div>
        ${r.bonus.impulse > 0 || r.bonus.focus > 0 ? `<div class="result-stats" style="margin-top:8px;"><span>⚡ 위 점수엔 게임 결과도 반영돼 있어요${r.bonus.impulse > 0 ? ` · 충동 +${r.bonus.impulse}` : ""}${r.bonus.focus > 0 ? ` · 집중 +${r.bonus.focus}` : ""}</span></div>` : ""}
        ${g && g.isBest ? '<div class="result-stats" style="margin-top:8px;"><span>🎉 반응속도 새 최고기록!</span></div>' : ""}
      </div>

      <div class="axis-breakdown">
        ${axisBreakdown(r).map((a) => `
          <div class="axis-row">
            <span class="axis-label">${a.label}</span>
            <span class="axis-pct">${a.pct}%</span>
            <span class="axis-text">${a.text}</span>
          </div>
        `).join("")}
      </div>

      ${g ? `
      <div class="section-title" style="padding:20px 20px 9px;">📊 게임에서 측정된 수치</div>
      <div class="meta-chips">
        <div class="meta-chip"><div class="value">${g.avgRt !== null ? g.avgRt + "ms" : "-"}</div><div class="label">평균 반응속도</div></div>
        <div class="meta-chip"><div class="value">${g.accuracy}%</div><div class="label">정확도</div></div>
        <div class="meta-chip"><div class="value">${g.rtSD}ms</div><div class="label">반응 일관성</div></div>
      </div>
      <div class="meta-chips" style="padding-top:8px;">
        <div class="meta-chip"><div class="value">${g.commissionErrors}/${g.noGoCount}</div><div class="label">못 참은 순간</div></div>
        <div class="meta-chip"><div class="value">${g.omissionErrors}/${g.goCount}</div><div class="label">놓친 순간</div></div>
        <div class="meta-chip"><div class="value">${g.prematureCount}회</div><div class="label">성급했던 순간</div></div>
      </div>
      <p class="result-dominant">정확도: 알맞게 반응한 비율 · 반응 일관성: 반응속도가 얼마나 고르게 나왔는지(낮을수록 안정적) · 못 참은 순간: 참아야 할 때 누른 횟수 · 놓친 순간: 반응해야 할 때 놓친 횟수 · 성급했던 순간: 신호가 뜨기 전에 미리 누른 횟수</p>
      ` : ""}

      <div class="result-tip">💡 ${r.type.tip}</div>

      ${shareBlockMarkup()}

      <div class="ad-slot rect">카카오 AdFit<br/>250×250</div>

      <div class="next-block">
        <div class="section-title" style="padding:0 0 9px;">이런 것도 해봤어? 🎲</div>
        <div class="next-row">
          <button class="next-card" id="replay-game-btn"><div class="icon">⚡</div><div class="label">반응속도 게임 다시하기</div></button>
          <div class="next-card quiz"><div class="icon">💡</div><div class="label">상식 퀴즈</div></div>
        </div>
      </div>

      <button class="retry-btn" id="retry-btn">🔄 테스트 다시하기</button>
    </div>
  `));
  bindNav(app);
  app.querySelector("#replay-game-btn").addEventListener("click", () => go("reaction-play"));
  app.querySelector("#retry-btn").addEventListener("click", () => {
    state.answers = [];
    state.lastReaction = null;
    go("test-intro");
  });

  // 이 페이지 자체 주소(/test/adhd/result)는 모두에게 동일해서, 친구가 열면 빈
  // 테스트만 보인다. 슬러그가 붙은 결과별 주소를 공유해야 "이 결과"가 열린다.
  wireShare(app, {
    url: `${location.origin}/test/adhd/result/${PROFILE_TO_SLUG[r.key]}`,
    text: `나는 "${r.type.name}(${r.type.subtitle})"이 나왔어요! 너는 어떤 유형일까?`,
    filename: "과몰입구역-결과카드.png",
    draw: () => drawResultCard(r),
  });
}

export function renderTestShared() {
  const shared = parseSharedPath(location.pathname);
  const type = RESULT_TYPES[shared.key];
  app.appendChild(el(`
    <div>
      <div class="back-row">
        <button class="back-btn" data-nav="home">‹</button>
        <div class="back-title">심리테스트</div>
      </div>
      <div class="result-card">
        <div class="eyebrow">친구의 집중 유형은</div>
        <div class="emoji">${type.emoji}</div>
        <h2>${type.name}</h2>
        <div class="result-subtitle">${type.subtitle}</div>
        <div class="result-tags">${type.tags.map((t) => `<span>${t}</span>`).join("")}</div>
        <p>${type.desc}</p>
      </div>
      <div class="result-tip">💡 ${type.tip}</div>
      <p class="disclaimer">DSM-5가 다루는 증상 영역을 참고해 재구성한 자체 문항에서 나온 결과이며,<br/>의학적 진단이 아닙니다.</p>
      <div class="cta" style="padding-top:10px;">
        <button class="cta-btn" data-nav="test-intro">나도 성향 체크해보기</button>
      </div>
    </div>
  `));
  bindNav(app);
}

export function renderReactionIntro() {
  const best = bestReactionTime();
  app.appendChild(el(`
    <div>
      <div class="back-row">
        <button class="back-btn" data-nav="test-question">‹</button>
        <div class="back-title">성인 ADHD 성향 체크</div>
      </div>
      <div class="cover">
        <div class="emoji">⚡</div>
        <div class="tag">마지막 단계 · 충동 조절 확인</div>
        <h2>반응속도 게임</h2>
        <p>문항은 다 풀었어요! 마지막으로 초록불엔 재빨리 탭, 주황불엔 참아보세요.<br/>${CPT_ROUNDS}라운드로 충동 조절과 집중력을 확인하면 최종 결과가 나와요.</p>
      </div>
      <div class="meta-chips">
        <div class="meta-chip"><div class="value">${CPT_ROUNDS}라운드</div><div class="label">게임 방식</div></div>
        <div class="meta-chip"><div class="value">${best !== null ? best + "ms" : "-"}</div><div class="label">내 평균 반응속도</div></div>
        <div class="meta-chip"><div class="value">${CPT_NOGO_COUNT}회</div><div class="label">참아야 할 신호</div></div>
      </div>
      <p class="disclaimer">너무 일찍 누르면 그 라운드는 다시 진행되지만, 성급했던 횟수도\n충동 점수에 함께 기록돼요. 주황불에서는 누르지 않는 게 정답이에요!</p>
      <div class="cta">
        <button class="cta-btn" id="start-btn">마지막 단계 시작하기</button>
      </div>
    </div>
  `));
  bindNav(app);
  app.querySelector("#start-btn").addEventListener("click", () => go("reaction-play"));
}

export function renderReactionPlay() {
  app.appendChild(el(`
    <div>
      <div class="back-row">
        <button class="back-btn" data-nav="reaction-intro">‹</button>
        <div class="back-title">반응속도 게임</div>
      </div>
      <div class="progress-row">
        <div class="progress-track"><div class="progress-fill" id="round-fill" style="width:0%;"></div></div>
        <div class="progress-count" id="round-count">1<span class="total">/${CPT_ROUNDS}</span></div>
      </div>
      <div id="game-panel" class="game-panel">
        <div id="game-msg" class="game-msg">화면을 터치해서 시작하세요</div>
      </div>
    </div>
  `));
  bindNav(app);

  const panel = app.querySelector("#game-panel");
  const msg = app.querySelector("#game-msg");
  const fill = app.querySelector("#round-fill");
  const count = app.querySelector("#round-count");

  // 화면을 떠나면 예약된 타이머와 rAF 콜백을 전부 무효화한다. 예전엔 setScreen이
  // 타이머 하나만 clearTimeout 했는데, 이미 예약된 requestAnimationFrame 콜백은
  // 그걸로 취소되지 않아서 게임 도중 뒤로가기를 하면 살아남은 콜백이 라운드를 마저
  // 진행시키고 사용자가 보고 있던 화면을 게임 결과 화면으로 밀어버렸다.
  let timer = null;
  let raf = null;
  let aborted = false;
  onLeave(() => {
    aborted = true;
    clearTimeout(timer);
    cancelAnimationFrame(raf);
  });

  const noGoRounds = new Set(shuffle([...Array(CPT_ROUNDS).keys()]).slice(0, CPT_NOGO_COUNT));
  const results = [];
  let prematureCount = 0;
  let round = 0;
  let phase = "intro"; // intro -> waiting -> go/nogo -> feedback (-> waiting again on false start)
  let stimulusOnset = 0;

  function updateProgress() {
    fill.style.width = `${Math.round((round / CPT_ROUNDS) * 100)}%`;
    count.innerHTML = `${Math.min(round + 1, CPT_ROUNDS)}<span class="total">/${CPT_ROUNDS}</span>`;
  }

  function startRound() {
    phase = "waiting";
    panel.style.background = "#E3564C";
    msg.style.color = "#fff";
    msg.textContent = "곧 신호가 나타나요...\n집중하세요!";
    const delay = 900 + Math.random() * 1400;
    timer = setTimeout(() => {
      if (aborted) return;
      const isGo = !noGoRounds.has(round);
      phase = isGo ? "go" : "nogo";
      // 스타일 변경 직후 performance.now()를 찍으면 실제 화면에 그려지기(paint) 전
      // 시점을 기준으로 삼게 되어 반응시간이 체계적으로 부풀려진다. rAF 콜백 안에서
      // 찍어야 브라우저가 다음 프레임을 그리기 직전 시점에 더 가깝게 맞출 수 있다.
      raf = requestAnimationFrame(() => {
        if (aborted) return;
        stimulusOnset = performance.now();
        if (isGo) {
          panel.style.background = "#1FAE6A";
          msg.textContent = "지금 클릭!";
        } else {
          panel.style.background = "#F5A623";
          msg.textContent = "누르지 마세요!";
        }
        timer = setTimeout(() => {
          if (aborted) return;
          results.push(isGo ? { type: "go", correct: false } : { type: "nogo", correct: true });
          nextRound();
        }, isGo ? CPT_GO_WINDOW : CPT_NOGO_WINDOW);
      });
    }, delay);
  }

  function nextRound() {
    round++;
    updateProgress();
    if (round >= CPT_ROUNDS) {
      finish();
    } else {
      startRound();
    }
  }

  function finish() {
    const stats = summarizeGameResults(results);
    stats.prematureCount = prematureCount;
    const best = bestReactionTime();
    const isBest = stats.avgRt !== null && (best === null || stats.avgRt < best);
    if (isBest) saveBestReactionTime(stats.avgRt);
    state.lastReaction = { ...stats, isBest };
    // 게임이 이 테스트의 마지막 단계라, 끝나면 바로 최종 결과(게임 분석 포함)로 간다.
    go("test-result");
  }

  panel.addEventListener("click", () => {
    if (aborted) return;
    if (phase === "intro") {
      startRound();
    } else if (phase === "waiting") {
      // 신호가 뜨기 전에 미리 누르는 것(성급한 반응)도 CPT 계열 과제에서 충동성
      // 신호로 쓰인다. 그 라운드 자체는 다시 진행하되(같은 라운드를 소모하지 않되),
      // 성급하게 반응한 횟수는 따로 기록해서 충동 점수에 반영한다.
      clearTimeout(timer);
      prematureCount++;
      phase = "feedback";
      panel.style.background = "#FCE7E5";
      msg.style.color = "#C23B32";
      msg.textContent = "너무 빨랐어요!\n다시 준비할게요";
      timer = setTimeout(() => { if (!aborted) startRound(); }, 900);
    } else if (phase === "go") {
      clearTimeout(timer);
      const rt = Math.round(performance.now() - stimulusOnset);
      results.push({ type: "go", correct: true, rt });
      phase = "feedback";
      panel.style.background = "#DCF5E8";
      msg.style.color = "#1B8F5C";
      msg.textContent = `${rt}ms ✅`;
      timer = setTimeout(() => { if (!aborted) nextRound(); }, 500);
    } else if (phase === "nogo") {
      clearTimeout(timer);
      results.push({ type: "nogo", correct: false });
      phase = "feedback";
      panel.style.background = "#FCE7E5";
      msg.style.color = "#C23B32";
      msg.textContent = "앗, 참았어야 해요!";
      timer = setTimeout(() => { if (!aborted) nextRound(); }, 600);
    }
    // "feedback" 단계 클릭은 무시
  });

  updateProgress();
}
