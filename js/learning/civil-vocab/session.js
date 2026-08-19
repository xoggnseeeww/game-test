// 학습 세션의 순수 로직 — DOM도 state도 모른다(js/learning/score.js·srs.js와 같은 규칙).
// 그래서 `node --test`(test/learning.vocab.test.js)로 직접 검증된다.
//
// M1(지금)이 다루는 범위: DAY 하나를 (1) 단어 카드로 훑고 (2) 4지선다로 확인하는 것.
// 간격 반복(SRS) 일정은 다음 단계다 — 어린이 문장용 srs.js를 그대로 쓰지 않고 별도
// 스케줄러를 둘 예정이라(졸업 시 삭제 규칙이 8000단어 장기 보존과 맞지 않는다) 여기에
// 미리 껍데기를 만들어두지 않았다(docs/vocab-architecture.md §5).
import { QUIZ_CHOICES } from "./manifest.js";

// 시드 기반 난수(mulberry32). Math.random을 안 쓰는 이유는 테스트에서 같은 문제지가
// 재현돼야 하기 때문이다 — 화면은 Date.now()를 시드로 넘겨 매번 다른 순서를 받는다.
export function makeRng(seed) {
  let t = seed >>> 0;
  return function rng() {
    t += 0x6d2b79f5;
    let x = Math.imul(t ^ (t >>> 15), 1 | t);
    x ^= x + Math.imul(x ^ (x >>> 7), 61 | x);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffleWith(list, rng) {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// 카드·보기에 쓰는 대표 뜻. 뜻이 여럿이면 첫 번째가 시험에서 가장 자주 묻는 뜻이다
// (데이터 작성 규칙 — words/day-001.js 헤더).
export function primaryMeaning(word) {
  return word.ko[0];
}

// 한 단어에 대한 4지선다. **오답 보기는 같은 DAY의 다른 단어 뜻**에서 뽑는다 —
// 보기를 따로 저작하지 않아도 되고(단어가 늘면 문제도 는다), 소재가 같은 단어들이라
// 대충 찍어서 맞기도 어렵다.
//
// 뜻이 우연히 같은 단어(동의어)는 보기에서 뺀다 — 정답이 두 개가 되면 문제가 성립하지 않는다.
export function makeQuestion(word, pool, rng, size = QUIZ_CHOICES) {
  const answer = primaryMeaning(word);
  const seen = new Set([answer]);
  const distractors = [];
  for (const other of shuffleWith(pool, rng)) {
    if (other.id === word.id) continue;
    const text = primaryMeaning(other);
    if (seen.has(text)) continue;
    seen.add(text);
    distractors.push(text);
    if (distractors.length >= size - 1) break;
  }
  const options = shuffleWith([answer, ...distractors], rng);
  return { id: word.id, word: word.word, answer, options, answerIndex: options.indexOf(answer) };
}

// DAY 하나의 문제지. 순서를 섞는 이유: 카드로 훑은 직후라 순서대로 내면 "앞 단어였으니까
// 이거"라는 위치 기억으로 맞힐 수 있다.
export function buildQuiz(words, rng, size = QUIZ_CHOICES) {
  return shuffleWith(words, rng).map((word) => makeQuestion(word, words, rng, size));
}

export function accuracy(right, total) {
  return total === 0 ? 0 : Math.round((right / total) * 100);
}

// ── 빈칸 채우기(철자·산출 연습) ─────────────────────────────────────────────
// 4지선다는 **재인(알아보기)**만 훈련한다 — 보기 중에 답이 있으니 떠올리지 않아도 맞힐 수
// 있다. 시험은 빈칸·유의어·문맥이라 산출까지 가야 하는데, 문제를 새로 저작하지 않고
// **이미 있는 예문에서 표제어를 지워** 만든다. "예문에 표제어가 (굴절형 포함) 들어 있다"를
// test/learning.vocab.test.js가 보장하고 있어서 성립하는 방식이다(콘텐츠 추가 0).

// 예문 안에서 표제어가 실제로 쓰인 형태를 찾는다(applies·applied처럼 변형돼 있다).
export function clozeToken(word) {
  const stem = word.word.replace(/(y|e)$/i, "").toLowerCase();
  for (const token of word.ex.en.match(/[A-Za-z]+/g) || []) {
    if (token.toLowerCase().startsWith(stem)) return token;
  }
  return null;
}

export const CLOZE_BLANK = "_____";

export function makeCloze(word) {
  const token = clozeToken(word);
  if (!token) return null;
  return {
    id: word.id,
    word: word.word,
    // 같은 단어가 두 번 나오면 둘 다 지운다 — 하나만 지우면 나머지가 답을 그대로 보여준다.
    sentence: word.ex.en.replace(new RegExp(`\\b${token}\\b`, "g"), CLOZE_BLANK),
    ko: word.ex.ko,
    meaning: primaryMeaning(word),
    answer: token,
    // 첫 글자와 길이만 준다 — 완전 백지는 이 난이도에서 좌절이 크고, 철자 연습은 남는다.
    shape: token[0] + "·".repeat(Math.max(0, token.length - 1)),
  };
}

// 채점은 표제어 형태도 받아준다: 예문이 "applies"여도 apply라고 쓴 사람이 뜻을 모르는 건
// 아니다(철자 연습이 목적이지 굴절 시험이 아니다). 대소문자·구두점·공백은 무시한다.
export function checkCloze(cloze, input, word) {
  const norm = (s) => String(s || "").toLowerCase().replace(/[^a-z]/g, "");
  const given = norm(input);
  if (!given) return false;
  return given === norm(cloze.answer) || given === norm(word ? word.word : cloze.word);
}

// ── 오늘 큐 ────────────────────────────────────────────────────────────────
// 복습이 먼저지만 신규를 뒤에 몰지 않고 섞는다 — 복습만 20개 연속이면 지루하고, 신규만
// 20개 연속이면 어렵다. 복습 사이사이에 신규를 끼운다.
export function buildDailyQueue(dueWords, newWords, rng, reviewsPerNew = 3) {
  const reviews = shuffleWith(dueWords, rng).map((word) => ({ word, kind: "review" }));
  const fresh = shuffleWith(newWords, rng).map((word) => ({ word, kind: "new" }));
  const out = [];
  let r = 0;
  let n = 0;
  while (r < reviews.length || n < fresh.length) {
    for (let i = 0; i < reviewsPerNew && r < reviews.length; i++) out.push(reviews[r++]);
    if (n < fresh.length) out.push(fresh[n++]);
  }
  return out;
}

// 인출 강도는 단계적으로 올린다: 처음 몇 번은 뜻 고르기(재인), 익숙해지면 빈칸(산출).
// 쉬운 문제만 반복하면 "아는 것 같은 느낌"만 쌓인다.
export function retrievalMode(entry) {
  return entry && Number.isInteger(entry.reps) && entry.reps >= 2 ? "cloze" : "choice";
}
