// 발음 유사도 판정. DOM을 몰라야 node --test로 검증되므로 순수 함수만 둔다
// (js-modules 규칙: "채점 로직은 DOM을 모르게 유지한다"). 도구 폴더 밖(js/learning/cloud.js와
// 같은 자리)에 두는 이유도 같다 — Levenshtein 유사도는 어떤 학습 도구든 "듣고 따라
// 말하기"를 채점할 때 재사용되는 공용 로직이라, 도구마다 복사하면 한쪽만 고치는 버그가
// 생긴다(D-75, elementary-conversation 추가 시 basic-conversation에서 여기로 옮김).
function normalize(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// 표준 Levenshtein 편집 거리.
function levenshtein(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    for (let j = 1; j <= b.length; j++) {
      row[j] = a[i - 1] === b[j - 1]
        ? prev[j - 1]
        : 1 + Math.min(prev[j - 1], prev[j], row[j - 1]);
    }
    prev = row;
  }
  return prev[b.length];
}

// 인식된 문장과 정답 문장의 일치율(0~100). 기획서 4-4의 계산식 그대로.
export function similarity(heard, answer) {
  const a = normalize(heard);
  const b = normalize(answer);
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 100;
  return Math.max(0, Math.round((1 - levenshtein(a, b) / maxLen) * 100));
}

// 기획서 4-4의 3단계 피드백 경계(85%·60%) 그대로.
export function feedbackTier(pct) {
  if (pct >= 85) return "perfect";
  if (pct >= 60) return "good";
  return "retry";
}

export const TIER_TEXT = {
  perfect: "완벽해요!",
  good: "참 잘했어요!",
  retry: "한 번 더 따라해볼까요?",
};
