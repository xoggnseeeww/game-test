// 짧은 코드로 부부 코드(25자)를 조회한다. 한 번 읽었다고 지우지 않는다 — 오타로 여러 번
// 시도하거나, 결합 결과를 나중에 다시 열어보는 정상적인 사용을 막으면 안 된다. TTL(7일)
// 하나로만 만료를 관리한다.
//
// 8자 공간(32^8 ≈ 1.1조)이라 별도 요청 제한 없이도 무차별 대입은 비현실적이다 — 초당
// 1,000회로 긁어도 다 훑는 데 30년 넘게 걸린다.
import { isShortCode, normalizeShortCode } from "../../../js/tests/couple/shortcode.js";

export async function onRequestGet({ params, env }) {
  const raw = params.code;
  if (!isShortCode(raw)) return json({ error: "invalid_code" }, 400);

  const code = normalizeShortCode(raw);
  const p = await env.COUPLE_CODES.get(code);
  if (!p) return json({ error: "not_found" }, 404);
  return json({ p });
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });
}
