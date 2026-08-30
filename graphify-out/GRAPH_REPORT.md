# Graph Report - .  (2026-07-30)

> ⚠️ **생성 시점 스냅샷 — 현재 구조의 근거로 쓰지 말 것.**
> 이 리포트는 `/graphify` 스킬이 돌 때만 갱신된다(CLI `graphify`에는 생성 명령이 없다).
> 위 날짜 이후 `js/learning/` 아래로 도구 4개가 늘었고 여기엔 한 줄도 반영돼 있지 않다.
> **구조의 단일 소스는 `CLAUDE.md` 구조 개요와 `docs/module-map.md`다.**
> `graphify-out/`의 나머지(cache·manifest)는 기계별 캐시라 git·컨텍스트에서 제외했다(2026-08-28).

## Corpus Check
- 75 files · ~119,803 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 536 nodes · 1468 edges · 30 communities (25 shown, 5 thin omitted)
- Extraction: 96% EXTRACTED · 4% INFERRED · 0% AMBIGUOUS · INFERRED: 55 edges (avg confidence: 0.76)
- Token cost: 543,821 input · 0 output

## Community Hubs (Navigation)
- Couple Questionnaire Assembly
- Ad Gate & DOM Binding
- NumPath Audio & Tiles
- Couple Code Backend (KV)
- Router Registry
- DISC Data & Radar Chart
- Project Context Docs (CLAUDE.md)
- Couple Check Architecture & Safety
- Couple Scoring & State Decisions
- ADHD/DISC Flow Architecture Docs
- ADHD Data & Scoring
- Current Task & Result Layout
- Browser Verify Script
- Router & Screen Registry Rules
- Ad Gate & OG Shell Mechanism
- ADHD OG Image Elements
- Package Manifest
- Module Import/Export Test
- DISC OG Image Elements
- Share URL Mechanism
- Styling & Legacy Mockup
- Homepage OG Image Elements
- Local Dev Server (serve.py)
- Copy Count Test
- Favicon Design
- NumPath OG Image Elements
- Apple Touch Icon
- Manual Count-Sync Pitfall (A-2)
- Byte vs Char Miscount (A-4)
- Pages Deploy Routing Pitfall (E-5)

## God Nodes (most connected - your core abstractions)
1. `DECISIONS.md — 설계 결정 인덱스` - 51 edges
2. `el()` - 42 edges
3. `bindNav()` - 39 edges
4. `adSlotMarkup()` - 32 edges
5. `go()` - 31 edges
6. `renderDiscResult()` - 19 edges
7. `renderCoupleResult()` - 18 edges
8. `CLAUDE.md — 과몰입구역 프로젝트 작업 컨텍스트` - 17 edges
9. `CURRENT_TASK.md — 현재 작업 상태` - 17 edges
10. `PROGRESS.md — 작업 이력` - 16 edges

## Surprising Connections (you probably didn't know these)
- `결과 전달 안전 장치 표 (§8)` --semantically_similar_to--> `ABSOLUTE RULES — 디스크립터 등록·onLeave·화면id불변·하드코딩금지 등`  [INFERRED] [semantically similar]
  docs/couple-architecture.md → CLAUDE.md
- `design-draft.html — 최초 디자인 목업` --references--> `CLAUDE.md — 과몰입구역 프로젝트 작업 컨텍스트`  [EXTRACTED]
  docs/design-draft.html → CLAUDE.md
- `카카오 AdFit 실연동 — Cloudflare 환경변수 오해 정정` --conceptually_related_to--> `CLAUDE.md — 과몰입구역 프로젝트 작업 컨텍스트`  [INFERRED]
  PROGRESS.md → CLAUDE.md
- `데이터팬트리 연동 — OG 이미지·파비콘 신규 + 상호 링크` --conceptually_related_to--> `CLAUDE.md — 과몰입구역 프로젝트 작업 컨텍스트`  [INFERRED]
  PROGRESS.md → CLAUDE.md
