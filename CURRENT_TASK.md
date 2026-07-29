# 현재 작업 상태
> 항상 자동 로드. 세션 종료마다 갱신. 상세 이력은 `PROGRESS.md`.
> 이 파일은 1~2k 토큰 이하를 유지한다 — "언젠가 할 일"이 아니라 "지금 유효한 작업"만.

## 현재 작업
없음. 2026-07-28: DISC 문항·딜레마 선택지 중 상황과 안 맞거나 어색한 문구 3건 수정(식당 메뉴 상황에서
"평점·웨이팅 검색"이 튀어나오던 것 등) + main 머지 완료. 상세는 `PROGRESS.md` 2026-07-28 항목 참고.

이전(2026-07-28, 메인 머지 완료): 독립 미니게임 **NumPath: Stack & Clear**(숫자 경로 퍼즐) 추가.
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
- **NumPath 5×5 보드 터치 히트 영역** — 고레벨(레벨 4) 그리드의 타일이 실제 손가락으로 누르기에
  충분한 크기인지 실기기에서 확인 필요
- **홈 화면 헤더 레이아웃** — 기능 없던 우측 상단 ☰ 아이콘 제거 후 로고만 남은 좌측 정렬이 실제 배포본에서도 깨지지 않는지 확인 필요

## 알려진 이슈
| 이슈 | 영향 | 우선순위 |
|------|------|----------|
| 페이지별(테스트별) OG 메타는 여전히 공통 | 낮음 — `og:image`는 2026-07-28에 채웠으나, 정적 SPA라 테스트별 미리보기 문구·썸네일 분기는 안 됨(결과 주소마다 정적 셸이 있어야 가능) | 하 |
| `THEME_CLASSES`의 `theme-adhd`에 대응하는 CSS 블록이 없음 | 낮음 — 아무 화면도 `theme: "adhd"`를 쓰지 않아 무해. 쓰려면 `styles.css`에 변수 블록부터 | 하 |
| 진행 중 새로고침하면 답변 소실 (`state`가 메모리 전용) | 낮음 | 하 |

## 보류 (차단됨)
- 없음

## 백로그
(3개월 이상 미처리 항목은 삭제하거나 `docs/IDEAS.md`로 이동)
- 기억력 미니게임 추가 (홈 문구가 이미 예고 중)
- 공유 시 결과 이미지 자동 첨부 (현재는 다운로드 후 수동)
