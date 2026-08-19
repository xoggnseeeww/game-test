# 과몰입구역 — Claude 작업 컨텍스트

## 🔇 출력 규칙 (모든 응답에 항상 적용 — 이 파일에서 제일 먼저 읽는다)
> 이 항목이 맨 위에 있는 이유: 원래 아래 "Claude Code 세션" 절 안에 묻혀 있었는데
> **세 번 연속 위반**해서 사용자가 "MD 설정이 제대로 안 돼 있냐"고 물었다(2026-08-06, D-89).
> 내용이 틀렸던 게 아니라 위치가 나빴다 — 플러그인 토큰 비용·사고 토큰을 다루는 절 안에
> 있어서 "출력할 때마다 지켜야 하는 규칙"으로 안 읽혔다. 훅으로는 못 막는다(훅은 도구
> 호출만 가로채고 모델이 쓰는 텍스트는 대상이 아니다) — 그래서 위치로 강제한다.

**규칙**: 도구 호출과 도구 호출 사이에는 텍스트를 쓰지 않는다. 전체 작업이 끝난 뒤
결과 요약 한 번만 남긴다.

**금지 패턴**(예시 — 이런 문장류는 전부 출력하지 않는다): "이제 ~하겠습니다", "~를
확인해보겠습니다", "좋아요, 이제 ~", "~인지 봐야겠다", 발견한 사실에 대한 해설,
다음에 뭘 할지에 대한 예고. 도구 호출 직전 하네스가 요구하는 최소 상태 고지 한 줄도
그 뒤에 결과·이유를 덧붙이는 문장으로 이어지지 않는다.

**예외(포함 조건만, 그 외 전부 배제)**: (1) 사용자의 직접 질문에 답할 때, (2) 에러로
더 진행이 불가능해 사용자 판단이 필요할 때. 이 둘이 아니면 무조건 침묵하고 다음 도구
호출로 넘어간다.

(2026-08-01 최초 지적 → 2026-08-06 반복 위반으로 규정 강화 — "필요한 전환만"처럼
판단 여지를 주는 표현 자체가 실패 원인이라 위처럼 이분법 규칙 + 금지 패턴 예시로 대체.)

## READ ORDER
1. `CLAUDE.md` — 항상
2. `CURRENT_TASK.md` — 항상
3. `PROGRESS.md` — 조건부 (회귀 추적 / 과거 설계 배경 확인 / 명시 요청 / 맥락 부족 시에만). `.claudeignore` 대상이라 필요할 때 명시적으로 Read 한다
4. `docs/*` — 필요 시 선택 로드

## 커맨드
| 동작 | 명령어 |
|------|--------|
| 로컬 실행 | `python3 serve.py 8766` — **`-m http.server` 금지** (SPA 폴백 없어 하위 경로 404 → 라우팅 오판) → `docs/ERRORS.md` E-9. `functions/api/`는 이걸로 안 뜬다(정적 파일 서버라 API가 없다) — 부부 체크의 짧은 코드는 자동으로 링크 폴백으로 넘어간다(의도된 동작) |
| 로컬 실행(백엔드 포함) | `npx wrangler pages dev . --port 8788` — `functions/api/couple-code/`까지 재현하려면 이거여야 한다(KV는 로컬 파일로 자동 대체). `wrangler.jsonc`의 `compatibility_date`가 설치된 wrangler 바이너리보다 앞서 있으면 뜨지 않는다 — 그땐 `--compatibility-date=YYYY-MM-DD`로 낮춰서 로컬 실행만 우회한다(설정 파일 자체는 오늘 날짜로 둔다) |
| 빌드 | **없음** (ES 모듈을 브라우저가 직접 로드) |
| 테스트 | `npm test` (= `node --test`, 의존성 0) — 채점 로직·모듈 정합성 |
| 브라우저 회귀 | `mkdir -p /tmp/pw && cd /tmp/pw && npm i playwright` → `NODE_PATH=/tmp/pw/node_modules node scripts/verify.cjs` (서버 먼저). `VERIFY_BASE=http://localhost:8788`로 wrangler dev를 가리키면 짧은 코드 발급·조회까지 실제로 검증된다 — 안 하면 그 부분만 폴백 경로로 대체 확인된다 |
| 배포 | `main` push → Cloudflare Pages 자동 배포 (Functions·KV 바인딩도 `wrangler.jsonc`에서 같이 배포됨) |

