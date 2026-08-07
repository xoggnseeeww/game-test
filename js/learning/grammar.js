// 문법 설명 블록(D-96). 연습 화면과 복습 화면이 **같은 것을 보여줘야** 해서 여기 한 곳에 둔다 —
// 복습에서만 설명이 빠지면 "이 문법이 어떻게 적용된 건지 모르겠다"는 원래 지적이 절반만 해결된다.
//
// 도구를 모르는 순수 view 함수라 복습 화면이 학습 도구를 import하지 않는 경계(D-70)도 그대로다 —
// 문법 항목은 각 도구의 `resolveReview`가 넘겨준다.
//
// `check` 정규식(D-94)이 이미 그 형태를 찾을 줄 알기 때문에, 문장에서 짚어줄 위치를 위한
// 데이터를 따로 만들지 않는다. check가 없는 문법이면 설명만 나온다.
function applied(text, check) {
  if (!check || !text) return "";
  const m = check.exec(text);
  if (!m) return "";
  return text.slice(0, m.index) + `<mark>${m[0]}</mark>` + text.slice(m.index + m[0].length);
}

// grammar: { kidLabel, explain, check? } · sentence: 그 문법이 쓰인 영어 문장
export function grammarDetailMarkup(grammar, sentence, { label = "🔤 오늘의 문법" } = {}) {
  if (!grammar?.explain) return "";
  const shown = applied(sentence, grammar.check);
  return `
    <details class="grammar-detail">
      <summary>${label}: ${grammar.kidLabel} <span class="more">어떻게 쓰였나요?</span></summary>
      <p class="grammar-rule">${grammar.explain.replace(/`([^`]+)`/g, "<code>$1</code>")}</p>
      ${shown ? `<p class="grammar-applied">${shown}</p>` : ""}
    </details>`;
}
