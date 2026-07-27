---
paths:
  - "js/**"
---

# `js/` 모듈 편집 규칙

빌드 없음 · 번들러 없음 · 타입 체크 없음. `import` 경로는 **실제 파일 경로 그대로이며 확장자 `.js`가 필수**다.

## 새 화면은 디스크립터로만 추가한다
```js
{ id, path, title, render, theme?, guard?, dynamicPath? }
```
해당 테스트의 `index.js` 배열에 넣는다. **`render()`에 분기를 추가하거나 경로 표를 따로 두지 말 것** — 그러려고 레지스트리로 바꿨다(`docs/DECISIONS.md` D-13).

새 테스트라면 `js/main.js`에서 `registerTest()` **와** `registerScreens()` **둘 다** 호출한다.
하나만 하면 목록 카드나 공유 URL 한쪽이 조용히 빠진다 → `docs/ERRORS.md` E-2

## 화면 `id`는 바꾸지 않는다
`history.state`에 저장되므로, 개명하면 배포 전에 열어둔 탭의 뒤로가기가 깨진다.
ADHD가 아직 `test-*`인 것은 이 때문이다 → `docs/ERRORS.md` E-2b · `docs/DECISIONS.md` D-16

## 타이머·rAF·전역 리스너는 `onLeave()`에 등록한다
```js
const id = setTimeout(tick, 1000);
onLeave(() => clearTimeout(id));

const raf = requestAnimationFrame(loop);
onLeave(() => cancelAnimationFrame(raf));
```
`render()`가 DOM을 통째로 버리므로 예약된 콜백만 살아남는다. 특정 타이머를 이름으로 관리하다 **rAF 콜백이 다른 화면을 결과 화면으로 밀어버린 적이 있다** → `docs/ERRORS.md` E-4

## 개수는 화면 문구·주석 어디에도 하드코딩하지 않는다
`${QUESTIONS.length}` · `${TETRADS.length}` · `${Object.keys(DISC_TYPES).length}` · `${CPT_ROUNDS}` 를 쓴다.
**`npm test`(`test/copy.test.js`)가 막는다** — 3회 재발해서 코드로 승격시킨 규칙이다 → `docs/DECISIONS.md` D-17

## 에러를 삼키지 않는다
`.catch(() => {})` 금지. 최소한 `console.error`, 가능하면 버튼 라벨로 사용자 피드백(기존 공유·저장 버튼이 이 패턴).
**예외**: `localStorage` 접근(프라이버시 모드 throw)과 `runTeardowns()`의 catch는 **의도된 방어**다. 제거하지 말 것.

## 채점 로직은 DOM을 모르게 유지한다
`score.js`가 순수 함수라서 `node --test`로 브라우저 없이 검증된다. 여기에 DOM 접근을 넣으면 그 검증이 통째로 사라진다.

## 되돌린 접근을 다시 제안하지 않는다
`docs/DECISIONS.md` — D-5(속도=충동), D-7(페이지 자체 주소 공유), D-10(ADHD 명칭 제거), D-14(타이머를 이름으로 관리)는 전부 시도했다가 되돌린 것이다.

## 이 폴더를 고치고 나서
```bash
npm test          # 모듈 정합성 · 화면 id/경로 중복 · 채점 불변식 · 문구 하드코딩
```
그리고 **실제 브라우저**에서 해당 흐름을 재현한다(`scripts/verify.cjs`).
`npm test`는 라우팅·이벤트·타이머·레이아웃을 하나도 못 잡는다 → `docs/ERRORS.md` A-1

새 검사를 추가했다면 **버그를 일부러 되살려 빨간불이 뜨는지 확인**할 것. 초록불만 보면 검사가 비어 있어도 모른다.
