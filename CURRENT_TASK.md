# 현재 작업 상태
> 항상 자동 로드. 세션 종료마다 갱신. 상세 이력은 `PROGRESS.md`.
> 이 파일은 1~2k 토큰 이하를 유지한다 — "언젠가 할 일"이 아니라 "지금 유효한 작업"만.

## 현재 작업
2026-07-30: NumPath 마을을 data-pantry.com 계정에 선택적으로 동기화(D-35, 사용자가 "로그인
체계 필요하지 않냐"고 물어 진행). data-pantry.com과 같은 Supabase 프로젝트(`duvpvwolgqurhgnhqezj`)에
`numpath_village` 테이블(RLS, 본인 행만) 신설·적용 완료. 로그인은 선택 사항 — 게스트는 기존
localStorage만 사용. 신규 `cloud.js`(Supabase JS, 구글·카카오 OAuth)는 **static import 금지** —
CDN 실패가 모듈 그래프 전체를 깨뜨리지 않도록 `cloud-loader.js`(동적 import + 실패 캐시)로만
연결했다. 로그인 감지 시 `mergeVillages()`(coins=max, built=합집합, 멱등)로 로컬·클라우드를
합치고, 이후 코인 획득·건설마다 로그인 상태면 클라우드에도 반영. 마을 화면에 연동 패널 추가,
XSS 방지용 `escapeHtml()` 신설(`core/util.js`, OAuth 표시 이름을 처음으로 템플릿에 꽂는 사례).
`npm test` 80/80, `scripts/verify.cjs` 93/93 통과(CDN 차단 상태에서 패널이 "사용 불가"로 착지하고
나머지 화면은 정상 동작하는 것까지 확인 — 샌드박스가 실제로 이 조건이라 폴백 경로가 검증됨).

이전(2026-07-30): NumPath 게임 개선 3종(난이도 시스템·리플레이성 강화·보상 체계) — 상세는
`docs/decisions/2027-h1.md` D-34, `docs/numpath-architecture.md` 참고.

더 이전(2026-07-30): 배너가 상단+하단 2개인 화면에서 한쪽만 채워진다는 리포트 →
같은 AdFit 광고 단위 코드(`banner`)를 한 페이지에 두 번 써서 뒤쪽이 무시된 것이 원인
(`docs/ERRORS.md` E-11). 320×50 단위를 하나 더 만들어(`DAN-o7v5hdDAgfmSu96C`)
`AD_UNITS`를 `bannerTop`/`bannerBottom`으로 분리 — 마크업 클래스(`cssClass`)는 그대로
`"banner"`라 CSS는 안 건드림. 배너 있는 5개 화면(홈·ADHD/DISC 인트로·문항·공유 결과·
NumPath 인트로/플레이) 전부 상단·하단이 서로 다른 코드를 쓰도록 호출부 갱신.
`npm test` 66/66, `scripts/verify.cjs` 70/70 통과.

이전(2026-07-30, main 머지 완료): 사용자가 "주변에 해보니까 거의 다 든든한 나무(S)로 나온다"고 실사용
편향을 제기 — 채점(`score.js`)은 4축 대칭이라 편향 없음을 확인했으나, `TETRADS`(12) +
`DILEMMAS`(1)의 S축 선택지 중 "집에서 편하게 쉰다"류 무난한 공감형 문구가 사회적
바람직성 편향으로 실제 성향과 무관하게 골라지기 쉬운 것을 원인으로 지목. S축 13개
선택지를 안정형만의 구체적 행동(루틴 유지·갈등 회피 아닌 사후 다독임·익숙한 것
선호)으로 재작성 → main 머지 완료. 상세는 `PROGRESS.md`.

이전(2026-07-30, main 머지 완료): DISC 인트로의 "결과 유형" 칩을 눌러 12가지 유형을
검사 없이 미리보는 화면(`disc-types`, `/test/disc/types`) 추가 — 카드를 누르면 기존
공유 상세 화면(`disc-shared`)으로 직행. 관련 결정: `docs/decisions/2027-h1.md` D-33.

더 이전(2026-07-30, main 머지 완료): 테스트·게임 3곳에 페이지별 OG 미리보기 추가
(`og-shells/*.html` + `_redirects` rewrite) → 배포 후 여러 라운드 실사용 피드백(이미지
크롭·톤·캐시·**`_redirects` 목적지의 `.html` 확장자가 Cloudflare clean-URL 정규화로 308을
유발해 `/test/disc`가 홈으로 떨어지던 진짜 원인**)을 거쳐 수정 완료, 사용자 확인함. 이어서
DISC 공유 이미지("🖼️ 이미지 저장")에 유형 설명 + "실제로는 이렇게 나와요" 4카드가 빠져
있던 것도 `layoutDiscCardBody()`로 추가. 관련 결정: D-32(갱신 4건). 상세는 `PROGRESS.md`.

더 이전(2026-07-28): DISC 문항·딜레마 선택지 중 상황과 안 맞거나 어색한 문구 3건 수정(식당
메뉴 상황에서 "평점·웨이팅 검색"이 튀어나오던 것 등) + main 머지 완료. 상세는 `PROGRESS.md`.

더 이전(2026-07-28, 메인 머지 완료): 독립 미니게임 **NumPath: Stack & Clear**(숫자 경로 퍼즐) 추가.
`js/games/numpath/`(engine·generate·solve·audio·play·screens·index) 신설, 라우터에
`registerGame`/`listGames` 신규 도입(`registerTest`/`listTests`와 대칭), `/game/numpath/*` 4화면.
`renderGameList()`가 이제 `listGames()`로 카드를 자동 생성해 "미니게임 목록이 비어 있음" 항목이
해소됨. 리뷰 중 `starsFor()`의 2성 등급이 모든 레벨에서 도달 불가능하던 버그를 찾아 같이 수정.
이어서 사용자 피드백("목표값이 안 보이고 설명 부족")으로 플레이 화면 HUD에 "현재값 → 목표값"
전용 배너를 추가하고 인트로에 칸 종류(시작/연산/배수/차단) 안내를 붙였다.
관련 결정: `docs/decisions/2027-h1.md` D-28(독립 게임 레지스트리)·D-29(공유 URL, D-7과 반대
방향)·D-30(타일 모델)·D-31(1차 범위 축소). 상세는 `docs/numpath-architecture.md`.
`docs/architecture.md`가 15KB를 넘겨 자동 분리 규칙에 따라 `docs/adhd-architecture.md` ·
`docs/disc-architecture.md` · `docs/numpath-architecture.md`로 나뉘었다 — 이제부터 ADHD/DISC
상세를 찾을 땐 architecture.md가 아니라 이 세 파일을 본다.

더 이전(2026-07-28 앞부분, 메인 머지 완료): 광고 수익화 3건·DISC 명칭 변경·딜레마 4택 재설계·
데이터팬트리 연동·홈 화면 기능 없는 헤더 ☰ 버튼 제거. 관련 결정은 `docs/DECISIONS.md` D-24~D-27.

## 다음 작업 우선순위
없음.

## 배포 후 확인 필요
> 샌드박스는 아웃바운드가 프록시로 막혀 아래를 **확인하지 못했다.** "확인됨"으로 간주하지 말 것.

- **결과 카드 폰트** — CDN 차단으로 결과 카드가 sans-serif 폴백으로만 그려졌다
- **`navigator.share` 공유시트** — 헤드리스엔 API가 없어 클립보드 폴백 경로만 확인됨. 실기기 확인 필요
- **`_redirects` 실동작** — 로컬은 `serve.py`로 흉내 낸 것. 배포본에서 `/test/disc/result/lion` 직접 접속이 200인지 확인
- **OG 이미지 실제 미리보기** — 카카오톡/트위터/페이스북 디버거로 `https://fun.data-pantry.com/assets/og-image.png`가 실제로 불러와지는지, 카드가 `summary_large_image`로 정상 렌더되는지 배포 후 확인 필요 (샌드박스는 절대경로 이미지 요청을 외부에서 검증 못 함)
- **데이터팬트리 헤더 FUN 버튼** — `data-pantry-web-site` 저장소의 헤더에 새 링크를 추가했음. 두 사이트가 각각 배포된 뒤 실제로 FUN 버튼 → `fun.data-pantry.com` 이동이 되는지, 이 사이트 하단 `by 데이터팬트리` 링크 → `data-pantry.com` 이동이 되는지 상호 확인 필요
- **NumPath Web Audio 실기기 동작** — 헤드리스엔 오디오 출력이 없어 확인 못함. iOS Safari의 첫
  제스처 전 `AudioContext` suspended 상태에서 타일 클릭으로 정말 resume되는지, 무음 스위치일 때
  거슬리지 않는지 확인 필요
- **NumPath 광고 슬롯 실제 노출** — 기존 항목과 같은 이유(`t1.daumcdn.net` 차단)로 `/game/numpath/*`
  4화면·광고 게이트(`numpath-ad`)의 300×250 포함해서 실기기 확인 필요
- **NumPath 5×5 보드 터치 히트 영역** — 고레벨(레벨 4·5) 그리드의 타일이 실제 손가락으로 누르기에
  충분한 크기인지 실기기에서 확인 필요
- **NumPath 마을 localStorage 실기기 동작** — 헤드리스에서는 새로고침 후 유지까지 확인했지만,
  iOS Safari 프라이버시 모드(접근 시 throw → 빈 마을 폴백)와 일반 모드의 장기 보존(ITP 7일
  스토리지 삭제 정책에 걸리는지)은 실기기에서 확인 필요
- **NumPath 마을 화면 광고 슬롯** — 신설 화면(`/game/numpath/village`) 상단·하단 배너도 기존
  항목과 같은 이유(`t1.daumcdn.net` 차단)로 실기기 확인 필요
- ~~Supabase Auth 리다이렉트 URL 허용 목록에 `fun.data-pantry.com` 추가~~ — 사용자가 Supabase
  대시보드에서 `https://fun.data-pantry.com/**`을 Redirect URLs에 직접 등록 완료(2026-07-30).
  Supabase MCP엔 Auth URL 설정 도구가 없어 코드로는 못 건드리는 부분이라 수동으로 처리됨
- **NumPath 클라우드 로그인 실기기 동작(D-35)** — 샌드박스는 esm.sh(Supabase JS) 자체가 차단돼
  "CDN 실패 시 패널이 사용 불가로 착지하고 나머지는 정상"까지만 확인했다. 실제 로그인 성공
  경로(구글·카카오 OAuth 왕복 → `numpath-village`로 돌아와 세션 인식 → 로컬·클라우드 병합)는
  실기기·실배포에서 확인 필요. 위 리다이렉트 URL 허용부터 먼저 해결해야 시도 가능하다
- **홈 화면 헤더 레이아웃** — 기능 없던 우측 상단 ☰ 아이콘 제거 후 로고만 남은 좌측 정렬이 실제 배포본에서도 깨지지 않는지 확인 필요
- ~~`_redirects`의 `.html` 확장자 제거가 실제로 308을 없앴는지~~ — 사용자가 배포본에서
  직접 재현·확인함(2026-07-30, "된다"). `/test/adhd`·`/test/disc`·`/game/numpath` 셋 다
  정상 동작 확인됨
- **OG 미리보기 실제 렌더링(카카오톡 카드 이미지·문구)** — 라우팅 버그는 해결됐지만, 카카오
  크롤러가 세 URL의 최신 태그를 긁어갔는지는 `https://developers.kakao.com/tool/clear/og`로
  각 URL을 제출해봐야 확실하다(카카오 쪽 캐시가 예전 배포 시점 것일 수 있음)
- **신규 `og-*.png` 3장 실제 렌더** — 카카오톡/트위터 미리보기에서 폰트(Pretendard)가 정상
  적용됐는지. Playwright로 생성할 때는 웹폰트를 직접 불러와 그렸지만, 실제 카카오 크롤러가
  이미지를 리사이즈·재인코딩하는 과정에서 글자가 깨지는 사례가 보고돼 있어 확인 필요

## 알려진 이슈
| 이슈 | 영향 | 우선순위 |
|------|------|----------|
| 결과 공유 슬러그(`/test/*/result/<slug>`, 20개) OG 메타는 여전히 공통 | 낮음 — 테스트·게임 진입 화면 3곳은 2026-07-30에 페이지별로 분리됨(D-32). 결과 슬러그별 미리보기("나는 돌진하는 사자!")는 범위 밖으로 남겨둠 — 유형이 늘 때마다 셸도 늘어야 해서 유지비가 큼 | 중 |
| `THEME_CLASSES`의 `theme-adhd`에 대응하는 CSS 블록이 없음 | 낮음 — 아무 화면도 `theme: "adhd"`를 쓰지 않아 무해. 쓰려면 `styles.css`에 변수 블록부터 | 하 |
| 진행 중 새로고침하면 답변 소실 (`state`가 메모리 전용) | 낮음 | 하 |

## 보류 (차단됨)
- 없음

## 백로그
(3개월 이상 미처리 항목은 삭제하거나 `docs/IDEAS.md`로 이동)
- 기억력 미니게임 추가 (홈 문구가 이미 예고 중)
- 공유 시 결과 이미지 자동 첨부 (현재는 다운로드 후 수동)
