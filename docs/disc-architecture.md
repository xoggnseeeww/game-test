# disc-architecture — 직장인 유형검사 (DISC)

> `docs/architecture.md`에서 분리된 DISC 전용 상세. 15KB 자동 분리 규칙(같은 파일 헤더 참고)에
> 따라 2026-07-28(NumPath 추가로 본문이 15KB를 넘겼을 때) 옮겨졌다. 여긴 DISC 흐름·채점
> 파이프라인만 있다 — 라우터 계약은 `docs/architecture.md`, 모듈맵은 `docs/module-map.md`,
> 화면 표는 `docs/screen-map.md`(뒤 둘은 D-88에서 architecture.md에서 또 한 번 분리됐다).

## 흐름

문항(12) → 딜레마 게임(8라운드) → 광고 게이트(`dilemma-ad`) → 결과. 12번째 문항을 답하면
`dilemma-intro`로 넘어가고, `disc-result`의 guard가 게임 완료를 요구한다. `dilemma-play`의
`finish()`가 `state.disc.dilemma`를 채운 뒤 `dilemma-ad`로 이동하며, 게임이 실제로 유형에
영향을 줬을 때만 "⚡ 딜레마 게임 결과 반영됨" 줄이 붙는다(`docs/decisions/2026-h2.md` D-18).

뒤로가기는 두 지점: `dilemma-intro`→`disc-question`(그 guard가 이미 "답이 다 차 있으면 마지막
문항으로 되돌림"을 하므로 별도 상태 없이 재사용), `dilemma-play`→`dilemma-intro`(문항 답변은
유지한 채 게임만 재시작).

게임이 결과 화면 뒤의 선택 보너스가 아니라, 마지막 문항 직후 반드시 거쳐야 하는 필수 단계로
통합돼 있다. 게임 없이는(직접 URL 접속 포함) 결과를 볼 수 없고, 별도의 "게임 결과" 화면도 없다.

## 채점 파이프라인 (`js/tests/disc/score.js`)

- **ipsative(강제선택)**: 상황마다 4개 선택지 중 "가장 나 같은 것"과 "아닌 것"을 고른다 → 축별 원점수 합은 **항상 0**
- 유형은 12종 (순수형 4 + 조합형 8). **대척점 조합(DS·SD·IC·CI)은 어떤 입력에도 나오지 않는다**
- 동점이면 결정론적으로 같은 답을 준다
- 딜레마 게임: 문항과 같은 형식(상황 8개 × D/I/S/C 4지선다, most만 — least 단계는 없음).
  8라운드 중 한 축이 절반(4개) 이상이면 +1, 3/4(6개) 이상이면 +2. 고르게 흩어지면 보너스 없음.
  클릭 타이밍은 더 이상 안 본다(`docs/decisions/2026-h2.md` D-24 — 예전엔 2택 선택지 + 지연시간
  추론이었는데 지연시간 신호가 잘 흔들려서 4택으로 바꿨다)
