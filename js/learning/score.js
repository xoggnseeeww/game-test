// 발음 유사도 판정. DOM을 몰라야 node --test로 검증되므로 순수 함수만 둔다
// (js-modules 규칙: "채점 로직은 DOM을 모르게 유지한다"). 도구 폴더 밖(js/learning/cloud.js와
// 같은 자리)에 두는 이유도 같다 — 이 로직은 어떤 학습 도구든 "듣고 따라 말하기"를 채점할 때
// 재사용되는 공용 로직이라, 도구마다 복사하면 한쪽만 고치는 버그가 생긴다(D-78,
// elementary-conversation 추가 시 basic-conversation에서 여기로 옮김).
//
// 채점 단위를 **글자에서 단어로** 바꿨다(D-91, A-1). 이유:
//   - 글자 단위 Levenshtein은 "어느 단어를 틀렸는지"를 못 알려준다 — 점수만 나오고 뭘 고쳐야
//     할지는 학습자가 알 수 없었다. 단어 단위로 맞추면 정렬 결과에서 틀린 단어를 그대로
//     짚어줄 수 있다(`scoreSpeech`의 tokens).
//   - 길이 편향이 심했다. 긴 문장은 단어 하나를 통째로 틀려도 글자 비율로는 몇 %만 깎이고,
//     짧은 문장은 글자 한두 개만 어긋나도 점수가 급락했다.
// 단어끼리 비교할 때는 여전히 글자 단위 유사도를 쓴다(WORD_MATCH) — "hello"를 "helo"로
// 인식한 것까지 오답 처리하면 발음 연습용으로 너무 가혹하다.

// STT는 같은 말을 축약형으로도, 풀어서도 돌려준다("I'm" ↔ "I am"). 양쪽을 같은 형태로
// 펴서 비교하지 않으면 **맞게 말했는데 틀렸다고 나온다**. 무엇으로 펴는지는 중요하지 않고
// (양쪽에 똑같이 적용되므로) 일관성만 있으면 된다 — 그래서 "let's → let us"처럼 실제로는
// 잘 안 쓰는 형태로 펴도 문제없다.
const CONTRACTIONS = {
  "i'm": "i am", "you're": "you are", "we're": "we are", "they're": "they are",
  "he's": "he is", "she's": "she is", "it's": "it is", "that's": "that is",
  "there's": "there is", "what's": "what is", "where's": "where is",
  "who's": "who is", "how's": "how is", "here's": "here is", "let's": "let us",
  "i've": "i have", "we've": "we have", "you've": "you have", "they've": "they have",
  "i'll": "i will", "we'll": "we will", "you'll": "you will", "it'll": "it will",
  "he'll": "he will", "she'll": "she will", "they'll": "they will",
  "i'd": "i would", "we'd": "we would", "you'd": "you would", "they'd": "they would",
  "don't": "do not", "doesn't": "does not", "didn't": "did not",
  "isn't": "is not", "aren't": "are not", "wasn't": "was not", "weren't": "were not",
  "can't": "can not", "cannot": "can not", "won't": "will not", "shouldn't": "should not",
  "couldn't": "could not", "wouldn't": "would not", "mustn't": "must not",
  "haven't": "have not", "hasn't": "has not", "hadn't": "had not",
};

// STT는 숫자를 대개 아라비아 숫자로 돌려주는데("School starts at 9") 문장 데이터는 영어
// 단어로 적혀 있다("at nine") — 정규화 없이 비교하면 이것도 멀쩡한 발화가 오답이 된다.
// 콘텐츠에 나오는 범위(0~20 + 십 단위)만 넣는다. 없는 수는 그냥 원래 형태로 남고, 양쪽 다
// 같은 형태면 어차피 일치한다.
const NUMBER_WORDS = {
  zero: "0", one: "1", two: "2", three: "3", four: "4", five: "5", six: "6",
  seven: "7", eight: "8", nine: "9", ten: "10", eleven: "11", twelve: "12",
  thirteen: "13", fourteen: "14", fifteen: "15", sixteen: "16", seventeen: "17",
  eighteen: "18", nineteen: "19", twenty: "20", thirty: "30", forty: "40",
  fifty: "50", sixty: "60", seventy: "70", eighty: "80", ninety: "90",
  hundred: "100",
};