## Claude Code 세션 (`.claude/`)
`.claude/hooks/session-start.sh`는 원격(Claude Code on the web) 세션에서 컨테이너가 새로 뜰 때마다
`/root/.claude`가 초기화되는 걸 메우는 재설치 훅이다. **여기 새 플러그인/마켓플레이스를 추가하기 전에
`claude plugin details <name>`으로 always-on 토큰 비용을 반드시 확인할 것** — 세션마다, 그리고
서브에이전트를 띄울 때마다 매번 다시 주입되는 항목은 여기 넣지 않는다(2026-08-01 제거된 `ponytail`이
세션당 ~983 tok + 서브에이전트마다 재주입되던 사례). 필요한 도구는 텍스트를 매번 컨텍스트에 주입하지
않는 순수 CLI(예: graphify)로만 추가한다.

`.claude/settings.json`의 `env.MAX_THINKING_TOKENS`(1024)는 확장 사고(extended thinking)가
켜지는 경우의 상한선이다(2026-08-01). `alwaysThinkingEnabled`는 **일부러 설정하지 않고
기본값(자동 판단)으로 둔다** — 이 값이 없거나 `true`면 모델이 요청 난이도를 보고 사고 과정을
쓸지 스스로 판단하고, `false`로 박아두면 쉬운 요청까지 사고를 완전히 못 쓰게 막아버려서 오히려
어려운 문제에서 품질이 떨어진다(처음엔 `false`로 뒀다가 "필요한지 아닌지 파악해서 자동 적용"
요청으로 되돌림). 정말 복잡한 문제는 프롬프트에 "ultrathink"를 넣으면 그 턴만 확실히 켤 수 있다.

## 식별자
- 도메인 `https://fun.data-pantry.com` / 저장소 `xoggnseeeww/game-test`
- 호스팅: Cloudflare Pages — 빌드 명령 없음, 출력 디렉터리 = 레포 루트
- SPA 폴백: `_redirects` (`/*  /index.html  200`, 항상 마지막 줄) — 없으면 하위 경로 직접 접속이 404.
  그 위에 페이지별 OG 셸로 보내는 rewrite 규칙 3개가 더 있다(D-47) — `_redirects`는 첫 매치 우선이라
  더 구체적인 규칙이 항상 와일드카드보다 **위**에 있어야 한다. `test/og-shells.test.js`가 순서를 검사한다
- 영속 데이터: 예전엔 기본적으로 없었다(`localStorage["gt_reaction_best"]`로 반응속도 최고기록을
  저장했으나 D-20에서 제거). 지금은 예외가 셋이다.
  **① 부부 체크의 짧은 매칭 코드**(Cloudflare KV, `COUPLE_CODES` 바인딩, 7일 TTL 자동 만료) — 식별자
  없는 익명 점수 덩어리만 저장되고, 만료 외에 수동 삭제 경로는 없다(D-45). 백엔드는 이 기능에만
  있다 — Cloudflare Pages Functions(`functions/api/couple-code/`) + KV, `wrangler.jsonc`로 바인딩.
  이 예외가 생기면서 개인정보처리방침(`/privacy`, 홈 하단 링크)을 신설했다 — 실제로 저장·처리하는
  것만 적는다. 아직 안 하는 걸 미리 적어두면 나중에 그 기능이 생겼을 때 방침이 먼저 거짓말이 된다.
  **② 로그인 이메일·이름**(`localStorage["gt_user_email"]`·`["gt_user_name"]`,
  `js/core/auth.js`) — 일반 방문자 전부에게 열려 있다(D-68). `js/core/cloud-auth.js`가
  data-pantry.com과 같은 Supabase Auth(Google·카카오 OAuth) 세션을 재사용할 뿐, 이 레포
  자체엔 별도 계정 백엔드가 없다. 이름은 Google 계정의 `user_metadata`에서 가져오며
  없으면 이메일로 대체 표시한다(D-71). `isAdmin()`(같은 파일)만 이메일이 `ADMIN_EMAIL`과
  같은지 별도로 판별해 부부 체크 같은 출시 전 도구 게이트(D-56)에 쓴다 — 로그인 자체와
  관리자 판별은 별개다.
  **③ 학습 진행률**(Supabase `learning_progress` 테이블, RLS로 본인 행만 접근, D-68) —
  로그인한 사용자의 `state.learning`을 저장한다. `js/learning/cloud.js`가 로그인 시 병합,
  진행이 바뀔 때마다 업서트. 로그인하지 않았거나 CDN이 막혀 있으면 이 앱의 다른 콘텐츠처럼
  세션 한정으로만 동작한다.
  반응속도 최고기록(`gt_reaction_best`)은 D-20에서 제거됐고 **되살리지 말 것** — D-20의 금지는
  "검사에서 빠름을 성취로 프레이밍"하는 것이지 게임 진행 저장이 아니다.
  시크릿·환경변수 **없음**은 그대로 유지(Supabase anon key는 공개 키라 시크릿이 아니다 — D-56).
  (NumPath 마을·코인·클라우드 동기화는 D-54/D-55로 만들었다가 메리트 부족 판단으로 되돌렸다 —
  게임만 남기고 보상 체계는 나중에 더 큰 그림에서 다시 볼 것. 되돌린 접근이니 다시 제안하지 말 것.
  학습 진행률 동기화는 계정 재사용 패턴만 가져온 것으로, 이 금지 대상이 아니다 — D-68)
