// 화면 하나를 추가하려면 예전엔 ROUTES · SCREEN_TO_PATH · SCREEN_TITLES ·
// render() 스위치 · resolveScreen()의 if문까지 다섯 군데를 고쳐야 했다.
// 테스트가 둘로 늘면 그만큼 빠뜨리기 쉬워서, 화면 정의를 한 곳에 등록하는 방식으로 바꿨다.
//
// 화면 정의: { id, path, title, render, theme?, guard?, dynamicPath? }
//  - guard()       : 지금 이 화면을 띄우면 안 되는 상태일 때 대신 갈 화면 id를 반환 (없으면 falsy)
//  - dynamicPath   : 주소가 화면마다 하나로 안 정해지는 화면(공유 결과처럼 슬러그가 붙는 경우)
import { normalizePath } from "./util.js";
import { state } from "./state.js";
import { refreshAds, refreshAdSense } from "./ads.js";

// 브라우저 밖(node --test)에서도 화면 디스크립터만 읽어볼 수 있게, 모듈을 불러오는
// 것만으로 document를 건드리지 않는다. 실제 렌더는 브라우저에서만 일어난다.
export const app = typeof document !== "undefined" ? document.getElementById("app") : null;

const screens = new Map();
const tests = new Map();
const games = new Map();
let pathIndex = null;

export function registerScreens(defs) {
  for (const def of defs) {
    if (screens.has(def.id)) throw new Error(`중복된 화면 id: ${def.id}`);
    screens.set(def.id, def);
  }
  pathIndex = null;
}

// 심리테스트 하나의 메타데이터: { id, slugToKey, sharedScreen, card }
export function registerTest(descriptor) {
  tests.set(descriptor.id, descriptor);
}

export function listTests() {
  return [...tests.values()];
}

// 독립 미니게임 하나의 메타데이터: { id, card }. 테스트와 달리 결과가 점수에 반영되는
// 하위 단계가 아니라 그 자체로 콘텐츠라 slugToKey/sharedScreen이 없다 — 공유는 게임
// 주소 자체로 한다(딜레마·반응속도 게임처럼 테스트 하위에 있는 것과는 다른 성격).
export function registerGame(descriptor) {
  games.set(descriptor.id, descriptor);
}

export function listGames() {
  return [...games.values()];
}

// 예전 SCREEN_TO_PATH는 ROUTES를 그냥 뒤집는 방식이라, 두 주소가 같은 화면을 가리키면
// 뒤에 온 쪽이 조용히 이겼다. 테스트가 둘이 되면 실수하기 딱 좋은 지점이라 소리 나게 바꿨다.
function paths() {
  if (pathIndex) return pathIndex;
  pathIndex = new Map();
  for (const def of screens.values()) {
    if (!def.path) continue;
    if (pathIndex.has(def.path)) throw new Error(`중복된 경로: ${def.path}`);
    pathIndex.set(def.path, def.id);
  }
  return pathIndex;
}

// 공유 결과 주소(/test/adhd/result/owl, /test/disc/result/lion ...)를 테스트 id와
// 결과 키로 푼다. 슬러그가 없는 /test/adhd/result는 여기 안 걸리고 일반 경로로 처리된다.
const SHARED_RE = /^\/test\/([a-z][a-z0-9-]*)\/result\/([a-z0-9-]+)$/;

export function parseSharedPath(pathname) {
  const m = SHARED_RE.exec(normalizePath(pathname));
  if (!m) return null;
  const test = tests.get(m[1]);
  const key = test && test.slugToKey[m[2]];
  return key ? { testId: m[1], slug: m[2], key, screen: test.sharedScreen } : null;
}

export function pathToScreen(pathname) {
  const norm = normalizePath(pathname);
  const direct = paths().get(norm);
  if (direct) return direct;
  const shared = parseSharedPath(norm);
  return shared ? shared.screen : "home";
}

