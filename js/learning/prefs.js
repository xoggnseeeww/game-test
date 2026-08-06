// 연습 카드의 "받침대 치우기" 설정(D-93 — B-1 영어 문장 가리기, B-2 뜻 접기).
//
// 왜 필요한가: 지금 연습 카드는 영어 문장과 한국어 뜻을 **둘 다 항상** 띄워놓고 있다.
// 그러면 "듣고 따라 말하기"가 실제로는 **읽고 따라 읽기**가 된다 — 화면을 보고 읽으면
// 문장을 기억해서 만들어내는 연습이 아니라 발음 흉내만 남는다. 한국어 뜻도 마찬가지로,
// 항상 보이면 영어를 먼저 이해해볼 기회가 사라진다.
//
// 그래서 지우개 두 개를 **학습자가 직접 켜고 끄게** 뒀다. 강제로 가리지 않는 이유는
// 이 도구의 다른 결정들과 같다(D-61: 듣기/말하기를 강제하지 않고 건너뛰기를 둔다) —
// 처음 보는 문장은 보고 따라 읽는 게 맞고, 익숙해지면 가리는 게 맞는데, 그 시점은
// 학습자만 안다.
//
// 저장 위치: 세션 한정 메모리(state와 같은 성질). `state.learning`에 넣지 않은 이유는
// 그 객체가 클라우드로 동기화되는 **진행률**이기 때문이다(D-68) — 화면 표시 설정이
// 진행률 레코드에 섞이면 병합 규칙(D-90)이 다뤄야 할 것이 늘어난다. localStorage에도
// 안 넣었다(이 저장소는 영속 데이터를 최소로 유지한다 — CLAUDE.md "영속 데이터").
export const practicePrefs = {
  hideEnglish: false, // B-1: 영어 문장을 가리고 소리만 듣고 말해보기
  foldKo: false,      // B-2: 한국어 뜻을 접고 영어만으로 이해해보기
};

// 카드 위에 얹는 토글 두 개. 세 화면(basic·elementary·복습)이 같은 줄을 쓰도록 여기서
// 마크업까지 준다 — 세 군데에 각각 쓰면 문구와 동작이 조금씩 갈라진다.
export function practicePrefsMarkup() {
  return `
    <div class="practice-prefs">
      <button class="pref-toggle${practicePrefs.hideEnglish ? " on" : ""}" data-pref="hideEnglish">
        ${practicePrefs.hideEnglish ? "👀 영어 문장 보기" : "🙈 영어 문장 가리기"}
      </button>
      <button class="pref-toggle${practicePrefs.foldKo ? " on" : ""}" data-pref="foldKo">
        ${practicePrefs.foldKo ? "💬 뜻 펼치기" : "🙈 뜻 접기"}
      </button>
    </div>`;
}

// 토글을 누르면 설정을 뒤집고 onChange로 카드를 다시 그리게 한다(카드 안쪽만 갈아끼우는
// in-place 렌더라 화면 골격은 그대로다).
export function bindPracticePrefs(root, onChange) {
  root.querySelectorAll(".pref-toggle").forEach((btn) => {
    btn.addEventListener("click", () => {
      practicePrefs[btn.dataset.pref] = !practicePrefs[btn.dataset.pref];
      onChange();
    });
  });
}

// 영어 문장 자리. 가려져 있으면 눌러서 그 카드에서만 잠깐 볼 수 있다 — 설정을 끄지 않고도
// "정말 모르겠을 때 한 번 확인"이 되어야 막히지 않는다.
export function sentenceMarkup(text) {
  return practicePrefs.hideEnglish
    ? `<h2 class="masked" id="learning-reveal-en" role="button" tabindex="0">🙈 눌러서 확인하기</h2>`
    : `<h2>${text}</h2>`;
}

// 한국어 뜻 자리. 접혀 있으면 "뜻 보기"만 남는다. 듣기 버튼(🔊)은 뜻이 보일 때만 의미가
// 있으므로 같이 접힌다.
export function koMarkup(ko, withListenBtn) {
  if (practicePrefs.foldKo) {
    return `<p class="cover-ko"><button class="ko-fold-btn" id="learning-reveal-ko">뜻 보기</button></p>`;
  }
  return `
    <p class="cover-ko">
      ${ko}
      ${withListenBtn ? `<button class="ko-listen-btn" id="learning-listen-ko" aria-label="한국어 뜻 듣기">🔊</button>` : ""}
    </p>`;
}

// 가린 영어/접은 뜻을 그 카드에서만 펼치는 핸들러. 설정 자체는 안 바꾼다.
export function bindReveal(root, { text, ko, withListenBtn, onListenKo }) {
  const en = root.querySelector("#learning-reveal-en");
  if (en) {
    const reveal = () => { en.classList.remove("masked"); en.textContent = text; };
    en.addEventListener("click", reveal);
    en.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); reveal(); } });
  }
  const koBtn = root.querySelector("#learning-reveal-ko");
  if (koBtn) {
    // 부모를 **미리** 잡아둔다 — innerHTML을 갈아끼우는 순간 koBtn이 DOM에서 빠져서
    // 그 뒤의 `koBtn.parentElement`는 null이 된다.
    const slot = koBtn.parentElement;
    koBtn.addEventListener("click", () => {
      slot.innerHTML = `${ko} ${withListenBtn ? `<button class="ko-listen-btn" id="learning-listen-ko" aria-label="한국어 뜻 듣기">🔊</button>` : ""}`;
      slot.querySelector("#learning-listen-ko")?.addEventListener("click", onListenKo);
    });
  }
}