- 방문 분석: Cloudflare Web Analytics — `data-pantry.com` 존에 automatic setup으로 이미 등록돼 있고,
  `fun.data-pantry.com`은 같은 존의 서브도메인이라 **코드 변경 없이 자동으로 같이 잡힌다**(2026-07-28 확인).
  **이 레포에 분석 스크립트를 추가하지 말 것** — 페이지당 스니펫은 하나만 허용되는데 이미 상위 존에서
  주입되고 있어서, 여기 또 넣으면 충돌한다. 대시보드는 Cloudflare 계정의 Web Analytics → `data-pantry.com`
  → Manage site에서 경로별로 필터링해서 본다.

## 기술 스택
빌드 없는 정적 SPA. 브라우저 네이티브 ES 모듈(`<script type="module">`), 런타임 의존성 0(npm 설치
기준 — 브라우저가 직접 불러오는 CDN 모듈은 있다). 외부 CDN 의존: 폰트 하나 + 우상단 로그인용
Supabase JS(`js/core/cloud-auth.js`, D-56, D-68부터 일반 방문자에게도 열림). **동적 import로만** 연결돼 있어 CDN이
막혀도 로그인 관련 기능만 빠지고 나머지 앱은 정상 동작한다(`cloud-auth-loader.js` 참고). 라우팅은
History API 직접 구현 + **레지스트리 방식 라우터**. 상태는 메모리 내 단일 `state` 객체(새로고침하면
날아감) — 로그인 이메일만 예외로 `localStorage`에 남는다(위 항목 참고).

