// 짧은 코드 발급·조회. score.js·match.js와 달리 네트워크를 쓰므로 순수 함수가 아니다 —
// 그래서 별도 모듈로 뺐다. 이 모듈이 통째로 죽어도(오프라인, 로컬 개발, KV 한도 초과)
// match.js의 25자 링크가 그대로 동작해야 하므로, 실패는 전부 null로 눌러서 돌려주고
// 화면 쪽이 폴백(링크 그대로 쓰기)을 결정하게 한다. 그래서 여기의 catch는 "삼키는" 게
// 아니다 — console.error로 남기고, 호출부가 실제로 처리할 값(null)을 돌려준다.
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
