// NumPath 플레이 화면. DISC/ADHD의 in-place 렌더 패턴(D-26)을 따른다 — 스테이지가 바뀔 때마다
// go()로 화면 전체를 다시 그리면 광고 슬롯도 매번 새로 만들어져 refreshAds()가 스테이지마다
// 실행된다. 여기서는 화면을 한 번만 그리고, 스테이지 전환 때는 HUD·보드만 갈아끼운다.
import { app, go, onLeave } from "../../core/router.js";
import { el, bindNav, bindExit } from "../../core/dom.js";
import { adSlotMarkup } from "../../core/ads.js";
import { state } from "../../core/state.js";
import { generatePuzzle } from "./generate.js";
import { initState, applyMove, undo, canEnter, availableMoves, isCleared, isStuck, isOutOfMoves, posKey } from "./engine.js";
import { STAGES_PER_RUN, starsFor } from "./data.js";
import { playMoveTone, playClearChord, playBlockedTone } from "./audio.js";

const OP_LABEL = { "+": "+", "-": "−", "*": "×", "/": "÷" };

// 클리어 축하 표시 후 다음 스테이지로 넘어가기까지의 지연(기획서 §3-3 인스턴트 리트라이와는
// 반대 방향 — 이건 "성공"의 촉각 피드백을 잠깐 보여주려는 의도적 지연이다).
const STAGE_ADVANCE_DELAY_MS = 900;

function tileLabel(cell) {
  if (cell.type === "start") return String(cell.value);
  if (cell.type === "block") return "✕";
  return `${OP_LABEL[cell.op]}${cell.operand}`;
}