## 구조 개요
```
index.html            진입점 (메타·OG·referrer 정책은 기본값 — 아래 3곳 외 전 주소 공통)
og-shells/             테스트·게임 진입 화면 3곳의 정적 OG 셸(og-shells/test-adhd.html 등).
                      _redirects가 해당 경로만 이 파일로 rewrite한다 — index.html과 내용은
                      거의 같고 <title>·og:*만 페이지별이다(D-47)
assets/                favicon(svg) · apple-touch-icon(png) · og-image*.png(1200×630, 홈+테스트/게임별)
js/main.js            부팅: 화면·테스트·게임·학습 콘텐츠를 라우터에 등록 + initHeader()
js/core/              router(레지스트리·guard·teardown·게임 레지스트리) · state · dom · share · util · ads ·
                      cloud-auth(공유 Supabase Auth 클라이언트, D-56 — cloud-auth-loader로만
                      동적 import) · auth(일반 로그인 + isAdmin() 별도 판별, D-68, cloud-auth 재사용,
                      onAuthChange는 구독자 여럿을 받는 Set 기반) · header(우상단 햄버거 메뉴 —
                      로그인 시 점 배지, 마이페이지 이동, D-70)
js/screens/home.js    홈(카테고리 카드 3개: 심리테스트/미니게임/학습) · 심리테스트 목록(등록된
                      테스트에서 자동 생성) · 미니게임 목록(등록된 게임에서 자동 생성) ·
                      학습 목록(등록된 학습 도구에서 자동 생성) · 개인정보처리방침 ·
                      마이페이지(로그인 상태·학습 진행 집계, D-70 — 개별 학습 도구는 import 안 함)
js/tests/<id>/        테스트 1개 = 폴더 1개: data · score · screens · index(디스크립터)
                      현재 adhd(+반응속도 게임), disc(+딜레마 게임),
                      couple(+assemble · match — 문항지 조립과 부부 매칭이 따로 검증돼야 해서 분리).
                      couple은 screens.js(문항 진행·개인 결과)가 다른 테스트 대비 훨씬 커져서
                      screens-match.js(초대·코드 입력·결합 결과)로 한 번 더 쪼갰다 —
                      의존 방향은 screens-match.js → screens.js 한쪽뿐(반대는 없음).
                      두 화면 파일이 같이 쓰는 카드 캔버스는 card.js로 뺐다
js/games/<id>/        테스트에 속하지 않는 독립 미니게임 1개 = 폴더 1개. 현재 numpath
js/learning/<toolId>/ 학습 카테고리 안의 독립 도구 1개 = 폴더 1개(게임과 같은 레지스트리
                      방식, D-60·D-63 — 도구가 여럿이면 학습 목록에 카드로 나열). 도구
                      안은 챕터(목차) 여러 개로 이뤄질 수 있다 — data.js의 CHAPTERS 배열이
                      단일 소스, index.js가 챕터별 화면을 자동 생성한다. 챕터는 잘게 쪼개지
                      않고 묶는다(D-66) — 새 상황이 생기면 새 챕터부터 만들지 말고 기존
                      챕터 중 붙일 자리가 있는지 먼저 본다. 문장 단위 도구 셋(위 civil-vocab은
                      단어 단위라 별개): **basic-conversation**
                      (기초 영어회화, 7세 이하 대상) — 챕터 인사/기분 표현·하루 일과(아침+밥+
                      목욕/잠자리 통합)·가족/자기소개·놀이터에서(놀이+날씨 통합) 4개, 총
                      362문장(기본 122 + 중급 120 + 심화 120, D-74). 각 챕터는 기본(입문
                      생존 표현) → 중급(짧은 질문·요청) → 심화(의견·이유·비교·협상이 들어간
                      원어민 7세 수준 문장, `level: "intermediate"`/`"advanced"`)로 이어지는
                      3단계 구성(D-72, D-73) — 단계별로 대략 30문장씩(D-74), 단계용으로 새
                      챕터를 만들지 않는다. 챕터를 누르면 단계를 고르는 화면이 먼저 뜬다.
                      같은 문장 틀에 단어만 바꿔 반복하는 패턴 드릴("I like ~", "This is
                      my ~")도 섞여 있다(D-67). **elementary-conversation**(초등 영어회화)
                      — basic-conversation의 "듣고 따라 말하기"만으로는 초등학생부터 실력
                      향상에 부족하다고 판단해(D-78) 학년(GRADES) 한 겹을 더 얹고, 문장마다
                      `grammar` 태그로 문법 진행·반복(recycling)을 추적하며, `type: "produce"`
                      문장(정답을 안 읽어주고 질문만 던져 스스로 답하게 함, 예시 답안으로
                      자가평가)과 낮은 점수 문장 재노출("헷갈렸던 문장만 복습하기")을 더했다
                      (D-79: produce엔 시도 전 hint, 연습 카드엔 문법 라벨, 마이페이지엔
                      weak 총합도 노출). 아직 안 만든 학년·챕터는 화면에 미리 노출하지
                      않는다 — 지금은 저학년 챕터 6개(학교 가는 날·교실에서·쉬는 시간·
                      좋아하는 것·체육 시간·급식 시간, 챕터당 20문장, D-80·D-83·D-87),
                      중학년 챕터 6개(수업과 과제·친구 관계·방과 후 생활·우리 동네·
                      학교 행사·건강과 습관, 챕터당 20문장, D-81·D-83·D-87), 고학년 챕터
                      6개(의견 나누기·꿈과 진로·요즘 이슈·여행과 경험·협동과 리더십·
                      미디어와 기술, 챕터당 20문장, D-82·D-83·D-87)까지 있다 —
                      3개 학년·18챕터·360문장. 학년마다 문법 목록
                      (`*_GRAMMAR_POINTS`)이 따로 있어 서로 독립적이고, 개념이 겹쳐도
                      (예: 저학년 G2와 중학년 G7이 둘 다 일반동사 현재형) 각자 새 id로
                      다시 정의한다 — 새 문법 id 번호는 그 학년 안에서가 아니라 지금까지
                      나온 것 중 가장 큰 다음 번호를 전체에서 이어 붙인다(D-83). 문법 항목은
                      `label`(문법 용어 — 저작·문서·테스트용) 외에 **`kidLabel`**(학습자 화면에
                      보이는 아이 말)과 선택적 **`check`**(그 형태를 실제로 썼는지 보는 정규식)를
                      갖는다(D-94). 여기에 **`explain`**(그 문법을 아이 말로 푼 한 줄)이 더 있고, 카드의
                      문법 줄을 펴면 설명과 함께 **이 문장의 어느 부분이 그 문법인지**를
                      check로 찾아 표시한다(D-96 — 이름만 띄우던 게 "어떻게 적용된 건지
                      알 수 없다"는 지적을 받았다). produce 문장은 정답이 여럿이라
                      유사도 채점을 못 하는 대신 check로 "목표 형태를 넣었는지"만 알려준다.
                      형태가 뚜렷하지 않은 항목은 check를 **일부러 비운다**(억지 정규식은
                      맞게 말했는데 틀렸다고 하는 오탐을 만든다). 문법은
                      챕터마다 무조건 새로 늘리지 않는다 — 새 문법 없이 기존 걸 다른
                      소재로 재사용만 하는 챕터도
                      있다(좋아하는 것, 우리 동네, 여행과 경험, 체육 시간, 급식 시간은
                      새 문법 G18을 도입). **dialogue**(대화 연습, D-87) — 오래 미뤄둔
                      진짜 다중 턴 대화를 별도 도구로 신설했다(위 두 도구를 확장하지 않은
                      이유는 `docs/learning-architecture.md` §3-7). 장면(SCENES) 하나 =
                      대화 하나이고, `role: "partner"`(상대 대사, 자동 재생)와
                      `role: "you"`(내 차례, 힌트만 주고 예시 답안으로 자가평가)가 번갈아
                      온다 — 유사도 채점은 안 한다(정답이 여러 개). 자유 발화를 의미로
                      해석해 갈래를 고르는 **분기는 일부러 없다**(브라우저 STT 인식률로는
                      대화가 산으로 가는 실패가 더 잦다) — 한 줄기로 흐르는 역할극에 가깝다.
                      학년·단계 층이 없어 elementary보다 한 단 얕다. 한글을 아직 못
                      읽는 어린이를 위해 한국어 해석도 TTS로 들을 수 있다(뜻 옆 🔊, D-69) —
                      영어/한국어 듣기가 서로 다른 `lang`으로 독립적으로 재생된다. 브라우저
                      내장 TTS/STT만 쓰고 서버 API 없음(STT가 없는 iOS는 녹음-되듣기로 폴백, D-95)(로그인·학습 진행률 동기화는 D-68
                      참고 — 위 "영속 데이터" 항목). 듣기/말하기를 강제하지 않고 건너뛰기
                      버튼도 둔다(D-61). 문장 카드 위 마스코트 일러스트(D-61)는 실물로
                      보니 별로라 D-64에서 뺐다 — 이미지가 필요하면 나중에 실제 이미지
                      에셋으로 따로 넣는다
js/learning/civil-vocab/ 9급 공무원 영단어(D-98) — 어원 중심 어휘 학습. 학습 도구지만 위
                      세 도구와 모델이 다르다: 카드가 문장이 아니라 **단어**이고, 목표가
                      8000단어라 **데이터를 정적으로 안 들고 온다**. manifest.js(스테이지·
                      DAY 메타데이터)만 정적 import이고 words/day-NNN.js(50단어씩)는
                      loader.js의 동적 import로만 불린다 — 정적 import는 테스트가 금지한다.
                      연상은 **어원 우선**(roots.js 어원 사전 + 단어별 한 줄 힌트), 어원이
                      약한 단어만 소리연상을 쓰고 둘 다 없는 단어는 금지(테스트가 잡는다).
                      진행 상태는 state.learning이 아니라 **state.vocab**(세션 한정) —
                      계정별 저장은 단어별 행을 갖는 별도 테이블로 붙일 예정이라 통짜
                      업서트 구조에 섞지 않았다. **resolveReview를 일부러 안 둔다** —
                      어휘 복습은 "오늘 복습"(D-92)에 섞지 않기로 정했다.
                      지금 200단어(DAY 4개) · 어원 156항목 → 목표 8000
js/learning/grammar.js 문법 설명 블록(D-96) — 연습·복습 화면 공용. 도구를 모르는 순수 view
                      함수라 D-70 경계를 안 깬다(문법 항목은 resolveReview가 넘겨준다)
js/learning/record.js STT 없는 브라우저(iOS Safari)의 말하기 폴백(D-95) — MediaRecorder로
                      녹음해 되듣고 자가평가. 6개 호출부 공용, 결과는 STT 경로와 똑같이
                      weak/SRS에 반영된다. iOS에서 말하기가 통째로 죽어 있던 걸 메운 것
js/learning/prefs.js  연습 카드의 "받침대 치우기" 토글(D-93) — 영어 문장 가리기·뜻 접기.
                      강제로 가리지 않고 학습자가 켜고 끈다(D-61과 같은 판단). repeat 카드
                      셋(basic·elementary·복습)만 — produce/대화는 그 텍스트가 질문이라 가리면
                      문제가 성립 안 한다. 세션 한정 메모리(진행률 객체·localStorage 안 씀)
js/learning/srs.js    간격 반복(SRS) 스케줄(D-92) — 순수 함수. `weak`의 값이 이제 불리언이
                      아니라 `{ due, step }`이다(키는 그대로라 기존 읽기 코드는 무변경).
                      틀리면 처음으로, 맞히면 다음 칸, 마지막 칸 넘기면 졸업(목록에서 삭제)
js/learning/review.js "오늘 복습" 화면(`/learning/review`) — 도구별이 아니라 **전 도구를
                      가로질러** 오늘 볼 문장만 모은다. 도구를 import하지 않고
                      `listLearning()`의 `resolveReview(key,id)`로 문장을 되돌려받는다(D-70
                      경계 유지). `registerLearning`은 안 한다 — 도구가 아니라 도구들의 결과를
                      모으는 화면이라 학습 목록에 카드로 뜨면 안 된다
functions/api/couple-code/  부부 체크 짧은 코드 발급(index.js)·조회([code].js). 유일한 백엔드 —
                      Cloudflare Pages Function + KV(COUPLE_CODES). js/tests/couple/shortcode.js를
                      그대로 가져다 쓴다(발급·조회·브라우저 검증이 같은 알파벳을 봐야 한다)
wrangler.jsonc         위 Function의 KV 바인딩 설정. 빌드 명령은 여전히 없다 — 이 파일은 배포
                      산출물이 아니라 Cloudflare Pages가 Functions를 띄울 때만 읽는다
test/                 node --test 스위트 (채점 로직 · 게임 로직 · 모듈 import/export 정합성 · OG 셸 정합성).
                      `og-shells/`와 이름이 비슷하지만 무관 — 여긴 순수 JS 유닛 테스트 폴더다
styles.css            전체 스타일. 브랜드 색은 CSS custom properties + theme-* 클래스
_redirects            Cloudflare Pages SPA 폴백 + 페이지별 OG 셸 rewrite (순서 중요, 위 항목 참고)
serve.py              로컬 개발 서버 — `_redirects`를 실제로 읽어 규칙대로 적용한다(개발 전용, functions/는 못 띄운다)
scripts/verify.cjs     헤드리스 브라우저 회귀 스위트 (레포 의존성 아님 — 파일 헤더 참고)
docs/design-draft.html  최초 디자인 목업. 배포·동작과 무관 (.claudeignore)
```