- `js/ 모듈 편집 규칙` --conceptually_related_to--> `화면 디스크립터 {id, path, title, render, theme?, guard?, dynamicPath?}`  [INFERRED]
  .claude/rules/js-modules.md → docs/architecture.md

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **AI 협업 컨텍스트 문서 4계층 체계 (CLAUDE.md/CURRENT_TASK.md/PROGRESS.md/DECISIONS.md/ERRORS.md)** — claude, current_task, progress, docs_decisions, docs_errors [EXTRACTED 1.00]
- **OG 미리보기 정적 셸 메커니즘 (_redirects rewrite + index.html + 3개 셸)** — index, og_shells_test_adhd, og_shells_test_disc, og_shells_game_numpath, docs_decisions_2027_h1_d47 [EXTRACTED 1.00]
- **AdFit 광고 SPA 통합 패턴과 그 실패 사례들** — docs_decisions_2026_h2_d25, docs_decisions_2026_h2_d26, docs_errors_e10, docs_errors_e11 [INFERRED 0.85]

## Communities (30 total, 5 thin omitted)

### Community 0 - "Couple Questionnaire Assembly"
Cohesion: 0.06
Nodes (87): ANCHOR_OFFSETS, assembleQuestionnaire(), isReverse(), NOTICE_POSITION, orderItems(), repairReverseRuns(), scatterAnchors(), spacingOkAt() (+79 more)

### Community 1 - "Ad Gate & DOM Binding"
Cohesion: 0.10
Nodes (69): AD_UNITS, adGateMarkup(), adSlotMarkup(), bindAdGate(), bindExit(), bindNav(), el(), showModal() (+61 more)

### Community 2 - "NumPath Audio & Tiles"
Cohesion: 0.12
Nodes (39): getCtx(), playBlockedTone(), playClearChord(), playMoveTone(), SEMITONE, tone(), levelFor(), LEVELS (+31 more)

### Community 3 - "Couple Code Backend (KV)"
Cohesion: 0.12
Nodes (30): json(), onRequestGet(), json(), onRequestPost(), createCoupleCanvas(), drawCoupleCardFooter(), GAP_SCRIPTS, conflictPairText() (+22 more)

### Community 4 - "Router Registry"
Cohesion: 0.09
Nodes (28): refreshAds(), games, paths(), pathToScreen(), registerGame(), registerScreens(), registerTest(), render() (+20 more)

### Community 5 - "DISC Data & Radar Chart"
Cohesion: 0.14
Nodes (24): AXIS_LABELS, DILEMMAS, DISC_SLUG_TO_KEY, DISC_TYPES, TETRADS, animateRadar(), drawRadarOnCanvas(), gridAt() (+16 more)

### Community 6 - "Project Context Docs (CLAUDE.md)"
Cohesion: 0.11
Nodes (22): CLAUDE.md — 과몰입구역 프로젝트 작업 컨텍스트, 동기화 매트릭스 — 결합 관리 규칙, Cloudflare Web Analytics — 상위 존 자동 적용, 스니펫 중복 금지, D-12 SessionStart 훅을 만들지 않음, D-30 NumPath 타일 모델 {op, operand} 한 몸, D-31 NumPath 1차 범위를 기획서보다 의도적으로 좁힘, ERRORS.md — 오류 패턴 문서, E-9 local-server-no-fallback — http.server의 SPA 폴백 부재 (+14 more)

### Community 7 - "Couple Check Architecture & Safety"
Cohesion: 0.15
Nodes (21): ABSOLUTE RULES — 디스크립터 등록·onLeave·화면id불변·하드코딩금지 등, couple-architecture.md — 부부 관계 성향 체크 아키텍처, 문항지 조립 — 요인 이격·역채점 분산·앵커 후반부 분산, 이용 안내 화면 — '둘이 하면 더 정확해진다' 부정, 부부 매칭 — 4블록 구간 서술(단일 점수 폐기), 배우자 코드(25자, 백엔드 없음) — PAYLOAD_FIELDS, 문항 구성 — 49문항 요인·애착·갈등·앵커·QC·가변 문항, 결과 전달 안전 장치 표 (§8) (+13 more)

### Community 8 - "Couple Scoring & State Decisions"
Cohesion: 0.15
Nodes (19): state 객체 모양 — 메모리 전용 단일 상태, 부부 체크 채점 — 유효성 검사·정규화·동점 시드 타이브레이크, DECISIONS.md — 설계 결정 인덱스, D-1 결과 유형을 총점이 아니라 축별 프로필로, D-10 ADHD 명칭 유지 (리브랜딩 되돌림), D-2 유형을 8종(축당 고/저 2단계)으로 고정, D-20 반응속도 최고기록(localStorage) 게이미피케이션 제거, D-21 넓은 화면(PC)을 폰 프레임 카드로 (640px 확장) (+11 more)

