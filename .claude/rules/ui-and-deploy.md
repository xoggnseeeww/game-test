---
paths:
  - "styles.css"
  - "index.html"
  - "_redirects"
---

# 스타일 · 진입점 · 배포 파일 규칙

빌드도 폴리필도 없다. **여기 쓴 것이 그대로 사용자 브라우저에 간다.**

## 모바일 뷰포트에서 확인한다 (데스크톱 창에서는 안 보이는 버그가 있다)
- 뷰포트 높이 가정(`100vh` + `margin-auto` 류)은 실제 폰에서 큰 빈 공간을 만든다 → `position:fixed` + 컨테이너 패딩
- 목업(`docs/design-draft.html`)에서 마크업을 옮길 때는 **기기 크롬을 흉내 낸 요소**(가짜 상태바 등)를 먼저 걷어낸다 — 실기기에서 이중으로 보인다
→ `docs/ERRORS.md` E-7

## 최신 CSS 셀렉터로 상태를 추론하지 않는다
`:has()` 같은 셀렉터는 구형 브라우저에서 규칙 전체가 무시돼 레이아웃이 깨진다.
**조건부 스타일은 JS가 클래스를 붙인다** (`classList.toggle("어떤-클래스", 조건)` 패턴 — CSS는 그 클래스만 본다)
→ `docs/ERRORS.md` E-6 · `docs/DECISIONS.md` D-11

## 클래스명을 바꾸면 `js/`도 같이 본다
템플릿 문자열 안의 클래스명은 타입 체크가 없어 아무도 오타를 잡아주지 않는다.

```bash
grep -rn '<클래스명>' js/ styles.css   # 양쪽에 다 있어야 함
```

## 테마는 CSS custom properties로
브랜드 색은 인라인 스타일이 아니라 변수로 두고, `body.theme-adhd` / `theme-game` / `theme-disc`가 값을 갈아끼운다.
**테마 값을 새로 만들면 `js/core/router.js`의 `THEME_CLASSES` 배열에도 추가**해야 화면을 떠날 때 제거된다.
모달은 `#app` 밖(`document.body`)에 붙으므로 테마 클래스도 body에 있어야 모달 버튼 색까지 따라온다.

## `index.html`
- 메타·OG 태그는 **전 주소 공통**이다. 특정 테스트 이름을 넣으면 **다른 테스트 링크가 엉뚱하게 미리보기된다.**
  결과별 미리보기가 필요하면 결과 주소마다 정적 셸을 만들어야 한다.
- `<script type="module">`이다. 모듈은 `file://`로 열면 CORS로 죽는다 — 반드시 `serve.py`로 띄운다.
- `<meta name="referrer" content="strict-origin-when-cross-origin">` — 결과 경로(`/test/adhd/result/...`)가 외부로 새지 않게 하는 장치. **제거하지 말 것.**
- 스크립트/스타일 경로가 실제 파일명과 다르면 흰 화면이 된다 → `docs/ERRORS.md` E-5

## `_redirects`
`/*  /index.html  200` — **SPA의 생명선.** 없거나 오타가 나면 앱 내 이동은 되는데 하위 경로 직접 접속만 404가 된다(발견이 늦다).

```bash
cat _redirects   # 기대값: /*    /index.html   200
```