## 상세 문서
| 문서 | 내용 |
|------|------|
| `docs/architecture.md` | 라우터 계약 · 상태 모양 · 추가 절차 · 채점/공유 개요 (**계약과 절차**만 — 콘텐츠가 늘어도 안 커진다, D-88) |
| `docs/module-map.md` | 모듈맵 — 어떤 파일이 뭘 하는지 (D-88에 architecture.md에서 분리) |
| `docs/screen-map.md` | 화면 표 — 화면 id · 경로 · guard (D-88에 분리) |
| `docs/og-shells.md` | 페이지별 OG 미리보기 셸 (D-88에 분리) |
| `docs/adhd-architecture.md` | ADHD 흐름 · 채점 파이프라인 |
| `docs/disc-architecture.md` | DISC 흐름 · 채점 파이프라인 |
| `docs/couple-architecture.md` | 부부 관계 성향 체크 흐름 · 문항지 조립 · 채점 · 부부 매칭 · 배우자 코드 · 안전 장치 |
| `docs/numpath-architecture.md` | NumPath 흐름 · 게임 로직(타일 모델 · 생성기 · 솔버 · 별 판정) 개요 |
| `docs/vocab-architecture.md` | 9급 공무원 영단어 구조(DAY 파일 동적 로드 · 어원 사전 · 확장 계획 · 아직 안 붙인 SRS/계정 저장) |
| `docs/learning-architecture.md` | 학습 카테고리 구조(도구 → 목차 → 챕터, D-63) · 지금 자른 것(로그인·SRS·결제·어댑터 패턴·어르신 모드)을 나중에 어떻게 붙일지 |
| `docs/ERRORS.md` | 오류 패턴 (같은 증상이 재발할 때) |
| `docs/DECISIONS.md` | 설계 결정 · 기각안 · 되돌림 |

