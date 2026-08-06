# adhd-architecture — 성인 ADHD 성향 체크

> `docs/architecture.md`에서 분리된 ADHD 전용 상세. 15KB 자동 분리 규칙(같은 파일 헤더 참고)에
> 따라 2026-07-28(NumPath 추가로 본문이 15KB를 넘겼을 때) 옮겨졌다. 여긴 ADHD 흐름·채점
> 파이프라인만 있다 — 라우터 계약은 `docs/architecture.md`, 모듈맵은 `docs/module-map.md`,
> 화면 표는 `docs/screen-map.md`(뒤 둘은 D-88에서 architecture.md에서 또 한 번 분리됐다).

## 흐름

문항(12) → 반응속도 게임 → 광고 게이트(`reaction-ad`) → 결과. `test-question`이 마지막 문항
응답 직후 `reaction-intro`로 넘어가고, `test-result`의 guard가 `state.lastReaction` 없이는
결과를 보여주지 않는다. 게임 통계는 `test-result`에 병합돼 하나의 결과로 나온다
(`docs/decisions/2026-h2.md` D-19).

게임이 결과 화면 뒤의 선택 보너스가 아니라, 마지막 문항 직후 반드시 거쳐야 하는 필수 단계로
통합돼 있다. 게임 없이는(직접 URL 접속 포함) 결과를 볼 수 없고, 별도의 "게임 결과" 화면도 없다.

## 채점 파이프라인 (`js/tests/adhd/score.js`)

```
답변 수집   → 역채점 문항은 (4 - value)로 저장
게임 보너스 → gameBonuses(state.lastReaction) → { impulse: 0~4, focus: 0~4 }
퍼센트      → toPct(raw + bonus), 분모 16 (= 축당 4문항 × 4점)
프로필 키   → 축별 >= AXIS_HIGH_THRESHOLD(60) → "010" 같은 3비트
유형        → RESULT_TYPES[key] (8종)
```

- `energy` 축에는 게임 보너스가 없다(근거 부재 — `docs/decisions/2026-h2.md` D-6)
- 이미 100%인 축에는 보너스가 실제로 반영되지 않으므로 `visibleBonus`로 표시를 거른다