// 화면을 떠날 때 정리해야 하는 것들(게임 타이머, 애니메이션 프레임)을 등록해둔다.
// 예전엔 setScreen이 반응속도 게임의 타이머 하나를 직접 clearTimeout 했는데,
// requestAnimationFrame 콜백은 그걸로 못 막아서 게임 도중 뒤로가기를 하면
// 이미 예약된 콜백이 살아남아 다른 화면을 결과 화면으로 밀어버리는 버그가 있었다.
let teardowns = [];

export function onLeave(fn) {
  teardowns.push(fn);
}

// 진행 중인 화면(문항·게임 풀이 등)이 "지금 나가면 답이 사라진다"는 걸 알릴 때 등록한다.
// 전역 햄버거 메뉴의 "홈으로 가기"(core/dom.js의 goHome())가 이걸 보고 확인 모달을 거칠지
// 정한다. onLeave()와 같은 생명주기로 매 화면 전환마다 자동으로 비워진다 — 화면이 직접
// null로 되돌릴 필요가 없다.
let exitGuard = null;

export function setExitGuard(onExit) {
  exitGuard = onExit;
}

export function getExitGuard() {
  return exitGuard;
}

function runTeardowns() {
  exitGuard = null;
  const fns = teardowns;
  teardowns = [];
  for (const fn of fns) {
    try {
      fn();
    } catch {
      // 정리 과정에서 터져도 화면 전환은 계속돼야 한다
    }
  }
}

function render() {
  app.innerHTML = "";
  screens.get(state.screen).render();
  if (app.querySelector(".kakao_ad_area")) refreshAds();
  if (app.querySelector("ins.adsbygoogle")) refreshAdSense();
}

// 뒤로/앞으로가기로 URL만 바뀌었을 때 화면-상태 불일치를 막기 위한 보정.
// 각 화면이 자기 guard를 들고 있고, guard가 대체 화면을 돌려주면 거기서 다시 검사한다.
function resolveScreen(screen) {
  for (let hop = 0; hop < 5; hop++) {
    const def = screens.get(screen);
    // 배포 전에 열어둔 탭의 history.state에는 지금은 없는 화면 이름이 남아있을 수 있다.
    // 예전 코드는 render()의 switch가 그냥 빠져나가서 빈 화면이 됐다.
    if (!def) return pathToScreen(location.pathname);
    const fallback = def.guard && def.guard();
    if (!fallback || fallback === screen) return screen;
    screen = fallback;
  }
  return "home";
}

const THEME_CLASSES = ["theme-adhd", "theme-game", "theme-disc", "theme-couple"];

export function setScreen(screen, { push = false, replace = false } = {}) {
  runTeardowns();
  const resolved = resolveScreen(screen);
  const def = screens.get(resolved);
  state.screen = resolved;

  // 모달은 #app 밖(document.body)에 붙기 때문에 테마 클래스도 body에 있어야
  // 모달 버튼 색까지 같이 따라온다.
  document.body.classList.remove(...THEME_CLASSES);
  if (def.theme) document.body.classList.add(`theme-${def.theme}`);

  render();
  window.scrollTo(0, 0);
  document.title = def.title;

  // 공유 결과 화면은 슬러그마다 주소가 달라서 "화면 하나 = 주소 하나" 가정이 깨진다.
  // 이미 맞는 주소로 들어온 것이므로 건드리지 않고, popstate가 화면 정보를 들고
  // 있도록 history.state만 채워둔다.
  if (def.dynamicPath) {
    if (replace && !history.state) {
      history.replaceState({ screen: resolved }, "", location.pathname + location.search);
    }
    return;
  }

  const path = def.path + location.search;
  if (push && normalizePath(location.pathname) !== def.path) {
    history.pushState({ screen: resolved }, "", path);
  } else if (replace && (normalizePath(location.pathname) !== def.path || !history.state)) {
    history.replaceState({ screen: resolved }, "", path);
  }
}

export function go(screen) {
  setScreen(screen, { push: true });
}

export function start() {
  window.addEventListener("popstate", (e) => {
    const screen = (e.state && e.state.screen) || pathToScreen(location.pathname);
    setScreen(screen, { replace: true });
  });
  setScreen(pathToScreen(location.pathname), { replace: true });
}