// 토큰 하나(화면에 그대로 보여줄 단위)를 비교용 단어 0개 이상으로 편다. 축약형은 두 단어로
// 갈라지므로 1:1이 아니다 — 그래서 아래 tokenize가 "원문 토큰 ↔ 정규화 단어"를 같이 들고 다닌다.
function normalizeToken(token) {
  const cleaned = token
    .toLowerCase()
    .replace(/[‘’]/g, "'") // 스마트 아포스트로피 → 보통 아포스트로피
    .replace(/[^a-z0-9'\s]/g, "")
    .trim();
  if (!cleaned) return [];
  const expanded = CONTRACTIONS[cleaned];
  const parts = expanded ? expanded.split(" ") : [cleaned];
  return parts.map((w) => NUMBER_WORDS[w] ?? w.replace(/'/g, "")).filter(Boolean);
}

// 원문 토큰과 그 정규화 결과를 같이 반환한다. 화면에는 `token`(원문 그대로)을 보여주고,
// 맞고 틀림은 `words`로 판정한다.
function tokenize(text) {
  return String(text)
    .split(/\s+/)
    .filter(Boolean)
    .map((token) => ({ token, words: normalizeToken(token) }));
}

// 표준 Levenshtein 편집 거리(글자 단위). 단어끼리 비교할 때만 쓴다.
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

// 단어 하나끼리는 글자 단위로 재되, 완전 일치까지 요구하지 않는다 — 발음 연습이라 인식기가
// 한두 글자를 흘리는 건 흔하고("hello" → "helo"), 그걸 오답으로 세면 점수가 실력이 아니라
// 인식기 성능을 재게 된다.
const WORD_MATCH = 0.8;

function wordsMatch(a, b) {
  if (a === b) return true;
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return true;
  return 1 - levenshtein(a, b) / maxLen >= WORD_MATCH;
}

// 단어 배열끼리 정렬(Levenshtein DP + 역추적)해서, **정답 쪽 각 단어가 맞았는지**를 돌려준다.
// 거리(distance)는 점수 계산에, matchedAnswer는 오답 단어 표시에 쓴다.
function alignWords(heard, answer) {
  const n = heard.length;
  const m = answer.length;
  const dp = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = 0; i <= n; i++) dp[i][0] = i;
  for (let j = 0; j <= m; j++) dp[0][j] = j;
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      dp[i][j] = wordsMatch(heard[i - 1], answer[j - 1])
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j - 1], dp[i - 1][j], dp[i][j - 1]);
    }
  }
  // 역추적: 대각선으로 이동했고 두 단어가 맞았으면 그 정답 단어를 "맞음"으로 표시한다.
  const matchedAnswer = new Array(m).fill(false);
  let i = n;
  let j = m;
  while (i > 0 && j > 0) {
    if (wordsMatch(heard[i - 1], answer[j - 1]) && dp[i][j] === dp[i - 1][j - 1]) {
      matchedAnswer[j - 1] = true;
      i--; j--;
    } else if (dp[i][j] === dp[i - 1][j - 1] + 1) { i--; j--; }
    else if (dp[i][j] === dp[i - 1][j] + 1) { i--; }
    else { j--; }
  }
  return { distance: dp[n][m], matchedAnswer };
}

// 인식된 문장과 정답 문장의 일치율(0~100). 기획서 4-4의 계산식을 **단어 단위**로 옮긴 것 —
// 분모가 글자 수에서 단어 수로 바뀌었을 뿐 형태는 같다. 말을 덧붙인 경우(삽입)도 거리에
// 잡히므로, 정답을 다 말하고 딴말을 더 붙이면 점수가 깎인다.
export function similarity(heard, answer) {
  const h = tokenize(heard).flatMap((t) => t.words);
  const a = tokenize(answer).flatMap((t) => t.words);
  const maxLen = Math.max(h.length, a.length);
  if (maxLen === 0) return 100;
  return Math.max(0, Math.round((1 - alignWords(h, a).distance / maxLen) * 100));
}

// 기획서 4-4의 3단계 피드백 경계(85%·60%) 그대로.
export function feedbackTier(pct) {
  if (pct >= 85) return "perfect";
  if (pct >= 60) return "good";
  return "retry";
}

// 화면이 필요한 걸 한 번에 준다 — 점수·등급·**정답 문장의 단어별 정오**.
// tokens는 원문 토큰 그대로라(대소문자·문장부호 포함) 그대로 그리면 된다.
export function scoreSpeech(heard, answer) {
  const heardTokens = tokenize(heard);
  const answerTokens = tokenize(answer);
  const h = heardTokens.flatMap((t) => t.words);

  // 정규화 단어 → 원문 토큰 역참조(축약형은 한 토큰이 두 단어로 갈라지므로 1:1이 아니다).
  const owner = [];
  const a = [];
  answerTokens.forEach((t, idx) => {
    for (const w of t.words) { a.push(w); owner.push(idx); }
  });

  const maxLen = Math.max(h.length, a.length);
  const { distance, matchedAnswer } = alignWords(h, a);
  const pct = maxLen === 0 ? 100 : Math.max(0, Math.round((1 - distance / maxLen) * 100));

  // 토큰은 자기 정규화 단어가 **전부** 맞아야 맞은 것으로 본다. 비교할 단어가 아예 없는
  // 토큰(문장부호만 있는 경우 등)은 채점 대상이 아니므로 맞은 것으로 둔다.
  const tokens = answerTokens.map((t, idx) => {
    const mine = a.map((_, k) => k).filter((k) => owner[k] === idx);
    return { text: t.token, ok: mine.length === 0 || mine.every((k) => matchedAnswer[k]) };
  });

  const tier = feedbackTier(pct);
  return {
    pct,
    // 틀린 단어를 짚어주면서 "완벽해요!"라고 하면 화면이 스스로 모순된다 — 점수가 아무리
    // 높아도 놓친 단어가 있으면 한 단계 내린다.
    tier: tier === "perfect" && tokens.some((t) => !t.ok) ? "good" : tier,
    tokens,
  };
}

export const TIER_TEXT = {
  perfect: "완벽해요!",
  good: "참 잘했어요!",
  retry: "한 번 더 따라해볼까요?",
};
