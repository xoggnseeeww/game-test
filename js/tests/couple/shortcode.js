// 8자 짧은 코드 — 부부 코드(match.js의 encodePartner() 출력, 25자)를 KV에 담고 뺄 때 쓰는
// 키를 만든다. 발급은 functions/api/couple-code/, 조회는 그 옆의 [code].js가 하고, 이 모듈은
// 그 둘과 브라우저 쪽 입력 검증이 공유하는 순수 함수만 둔다 — 알파벳이 한쪽만 바뀌면
// 발급된 코드를 조회 쪽이 못 알아보게 된다.
//
// Crockford Base32(대문자, I·L·O·U 제외)를 쓴다. 손으로 옮겨 적을 때 1/I/L, 0/O가
// 헷갈리는 걸 알파벳에서 아예 빼서 막는다 — 25자 base36 코드에서 실제로 겪었던 문제다.
const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"; // 32자
export const SHORT_CODE_LENGTH = 8;

// randomBytes: length 8 이상의 Uint8Array(crypto.getRandomValues() 출처). 256 % 32 === 0이라
// 바이트를 32로 나눈 나머지가 치우치지 않는다 — 32로 안 떨어지는 수로 나누면 앞쪽 값이 더 잘 나온다.
export function randomShortCode(randomBytes) {
  let code = "";
  for (let i = 0; i < SHORT_CODE_LENGTH; i++) {
    code += ALPHABET[randomBytes[i] % ALPHABET.length];
  }
  return code;
}

// 대소문자·구간 표시용 대시(K7M2-QX8P)를 다 받아들이고 비교 가능한 형태로 되돌린다.
export function normalizeShortCode(input) {
  return String(input).trim().toUpperCase().replace(/[\s-]/g, "");
}

export function isShortCode(input) {
  const normalized = normalizeShortCode(input);
  if (normalized.length !== SHORT_CODE_LENGTH) return false;
  for (const ch of normalized) {
    if (!ALPHABET.includes(ch)) return false;
  }
  return true;
}

// 화면에 보여줄 때만 4+4로 끊는다 — 저장·조회 시에는 항상 normalizeShortCode()를 거친다.
export function formatShortCode(input) {
  const normalized = normalizeShortCode(input);
  if (normalized.length !== SHORT_CODE_LENGTH) return normalized;
  return `${normalized.slice(0, 4)}-${normalized.slice(4)}`;
}
