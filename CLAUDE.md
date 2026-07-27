# 과몰입구역 — Claude 작업 컨텍스트

## READ ORDER
1. `CLAUDE.md` — 항상
2. `CURRENT_TASK.md` — 항상
3. `PROGRESS.md` — 조건부 (회귀 추적 / 과거 설계 배경 확인 / 명시 요청 / 맥락 부족 시에만). `.claudeignore` 대상이라 필요할 때 명시적으로 Read 한다
4. `docs/*` — 필요 시 선택 로드

## 커맨드
| 동작 | 명령어 |
|------|--------|
| 로컬 실행 | `python3 serve.py 8766` — **`-m http.server` 금지** (SPA 폴백 없어 하위 경로 404 → 라우팅 오판) → `docs/ERRORS.md` E-9 |
| 빌드 | **없음** |
| 회귀 검증 | `mkdir -p /tmp/pw && cd /tmp/pw && npm i playwright` → `NODE_PATH=/tmp/pw/node_modules node scripts/verify.js` (서버 먼저) |
| 배포 | `main` push → Cloudflare Pages 자동 배포 |

## 식별자
- 도메인 `https://fun.data-pantry.com` / 저장소 `xoggnseeeww/game-test`
- 호스팅: Cloudflare Pages — 빌드 명령 없음, 출력 디렉터리 = 레포 루트
- SPA 폴백: `_redirects` (`/*  /index.html  200`) — 없으면 하위 경로 직접 접속이 404
- 영속 데이터: `localStorage["gt_reaction_best"]` **이게 전부** / 시크릿·환경변수·백엔드 **없음**

## 기술 스택
빌드 없는 정적 SPA. 바닐라 JS 단일 파일(`"use strict"`), 프레임워크·번들러·의존성 0. 외부 의존은 CDN 폰트 하나.
라우팅은 History API 직접 구현, 상태는 메모리 내 `state`(새로고침하면 날아감).

## 구조 개요
```
index.html              진입점. 메타·OG·referrer 정책·CDN 폰트 (전 페이지 공통, 페이지별 동적 메타 없음)
app.js                  앱 전체 로직 (단일 파일) — 상세: docs/architecture.md
styles.css              전체 스타일 (화면별 섹션)
_redirects              Cloudflare Pages SPA 폴백
serve.py                로컬 개발 서버 (SPA 폴백 포함, 개발 전용)
scripts/verify.js       헤드리스 브라우저 회귀 스위트 (레포 의존성 아님 — 파일 헤더 참고)
docs/design-draft.html  최초 디자인 목업. 배포·동작과 무관 (.claudeignore)
```

## 상세 문서
| 문서 | 내용 |
|------|------|
| `docs/architecture.md` | `app.js` 모듈맵 · 라우트 표 · 상태 모양 · 채점 파이프라인 |
| `docs/ERRORS.md` | 오류 패턴 (같은 증상이 재발할 때) |
| `docs/DECISIONS.md` | 설계 결정 · 기각안 · 되돌림 |

## ⚠️ ABSOLUTE RULES
- **개수는 화면 문구에도 하드코딩 금지** — `${QUESTIONS.length}`, `${Object.keys(RESULT_TYPES).length}`, `${CPT_ROUNDS}`를 쓴다.
  확인: `grep -nE '>[^<{]*[0-9]+(문항|가지|라운드)' app.js` → **출력이 없어야 함**
- **새 화면 추가 = 4곳 동시 수정** — 아래 동기화 매트릭스 참조. 하나라도 빠지면 뒤로가기·직접 접속이 **조용히** 깨진다(에러 없음).
- **에러 삼킴 금지** — `.catch(() => {})` 금지, 최소한 `console.error`.
  예외: `localStorage` 접근은 프라이버시 모드에서 throw 하므로 try/catch 방어가 **의도된 것**이다(제거 금지).
- **검증은 실제 브라우저에서** — 빌드가 없어 "빌드 통과"라는 개념 자체가 없고, 정적 검사로는 이벤트 바인딩·라우팅·타이머·레이아웃을 하나도 못 잡는다.
  변경 후 헤드리스 Chromium으로 해당 흐름을 재현할 것. **확인하지 못한 항목은 `CURRENT_TASK.md`의 "배포 후 확인 필요"로 옮긴다** — 침묵은 "확인됨"으로 오독된다.
- **의학적 진단 표현 금지** — 결과·문구는 "성향 체크"까지만. `disclaimer` 문구를 제거하거나 약화하지 말 것 → `docs/DECISIONS.md`
- **타이머는 반드시 해제** — 화면 전환 시 `reactionTimer`를 정리하지 않으면 이전 화면의 콜백이 새 DOM에 대고 돈다 → `docs/ERRORS.md`

## 동기화 매트릭스
> `[바꾸는 것] → [반드시 같이 고칠 것]`. 모를 때 필요한 정보라서 자동 로드에 둔다.

- `ROUTES`에 경로 추가 → ① `render()`의 switch ② `SCREEN_TITLES` ③ 렌더 함수 ④ 필요 시 `resolveScreen()` 가드
- `QUESTIONS` 개수 변경 → 축당 문항이 4개가 아니게 되면 `computeResult()`의 `toPct` 분모 `16`(=4문항×4점)도 수정
- `RESULT_TYPES` 키 추가/삭제 → `SLUG_TO_PROFILE`에 슬러그 추가 (누락 시 공유 URL이 조용히 홈으로 폴백)
- `AXIS_HIGH_THRESHOLD` 변경 → `axisIntensityText()`의 구간 경계(`60`)도 같이 조정
- `CPT_ROUNDS` / `CPT_NOGO_COUNT` 변경 → `gameBonuses()`의 오류율 구간이 여전히 의미 있는지 확인
- 라우트·화면 구조 변경 → **같은 커밋에** `docs/architecture.md` 라우트 표 갱신
- `styles.css` 클래스명 변경 → `app.js`의 템플릿 문자열은 타입 체크가 없다. `grep -n '<클래스명>' app.js styles.css` 로 양쪽 확인

## 절대 수정 금지
`.git/` · `docs/design-draft.html`
