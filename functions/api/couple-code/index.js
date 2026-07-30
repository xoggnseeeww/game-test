// 부부 코드(match.js의 encodePartner() 출력, 25자)를 KV에 넣고 8자 짧은 코드를 발급한다.
//
// 이 파일은 Cloudflare Pages Function이라 브라우저에서 직접 안 돌고, 로컬에서 재현하려면
// `wrangler pages dev`가 필요하다 — `serve.py`는 정적 파일만 서빙해서 이 경로가 없으면
// index.html로 폴백하거나(GET) 501을 준다(POST, SimpleHTTPRequestHandler가 POST를 모른다).
// 둘 다 js/tests/couple/remote.js 쪽에서 실패로 처리돼 25자 링크 폴백으로 넘어가므로
// 로컬에서 이 경로가 없어도 나머지 기능은 정상 동작한다.
import { randomShortCode } from "../../../js/tests/couple/shortcode.js";
import { decodePartner } from "../../../js/tests/couple/match.js";

const TTL_SECONDS = 60 * 60 * 24 * 7; // 7일 — 기획서 §9.2
const MAX_ISSUE_ATTEMPTS = 5;

export async function onRequestPost({ request, env }) {
  let body;
  try {
    body = await request.json();
  } catch (err) {
    console.error("couple-code 발급: 잘못된 JSON", err);
    return json({ error: "invalid_json" }, 400);
  }

  const p = typeof body?.p === "string" ? body.p.trim() : "";
  // 형식을 여기서 새로 정의하지 않는다 — decodePartner()가 이미 진짜 검증이고, 규칙을
  // 여기 따로 베끼면 둘이 갈라질 여지가 생긴다. 대신 그 함수를 그대로 가져다 쓴다: 진짜
  // 유효한 부부 코드가 아니면(체크섬 불일치·길이 다름 등) 애초에 KV에 넣지 않는다.
  // 인증이 없는 공개 엔드포인트라서, 이게 없으면 누구나 아무 문자열이나 계속 보내
  // 하루 KV 쓰기 한도(1,000회)를 실제 사용자보다 먼저 채울 수 있었다.
  if (!decodePartner(p)) {
    return json({ error: "invalid_payload" }, 400);
  }

  for (let attempt = 0; attempt < MAX_ISSUE_ATTEMPTS; attempt++) {
    const code = randomShortCode(crypto.getRandomValues(new Uint8Array(8)));
    // 8자 공간(32^8 ≈ 1.1조)에서 충돌은 실질적으로 안 일어나지만, KV에 원자적 조건부
    // 쓰기가 없어서(get 없이 그냥 put하면 남의 코드를 조용히 덮어쓴다) 확인은 해둔다.
    const existing = await env.COUPLE_CODES.get(code);
    if (existing) continue;
    await env.COUPLE_CODES.put(code, p, { expirationTtl: TTL_SECONDS });
    return json({ code, expiresInSeconds: TTL_SECONDS });
  }
  console.error("couple-code 발급: 충돌 재시도 소진");
  return json({ error: "issue_failed" }, 503);
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });
}