### Community 9 - "ADHD/DISC Flow Architecture Docs"
Cohesion: 0.13
Nodes (18): adhd-architecture.md — ADHD 흐름·채점 파이프라인, ADHD 흐름: 문항→반응속도 게임→광고 게이트→결과, ADHD 채점 파이프라인 — profileKey/toPct(분모16), architecture.md — 모듈맵·라우터 계약·화면 표, 모듈맵 — js/core·js/tests·js/games·functions/api 구조, 화면 표 — 경로·id·테마·guard 목록(20+화면), D-15 DISC를 강제선택(ipsative) 방식으로, D-18 딜레마 게임을 결과 화면 선택적 보너스에서 문항 뒤 강제 단계로 (+10 more)

### Community 10 - "ADHD Data & Scoring"
Cohesion: 0.21
Nodes (12): OPTIONS, PROFILE_TO_SLUG, profileKey(), QUESTIONS, RESULT_TYPES, SLUG_TO_PROFILE, axisBreakdown(), axisIntensityText() (+4 more)

### Community 11 - "Current Task & Result Layout"
Cohesion: 0.18
Nodes (15): 영속 데이터 예외 — 부부 체크 짧은 코드 KV 7일 TTL, CURRENT_TASK.md — 현재 작업 상태, 알려진 이슈 표, 배포 후 확인 필요 목록 — 샌드박스 아웃바운드 제약, 결과 화면 정보 계층 — 펼침/접힘 구조, 부부 체크 화면 흐름 — 10화면, D-26 광고 슬롯 밀도 확대 + 문항 화면 in-place 렌더 전환, D-43 결과 화면의 정보 계층 — 핵심만 펼치고 나머지는 접는다 (+7 more)

### Community 12 - "Browser Verify Script"
Cohesion: 0.20
Nodes (8): { chromium }, fails, fs, ok, path, playNumpathRun(), readNumpathBoard(), solveNumpath()

### Community 13 - "Router & Screen Registry Rules"
Cohesion: 0.24
Nodes (11): js/ 모듈 편집 규칙, 화면 디스크립터 {id, path, title, render, theme?, guard?, dynamicPath?}, D-13 라우터를 레지스트리 방식으로 (5곳 → 1곳), D-14 정리 대상을 이름이 아니라 등록으로 (onLeave), D-16 화면 id에 옛 이름(test-*)을 유지, D-17 개수 하드코딩 금지를 문서 규칙에서 테스트로 승격, A-1 'npm test 통과'를 검증 완료로 오판, E-1 count-hardcode — 화면 문구 개수 하드코딩 (+3 more)

### Community 14 - "Ad Gate & OG Shell Mechanism"
Cohesion: 0.27
Nodes (11): 광고 게이트(전면형) 메커니즘 — 3초 카운트다운, OG 미리보기 셸 메커니즘 (§9, _redirects rewrite), D-25 게임 종료→결과 사이 광고 게이트(전면형) 삽입, 강제 시청 아님, D-9 빌드 도구·프레임워크를 도입하지 않음, D-47 테스트·게임 3곳에 페이지별 OG 미리보기 추가 — _redirects rewrite + 정적 셸, E-10 spa-third-party-script — AdFit 로더가 SPA 재스캔 안 함, index.html — SPA 진입점, og-shells/game-numpath.html — NumPath OG 미리보기 셸 (+3 more)

