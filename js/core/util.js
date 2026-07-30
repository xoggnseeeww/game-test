// 특정 화면에 묶이지 않는 잡동사니 헬퍼.

export function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// 앱 문구는 전부 우리가 직접 쓴 리터럴이라 여태 이스케이프가 필요 없었다. NumPath 클라우드
// 로그인(D-35)이 처음으로 외부(OAuth 제공자) 표시 이름을 템플릿 문자열 안에 그대로 꽂는
// 사례라, XSS를 막으려면 이걸 거쳐야 한다.
export function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

export function normalizePath(pathname) {
  if (pathname.length > 1 && pathname.endsWith("/")) pathname = pathname.slice(0, -1);
  return pathname || "/";
}

export function roundRect(ctx, x, y, w, h, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}
