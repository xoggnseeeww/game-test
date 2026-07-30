// 부부 코드(match.js의 encodePartner() 출력, 25자)를 KV에 넣고 8자 짧은 코드를 발급한다.
//
// 이 파일은 Cloudflare Pages Function이라 브라우저에서 직접 안 돌고, 로컬에서 재현하려면
// `wrangler pages dev`가 필요하다 — `serve.py`는 정적 파일만 서빙해서 이 경로가 없으면
// index.html로 폴백하거나(GET) 501을 준다(POST, SimpleHTTPRequestHandler가 POST를 모른다).
// 둘 다 js/tests/couple/remote.js 쪽에서 실패로 처리돼 25자 링크 폴백으로 넘어가므로
// 로컬에서 이 경로가 없어도 나머지 기능은 정상 동작한다.
import { randomShortCode } from "../../../js/tests/couple/shortcode.js";

const TTL_SECONDS = 60 * 60 * 24 * 7; // 7일 — 기획서 §9.2
const MAX_ISSUE_ATTEMPTS = 5;
// 형식 검증은 여기서 하지 않는다 — decodePartner()가 이미 진짜 검증이고, 여기서 또 하면
// 두 검증이 갈라질 여지가 생긴다. 다만 아무 문자열이나 무한정 채워지는 것만 막는다.
const MIN_LEN = 10;
const MAX_LEN = 64;

export async function onRequestPost({ request, env }) {
  let body;
  try {
    body = await request.json();
  } catch (err) {
    console.error("couple-code 발급: 잘못된 JSON", err);
    return json({ error: "invalid_json" }, 400);
  }

  const p = typeof body?.p === "string" ? body.p.trim() : "";
  if (p.length < MIN_LEN || p.length > MAX_LEN) {
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