### Community 15 - "ADHD OG Image Elements"
Cohesion: 0.29
Nodes (8): '과 과몰입구역' brand mark (top badge + wordmark), Filename version suffix '-v2' (cache-busting convention, D-47), '무료' (Free) pill badge, og-adhd-v2.png (ADHD test OG share image), '12문항' (12 questions) pill badge, Tagline '집중 안 되는 나, 흑시...?' (Can't focus, maybe I...?), Dartboard/target icon (focus symbolism), Title text '성인 ADHD 성향 체크' (Adult ADHD Tendency Check)

### Community 16 - "Package Manifest"
Cohesion: 0.29
Nodes (6): description, name, private, scripts, test, type

### Community 17 - "Module Import/Export Test"
Cohesion: 0.29
Nodes (3): files, JS_DIR, ROOT

### Community 18 - "DISC OG Image Elements"
Cohesion: 0.40
Nodes (6): Badges: 상황 12개 + 게임 / 무료, 과몰입구역 brand logo/wordmark, 직장인 유형검사 (Workplace Type Test / DISC test) title, og-disc-v2.png (DISC OG Share Image), Comedy/tragedy theater masks icon (blue happy + yellow sad), OG image versioned-filename cache-busting convention (D-47)

### Community 19 - "Share URL Mechanism"
Cohesion: 0.40
Nodes (6): 공유 URL·결과 카드 캔버스 (js/core/share.js), D-7 공유 URL을 결과별 슬러그 주소로, D-8 카카오 SDK 대신 navigator.share, D-29 NumPath 공유 URL을 슬러그 없는 게임 주소로 (D-7 반대 방향), E-3 share-fallback — 공유 링크가 빈 결과로 폴백, DISC 공유 이미지 레이아웃 확장 — 설명 본문·생활 카드 4개·줄바꿈

### Community 20 - "Styling & Legacy Mockup"
Cohesion: 0.50
Nodes (5): 스타일·진입점·배포 파일 규칙, D-11 :has() 대신 JS 클래스 토글, design-draft.html — 최초 디자인 목업, E-6 modern-css — 최신 CSS 셀렉터로 구형 브라우저 깨짐, E-7 mockup-leftover — 목업 잔재가 실기기에서 이중/공백

### Community 21 - "Homepage OG Image Elements"
Cohesion: 0.40
Nodes (5): 과몰입구역 (Site Brand), DISC 행동유형 성향 체크 (referenced test), og-image.png (Default Homepage OG Image), 반응속도 게임 (referenced game), "나는 어떤 유형일까?" Tagline

### Community 23 - "Copy Count Test"
Cohesion: 0.40
Nodes (3): JS_DIR, RENDERED_COUNT, UNITS

### Community 24 - "Favicon Design"
Cohesion: 0.67
Nodes (3): Purple Rounded-Square Background (#5B44F2), Favicon (assets/favicon.svg), '과' Character Glyph (white, bold, centered)

### Community 25 - "NumPath OG Image Elements"
Cohesion: 1.00
Nodes (3): 과몰입구역 (brand), NumPath: Stack & Clear (mini-game), NumPath OG Share Image (v2)

## Knowledge Gaps
- **64 isolated node(s):** `AD_UNITS`, `screens`, `tests`, `games`, `teardowns` (+59 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **5 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `DECISIONS.md — 설계 결정 인덱스` connect `Couple Scoring & State Decisions` to `Project Context Docs (CLAUDE.md)`, `Couple Check Architecture & Safety`, `ADHD/DISC Flow Architecture Docs`, `Current Task & Result Layout`, `Router & Screen Registry Rules`, `Ad Gate & OG Shell Mechanism`, `Share URL Mechanism`, `Styling & Legacy Mockup`?**
  _High betweenness centrality (0.033) - this node is a cross-community bridge._
- **Why does `el()` connect `Ad Gate & DOM Binding` to `Couple Questionnaire Assembly`, `NumPath Audio & Tiles`, `Couple Code Backend (KV)`?**
  _High betweenness centrality (0.026) - this node is a cross-community bridge._
- **Why does `bindNav()` connect `Ad Gate & DOM Binding` to `Couple Questionnaire Assembly`, `NumPath Audio & Tiles`, `Couple Code Backend (KV)`?**
  _High betweenness centrality (0.023) - this node is a cross-community bridge._
- **What connects `AD_UNITS`, `screens`, `tests` to the rest of the system?**
  _64 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Couple Questionnaire Assembly` be split into smaller, more focused modules?**
  _Cohesion score 0.05979843225083987 - nodes in this community are weakly interconnected._
- **Should `Ad Gate & DOM Binding` be split into smaller, more focused modules?**
  _Cohesion score 0.0963855421686747 - nodes in this community are weakly interconnected._
- **Should `NumPath Audio & Tiles` be split into smaller, more focused modules?**
  _Cohesion score 0.12145390070921985 - nodes in this community are weakly interconnected._