## ⚠️ ABSOLUTE RULES
- **도구 호출 사이에 텍스트를 쓰지 않는다** — 맨 위 "🔇 출력 규칙" 절이 본문. 세 번 반복 위반해서 두 곳에 나눠 적었다(D-89)
- **화면은 디스크립터로만 추가한다** — `{ id, path, title, render, theme?, guard?, dynamicPath? }`를 해당 테스트의 `index.js` 배열에 넣는다.
  라우터가 등록된 것만 안다. **`render()`에 분기를 추가하거나 경로 표를 따로 두지 말 것** — 그러려고 레지스트리로 바꿨다(`docs/DECISIONS.md` D-13).
- **화면을 떠날 때 정리할 것은 `onLeave()`에 등록한다** — 타이머·`requestAnimationFrame`·전역 리스너. 직접 `clearTimeout`으로 관리하지 말 것.
  등록하지 않으면 뒤로가기 후에도 콜백이 살아남아 **다른 화면을 결과 화면으로 밀어버린다** → `docs/ERRORS.md` E-4
- **화면 id를 바꾸지 않는다** — 이미 열려 있는 탭의 `history.state`에 옛 id가 남아 있어, 이름을 바꾸면 배포 직후 뒤로가기가 깨진다. (`test-*`가 ADHD인 것은 이 때문이다)
- **개수는 화면 문구에도 하드코딩 금지** — `${QUESTIONS.length}`, `${TETRADS.length}`, `${CPT_ROUNDS}` 를 쓴다. 주석도 마찬가지.
  확인: `grep -rnE '>[^<{]*[0-9]+(문항|가지|라운드|개)' js/` → **출력이 없어야 함**
