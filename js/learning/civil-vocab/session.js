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