export function renderNumpathPlay() {
  app.appendChild(el(`
    <div>
      <div class="back-row">
        <button class="back-btn" data-nav="numpath-intro">‹</button>
        <div class="back-title">NumPath</div>
        <button class="exit-btn" aria-label="홈으로 가기">🏠</button>
      </div>
      <div class="np-goal">
        <div class="np-goal-row">
          <div class="np-goal-block">
            <span class="np-goal-label">현재값</span>
            <span class="np-goal-value" id="np-current"></span>
          </div>
          <div class="np-goal-arrow">→</div>
          <div class="np-goal-block">
            <span class="np-goal-label">목표값</span>
            <span class="np-goal-value np-goal-value--target" id="np-target"></span>
          </div>
        </div>
        <p class="np-goal-hint">현재값이 목표값과 정확히 같아지면 클리어!</p>
      </div>
      <div class="np-hud">
        <div class="np-hud-row">
          <div class="np-hud-item"><span class="np-hud-label">스테이지</span><span class="np-hud-value" id="np-stage"></span></div>
          <div class="np-hud-item"><span class="np-hud-label">이동 횟수</span><span class="np-hud-value" id="np-moves"></span></div>
        </div>
      </div>
      <div class="np-board" id="np-board"></div>
      <div class="np-msg" id="np-msg"></div>
      <div class="np-controls">
        <button class="np-ctrl-btn" id="np-undo">↺ Undo</button>
        <button class="np-ctrl-btn" id="np-reset">↻ Reset</button>
        <button class="np-ctrl-btn np-mute-btn" id="np-mute" aria-label="효과음 켜고 끄기"></button>
      </div>
      ${adSlotMarkup("banner", "margin-top:18px; margin-bottom:4px;")}
    </div>
  `));
  bindNav(app);
  bindExit(app, () => {
    state.numpath.run = null;
  });

  const stageEl = app.querySelector("#np-stage");
  const targetEl = app.querySelector("#np-target");
  const currentEl = app.querySelector("#np-current");
  const movesEl = app.querySelector("#np-moves");
  const boardEl = app.querySelector("#np-board");
  const msgEl = app.querySelector("#np-msg");
  const undoBtn = app.querySelector("#np-undo");
  const resetBtn = app.querySelector("#np-reset");
  const muteBtn = app.querySelector("#np-mute");

  // 스테이지 전환 지연 동안 뒤로가기를 하면 예약된 setTimeout이 살아남아 다음 화면을
  // 밀어버릴 수 있다 — 반응속도 게임(E-4)과 같은 종류의 버그라 같은 패턴으로 막는다.
  let advanceTimer = null;
  let aborted = false;
  onLeave(() => {
    aborted = true;
    clearTimeout(advanceTimer);
  });

  let puzzle = null;
  let minMoves = null;
  let playState = null;

  const muted = () => state.numpath.muted;

  function renderMuteButton() {
    muteBtn.textContent = muted() ? "🔇" : "🔊";
  }

  function renderBoard() {
    boardEl.classList.remove("np-board--locked");
    boardEl.style.gridTemplateColumns = `repeat(${puzzle.size}, 1fr)`;
    boardEl.dataset.size = puzzle.size;
    boardEl.innerHTML = "";

    const reachable = new Set(availableMoves(puzzle, playState).map(({ r, c }) => posKey(r, c)));

    for (let r = 0; r < puzzle.size; r++) {
      for (let c = 0; c < puzzle.size; c++) {
        const cell = puzzle.board[r][c];
        const key = posKey(r, c);
        const isCurrent = playState.r === r && playState.c === c;
        const isVoid = playState.visited.has(key) && !isCurrent;

        const classes = ["np-tile", `np-tile--${cell.type}`];
        if (cell.gimmick) classes.push(`np-tile--${cell.gimmick}`);
        if (isCurrent) classes.push("np-tile--current");
        if (isVoid) classes.push("np-tile--void");
        if (reachable.has(key)) classes.push("np-tile--reachable");

        // data-* 속성은 브라우저 회귀 스위트(scripts/verify.cjs)가 페이지 안 엔진과는 독립된
        // 자체 솔버로 보드를 읽어 교차 검증할 수 있게 하려고 심어둔다 — 화면 표시용이 아니다.
        const dataAttrs = [`data-r="${r}"`, `data-c="${c}"`, `data-type="${cell.type}"`];
        if (cell.op) dataAttrs.push(`data-op="${cell.op}"`, `data-operand="${cell.operand}"`);
        if (cell.type === "start") dataAttrs.push(`data-value="${cell.value}"`);

        const btn = el(`<button class="${classes.join(" ")}" ${dataAttrs.join(" ")}>${tileLabel(cell)}</button>`);
        btn.addEventListener("click", () => attemptMove(r, c));
        boardEl.appendChild(btn);
      }
    }
  }

  function renderHud() {
    stageEl.textContent = `${state.numpath.run.stageIndex + 1} / ${STAGES_PER_RUN}`;
    targetEl.textContent = puzzle.target;
    currentEl.textContent = playState.value;
    movesEl.textContent = `${playState.movesUsed} / ${puzzle.moveLimit}`;
    undoBtn.disabled = playState.history.length === 0;
    resetBtn.disabled = false;
  }

  function renderMsg() {
    if (isStuck(puzzle, playState)) {
      msgEl.textContent = "더 갈 곳이 없어요. 되돌리거나 초기화해보세요!";
      msgEl.className = "np-msg np-msg--visible";
    } else if (isOutOfMoves(puzzle, playState)) {
      msgEl.textContent = "이동 횟수를 다 썼어요. 초기화하고 다시 도전해보세요!";
      msgEl.className = "np-msg np-msg--visible";
    } else {
      msgEl.textContent = "";
      msgEl.className = "np-msg";
    }
  }

  function loadStage() {
    const generated = generatePuzzle(state.numpath.run.seed, state.numpath.run.stageIndex);
    puzzle = generated.puzzle;
    minMoves = generated.minMoves;
    playState = initState(puzzle);
    renderHud();
    renderBoard();
    renderMsg();
  }

  function attemptMove(r, c) {
    if (!canEnter(puzzle, playState, r, c)) {
      playBlockedTone(muted());
      return;
    }
    playState = applyMove(puzzle, playState, r, c);
    playMoveTone(playState.movesUsed - 1, muted());
    renderHud();
    renderBoard();

    if (isCleared(puzzle, playState)) {
      playClearChord(muted());
      const stars = starsFor({ movesUsed: playState.movesUsed, moveLimit: puzzle.moveLimit, minMoves });
      state.numpath.run.stars.push(stars);
      msgEl.textContent = `🎉 클리어! ${"⭐".repeat(stars)}`;
      msgEl.className = "np-msg np-msg--visible np-msg--clear";
      boardEl.classList.add("np-board--locked");
      undoBtn.disabled = true;
      resetBtn.disabled = true;

      const isLastStage = state.numpath.run.stageIndex + 1 >= STAGES_PER_RUN;
      advanceTimer = setTimeout(() => {
        if (aborted) return;
        if (isLastStage) {
          go("numpath-ad");
        } else {
          state.numpath.run.stageIndex += 1;
          loadStage();
        }
      }, STAGE_ADVANCE_DELAY_MS);
      return;
    }

    renderMsg();
  }

  undoBtn.addEventListener("click", () => {
    playState = undo(playState);
    renderHud();
    renderBoard();
    renderMsg();
  });

  resetBtn.addEventListener("click", () => {
    playState = initState(puzzle);
    renderHud();
    renderBoard();
    renderMsg();
  });

  muteBtn.addEventListener("click", () => {
    state.numpath.muted = !state.numpath.muted;
    renderMuteButton();
  });

  renderMuteButton();
  loadStage();
}
