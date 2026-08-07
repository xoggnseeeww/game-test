// 음성 고르기 — `js/learning/speech.js`에서 이 함수만 순수 함수라 여기서 검증한다.
// 나머지(speak/listen)는 브라우저 API에 묶여 있어 `scripts/verify.cjs`로만 확인된다.
//
// 이 로직이 깨지면 "영어 문장을 인도식/영국식, 심하면 한국어 발음으로 읽는" 형태로 나타난다.
// 화면엔 아무 표시가 안 나고 소리로만 드러나서(=자동 검증이 안 됨) 여기서 묶어둔다.
import test from "node:test";
import assert from "node:assert/strict";
import { pickVoice } from "../js/learning/speech.js";

const v = (lang, name, localService = true) => ({ lang, name, localService });

test("지역까지 맞는 음성이 다른 지역보다 먼저다 (en-IN 네트워크 < en-US 로컬)", () => {
  const voices = [v("en-IN", "Indian", false), v("en-GB", "British", false), v("en-US", "American", true)];
  assert.equal(pickVoice(voices, "en-US").name, "American");
});

test("지역이 같은 것끼리는 네트워크 음성을 선호한다 (D-84의 원래 의도)", () => {
  const voices = [v("en-US", "Local US", true), v("en-US", "Google US", false)];
  assert.equal(pickVoice(voices, "en-US").name, "Google US");
});

test("정확히 맞는 지역이 없으면 같은 언어의 다른 지역으로 떨어진다", () => {
  const voices = [v("ko-KR", "한국어", true), v("en-GB", "British", true)];
  assert.equal(pickVoice(voices, "en-US").name, "British");
});

test("다른 언어 음성은 절대 고르지 않는다 (영어를 한국어 엔진으로 읽는 사고 방지)", () => {
  const voices = [v("ko-KR", "한국어", false), v("ja-JP", "日本語", false)];
  assert.equal(pickVoice(voices, "en-US"), null, "맞는 언어가 없으면 null이어야 한다(브라우저 기본에 맡김)");
});

test("한국어 요청도 같은 규칙으로 고른다", () => {
  const voices = [v("en-US", "American", false), v("ko-KR", "한국어", true)];
  assert.equal(pickVoice(voices, "ko-KR").name, "한국어");
});

test("ko_KR처럼 언더스코어로 오는 기기도 지역 일치로 인정한다", () => {
  const voices = [v("ko", "generic", true), v("ko_KR", "정확", true)];
  assert.equal(pickVoice(voices, "ko-KR").name, "정확");
});

test("목록이 비었거나 없어도 터지지 않는다", () => {
  assert.equal(pickVoice([], "en-US"), null);
  assert.equal(pickVoice(undefined, "en-US"), null);
});
