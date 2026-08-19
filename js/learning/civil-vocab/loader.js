// 단어 데이터 로더 — words/day-*.js를 **동적 import**로 필요할 때만 가져온다.
//
// 왜 동적인가: 목표가 8000단어(약 160개 파일)라, 정적 import로 묶으면 학습 목록에 들어오기만
// 해도 전부 내려받게 된다. 화면이 실제로 여는 DAY만 받으면 첫 로딩은 DAY 하나(수십 KB)다.
// 번들러가 없으므로 브라우저의 네이티브 `import()`가 그대로 네트워크 요청이 된다.
//
// **파일 이름은 매니페스트에 있는 것만 허용한다** — id를 그대로 경로에 붙이는 함수라,
// 검증 없이 두면 화면/주소에서 흘러들어온 임의의 문자열이 경로가 된다.
import { findDay } from "./manifest.js";

const cache = new Map();

// 단어 id(v001-07)에서 그 단어가 사는 DAY를 계산한다. 별도의 "id → DAY" 색인을 두지 않는
// 이유: 8000개짜리 색인은 그 자체로 정적 로드 대상이 돼서 동적 import의 의미가 사라진다.
export function dayIdOf(wordId) {
  const m = /^v(\d{3})-\d{2}$/.exec(String(wordId));
  return m ? `day-${m[1]}` : null;
}

export function isLoaded(dayId) {
  return cache.has(dayId);
}

// 이미 받은 DAY는 캐시에서 그대로 준다(같은 DAY를 다시 열 때 네트워크를 안 탄다).
export async function loadDay(dayId) {
  if (cache.has(dayId)) return cache.get(dayId);
  if (!findDay(dayId)) throw new Error(`매니페스트에 없는 DAY: ${dayId}`);
  const mod = await import(`./words/${dayId}.js`);
  cache.set(dayId, mod.WORDS);
  return mod.WORDS;
}