- **에러 삼킴 금지** — `.catch(() => {})` 금지, 최소한 `console.error`.
  예외: `localStorage` 접근(프라이버시 모드 throw)과 `runTeardowns()`의 catch는 **의도된 방어**다. 제거하지 말 것.
- **검증은 `npm test` + 실제 브라우저 둘 다** — 빌드가 없어 "빌드 통과"라는 신호가 없다.
  `npm test`는 채점·모듈 정합성만 본다. 라우팅·이벤트·레이아웃은 `scripts/verify.cjs`로만 잡힌다.
  **확인하지 못한 항목은 `CURRENT_TASK.md`의 "배포 후 확인 필요"로 옮긴다** — 침묵은 "확인됨"으로 오독된다.
- **의학적 진단 표현 금지** — "성향 체크"까지만. `disclaimer` 문구를 제거하거나 약화하지 말 것 → `docs/DECISIONS.md` D-3
- **부부 체크의 결과 전달 안전 장치를 빼지 말 것** — 유형 라벨 단독 노출 금지(연속 점수·확신도 동반),
  **단일 궁합 점수 산출 금지**(블록별 구간 서술만), 백분위·석차 표현 금지(규준 표본이 없다),
  격차의 **방향·지목 노출 금지**(크기와 개념명만), 원 척도 유형명·축 명칭 노출 금지(자사 표기 AT/CS만).
  전부 기획서 §2·§6~§9의 요구이고 `npm test`와 `scripts/verify.cjs`가 함께 검사한다 →
  `docs/couple-architecture.md` §8

## 동기화 매트릭스
> `[바꾸는 것] → [반드시 같이 고칠 것]`. 모를 때 필요한 정보라서 자동 로드에 둔다.
> 라우터·목록 카드처럼 **레지스트리가 흡수한 결합은 여기서 뺐다** — 매트릭스를 늘리기 전에 결합을 없앨 수 있는지 먼저 본다.

- 새 테스트 추가 → `js/main.js`에 `registerTest` + `registerScreens` **둘 다**. 하나만 하면 목록 카드나 공유 URL 한쪽이 조용히 빠진다
- 새 독립 미니게임 추가(테스트에 속하지 않는 경우) → `js/main.js`에 `registerGame` + `registerScreens` **둘 다**, `test/modules.test.js`의 화면 목록에도 새 `<id>Screens` 추가. 반응속도·딜레마처럼 테스트 하위 단계인 게임은 여기 해당 안 됨(D-4)
- 새 학습 도구 추가(테스트에 속하지 않는 경우) → `js/main.js`에 `registerLearning` + `registerScreens` **둘 다**, `test/modules.test.js`의 화면 목록에도 새 `<tool>Screens` 추가. 미니게임 레지스트리와 완전히 같은 절차다(D-63). 그 도구의 문장이 **복습(D-92)에도 합류하려면** 디스크립터에 `resolveReview(key, id)`를 넣는다 — 복습 화면(`js/learning/review.js`)은 안 고친다
- 어휘 도구에 단어 추가(DAY 신설) → `js/learning/civil-vocab/words/day-NNN.js` 추가 + `manifest.js`의 `STAGES`에 줄 하나. **화면·라우팅·테스트는 안 고친다**(D-98). 단어 파일을 정적 import하면 안 된다 — `test/learning.vocab.test.js`가 금지하고, 어기면 8000단어가 부팅에 실린다. 매니페스트의 `count`는 실제 파일 길이와 매번 대조되고, 어근은 사전(`roots.js`)에 있어야 하며 아무도 안 쓰는 어근은 남길 수 없다
- 학습 도구 안에 새 챕터(목차 항목) 추가 → 그 도구의 `data.js`(`CHAPTERS` 배열)에 항목만 추가한다. 레지스트리에 새로 등록하지 않는다 — 목차 화면·화면 등록 둘 다 `CHAPTERS`에서 자동 생성된다(D-63). 다만 새 챕터부터 만들지 말고 기존 챕터에 붙일 자리가 있는지 먼저 볼 것(D-66) — 목차가 잘게 쪼개진 목록이 되지 않게 한다
- 결과 유형 추가/삭제 → 같은 `data.js`의 슬러그 맵도 갱신 (없으면 공유 URL이 조용히 홈으로 폴백) — DISC는 `slug` 필드가 단일 소스라 자동
- 문항 수 변경 → 해당 `score.js`의 만점 분모가 문항 수에서 파생되는지 확인 (ADHD `toPct` 분모 `16` = 축당 4문항 × 4점)
- `AXIS_HIGH_THRESHOLD` 변경 → `axisIntensityText()`의 구간 경계(`60`)도 같이 조정
- `CPT_ROUNDS` / `CPT_NOGO_COUNT` 변경 → `gameBonuses()`의 오류율 구간이 여전히 의미 있는지 확인
- 새 `theme` 값 추가 → `js/core/router.js`의 `THEME_CLASSES` 배열 + `styles.css`의 `theme-*` 변수 블록
- 부부 체크의 배우자 코드 필드 추가/순서 변경 → `match.js`의 `VERSION`도 함께 올린다. 자리로만
  읽는 코드라, 순서를 바꾸면 **이미 공유된 링크가 조용히 다른 값으로 해석된다**
