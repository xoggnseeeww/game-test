// 짧은 코드 발급·조회. score.js·match.js와 달리 네트워크를 쓰므로 순수 함수가 아니다 —
// 그래서 별도 모듈로 뺐다. 이 모듈이 통째로 죽어도(오프라인, 로컬 개발, KV 한도 초과)
// match.js의 25자 링크가 그대로 동작해야 하므로, 실패는 전부 null로 눌러서 돌려주고
// 화면 쪽이 폴백(링크 그대로 쓰기)을 결정하게 한다. 그래서 여기의 catch는 "삼키는" 게
// 아니다 — console.error로 남기고, 호출부가 실제로 처리할 값(null)을 돌려준다.
import { state } from "../../core/state.js";

const ISSUE_PATH = "/api/couple-code";

export async function issueShortCode(partnerCode) {
  try {
    const res = await fetch(ISSUE_PATH, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ p: partnerCode }),
    });
    if (!res.ok) {
      console.error("짧은 코드 발급 실패", res.status);
      return null;
    }
    const data = await res.json();
    return typeof data.code === "string" ? data.code : null;
  } catch (err) {
    console.error("짧은 코드 발급 요청 실패", err);
    return null;
  }
}

export async function resolveShortCode(shortCode) {
  try {
    const res = await fetch(`${ISSUE_PATH}/${encodeURIComponent(shortCode)}`);
    if (!res.ok) return null;
    const data = await res.json();
    return typeof data.p === "string" ? data.p : null;
  } catch (err) {
    console.error("짧은 코드 조회 요청 실패", err);
    return null;
  }
}

// 짧은 코드는 결과 화면(자동 노출)과 초대 화면(전체 링크·코드 카드) 두 곳에서 필요하다.
// 캐시를 안 보고 각자 issueShortCode()를 부르면 같은 결과로 코드를 두 번 발급해 KV 쓰기
// 한도(하루 1,000회)를 낭비한다 — 여기서 한 번만 캐시를 확인하고 필요할 때만 실제로 발급한다.
export async function ensureShortCode(partnerCode) {
  const cached = state.couple.shortCode;
  if (cached && cached.for === partnerCode) return cached.code;
  const code = await issueShortCode(partnerCode);
  if (code) state.couple.shortCode = { code, for: partnerCode };
  return code;
}
