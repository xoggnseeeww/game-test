---
paths:
  - "app.js"
---

# `app.js` 편집 규칙

단일 파일 · 빌드 없음 · 타입 체크 없음. **오타와 누락을 잡아주는 도구가 하나도 없다.**

## 새 화면을 추가할 때 — 4곳 전부
1. `ROUTES` — 경로 → 화면 키
2. `render()`의 switch — 화면 키 → 렌더 함수
3. `SCREEN_TITLES` — 화면 키 → `document.title`
4. 필요 시 `resolveScreen()` — 선행 상태 없이 진입했을 때의 폴백

**하나라도 빠지면 에러 없이 홈 폴백·빈 화면·제목 미변경이 된다** → `docs/ERRORS.md` E-2

## 개수는 절대 하드코딩하지 않는다 (주석 포함)
`QUESTIONS.length` · `Object.keys(RESULT_TYPES).length` · `CPT_ROUNDS` 를 쓴다.

```bash
grep -nE '>[^<{]*[0-9]+(문항|가지|라운드)' app.js   # 기대값: 출력 없음
```

## 타이머는 모듈 스코프에 담고 `setScreen()`에서 해제한다
`render()`가 DOM을 통째로 버리므로 타이머만 살아남아 사라진 요소를 건드린다.
지역 변수에만 담으면 해제 경로가 없다 → `docs/ERRORS.md` E-4

## 에러를 삼키지 않는다
`.catch(() => {})` 금지. 최소한 `console.error`, 가능하면 버튼 라벨로 사용자 피드백(기존 공유·저장 버튼이 이 패턴).
**예외**: `localStorage` 접근은 프라이버시 모드에서 throw 하므로 `bestReactionTime()` / `saveBestReactionTime()`의 try/catch는 **의도된 방어**다. 제거하지 말 것.

## 되돌린 접근을 다시 제안하지 않는다
`docs/DECISIONS.md` — D-5(속도=충동), D-7(페이지 자체 주소 공유), D-10(ADHD 명칭 제거)은 전부 시도했다가 되돌린 것이다.

## 이 파일을 고치고 나서
```bash
# 결과 유형 ↔ 공유 슬러그 개수 일치 (두 값이 같아야 함)
grep -cE '^  "[01]{3}": \{' app.js
grep -cE '^  [a-z]+: "[01]{3}",' app.js

# 템플릿 문자열 안 클래스명이 styles.css에 실제로 있는지 (오타는 아무도 못 잡는다)
grep -n '<추가한 클래스명>' app.js styles.css
```

**그리고 반드시 실제 브라우저에서 해당 흐름을 재현한다.** 정적 검사로는 이 파일의 버그를 거의 못 잡는다 → `docs/ERRORS.md` A-1