- 부부 체크 문항 추가/삭제 → 문장이 부부 양쪽에 동일한 문항만 `computeCouple()`의 `comparable`
  ·`anchors`에 넣는다. 역할별로 문장이 갈리는 문항(R1~R4)이 들어가면 서로 다른 문장의 점수를 빼게 된다
- 부부 체크 앵커 문항 수 변경 → `assemble.js`의 `ANCHOR_ZONE_START`/`ANCHOR_STRIDE`가 문항지
  끝을 넘지 않는지 확인한다(6개×3칸이 34번에서 시작해 정확히 49번에 끝난다). 넘으면 조립이
  조용히 앞으로 밀린다
- 부부 체크 KV에 담는 값(짧은 코드 → 배우자 코드 문자열)의 형식·바인딩 이름 변경 →
  `functions/api/couple-code/index.js`·`[code].js`·`wrangler.jsonc` 셋 다 같이 고친다.
  바인딩 이름(`COUPLE_CODES`)은 세 곳 모두 문자 그대로 일치해야 한다 — 하나만 바꾸면
  로컬(`wrangler pages dev`)에서만 조용히 깨진다(배포본은 대시보드 바인딩이 남아있어 더 늦게 발견됨)
- 다른 테스트/게임도 출시 전 관리자 전용으로 두려면 → `js/tests/couple/index.js`의
  `comingSoonGuard()` 패턴을 그대로 복사해 모든 화면 `guard`에 씌우고, `card.comingSoon = true`
  추가(D-56). 관리자 이메일은 `js/core/auth.js`의 `ADMIN_EMAIL` 하나뿐이라 공용 유틸리티로
  뽑지 않았다 — 두 번째로 필요해지면 그때 뽑는다
- `js/core/cloud-auth.js`의 Supabase 프로젝트·anon key 변경 → 관리자 로그인(`js/core/auth.js`)이
  이 클라이언트를 쓰므로 함께 영향받는다. `scripts/verify.cjs`로 재확인할 것
- 구조 변경(모듈 추가·이동·삭제) → **같은 커밋에** `docs/module-map.md`(D-88에 architecture.md에서 분리)와 위 구조 개요 트리 갱신. 새 **화면**을 추가했으면 `docs/screen-map.md`도
- `styles.css` 클래스명 변경 → 템플릿 문자열은 타입 체크가 없다. `grep -rn '<클래스명>' js/ styles.css`로 양쪽 확인
- 새 테스트/게임에 OG 미리보기 추가 → `og-shells/<이름>.html` 작성 + `_redirects`에 규칙 추가(**와일드카드 위**) + `assets/og-<이름>.png` + `test/og-shells.test.js`의 `SHELLS` 배열에 항목 추가. 카드(`card.name`/`card.desc`) 문구 변경 시 셸의 `<title>`·`og:title`·`og:description`도 같이 고친다 — 자동 반영 안 됨(D-47), `og-shells.test.js`가 불일치를 잡아준다
- `assets/og-*.png` **내용**을 고칠 때 → **파일명도 반드시 같이 바꾼다**(예: `-v2`, `-v3`). URL이 그대로면 카카오·CDN·브라우저의 이미지 캐시가 옛 파일을 계속 서빙한다 — 제목·설명은 갱신되는데 이미지만 안 바뀌는 증상으로 나타나 원인 추적이 어렵다. 파일명을 바꾸면 셸의 `og:image`/`twitter:image`와 `test/og-shells.test.js`의 `SHELLS` 배열도 같이 갱신

## 절대 수정 금지
`.git/` · `node_modules/` · `docs/design-draft.html`
