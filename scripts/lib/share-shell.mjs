// 결과 공유 페이지(정적 셸)의 <head> 메타를 index.html 템플릿에서 갈아끼우는 순수 함수.
//
// 왜 필요한가: 이 사이트는 빌드도 서버도 없는 정적 SPA라 og:title/og:description이
// index.html 하나에만 있다(index.html 자체의 주석 참고). 카카오톡·트위터 같은 링크
// 미리보기 크롤러는 JS를 실행하지 않고 <head>만 읽으므로, 결과별로 다른 미리보기를
// 보여주려면 결과 주소마다 다른 <head>를 가진 정적 파일이 실제로 있어야 한다.
// <body>는 index.html과 완전히 동일하게 둔다 — 그래야 JS가 뜨면 평소와 같은 SPA가
// 부팅되고, 그 안의 parseSharedPath()가 슬러그를 읽어 실제 결과 화면을 그린다.
// (JS를 실행하는 실사용자와 크롤러 둘 다에게 맞는 내용을 보여주는 방법이다.)
//
// scripts/generate-share-shells.mjs가 이 파일을 실행 스크립트로 쓰고,
// test/share-shells.test.js가 같은 함수로 "커밋된 파일 = 지금 다시 만들면 나올 내용"을
// 검사한다. 로직을 한 곳에만 두는 이유는 D-24와 같다 — 두 곳에 손으로 맞추면 반드시 어긋난다.

export const SITE_ORIGIN = "https://fun.data-pantry.com";

function escapeHtml(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// index.html의 정확한 문구를 찾아 바꾼다. 못 찾으면 조용히 넘어가지 않고 바로 던진다 —
// index.html의 메타 태그 문구가 바뀌면 이 함수도 같이 고쳐야 하는데, 조용히 넘어가면
// "바뀐 줄 알았는데 실제로는 그대로인 셸"이 배포된다.
function replaceOnce(html, needle, replacement, label) {
  if (!html.includes(needle)) {
    throw new Error(`share-shell: index.html에서 "${label}" 문구를 못 찾았다 — 템플릿이 바뀌었으면 이 함수도 같이 고쳐야 한다.`);
  }
  return html.replace(needle, replacement);
}

export function buildShareShell(indexHtml, { title, description, url }) {
  const safeTitle = escapeHtml(title);
  const safeDesc = escapeHtml(description);

  let html = indexHtml;
  html = replaceOnce(html, "<title>과몰입구역</title>", `<title>${safeTitle}</title>`, "<title>");
  html = replaceOnce(
    html,
    '<meta name="description" content="DISC 행동유형 검사, 성인 ADHD 성향 체크, 반응속도 게임. 나는 어떤 유형일까?">',
    `<meta name="description" content="${safeDesc}">`,
    "meta description"
  );
  html = replaceOnce(
    html,
    '<meta property="og:title" content="과몰입구역 - 심리테스트 · 미니게임">',
    `<meta property="og:title" content="${safeTitle}">`,
    "og:title"
  );
  html = replaceOnce(
    html,
    '<meta property="og:description" content="DISC 행동유형 검사부터 반응속도 게임까지. 나는 어떤 유형일까?">',
    `<meta property="og:description" content="${safeDesc}">`,
    "og:description"
  );
  html = replaceOnce(
    html,
    '<meta property="og:url" content="https://fun.data-pantry.com/">',
    `<meta property="og:url" content="${url}">\n<link rel="canonical" href="${url}">`,
    "og:url"
  );
  return html;
}

// 유형 데이터(name·subtitle·tags)만으로 문구를 만든다. desc/tip 같은 자유 서술 문장을
// 잘라 쓰지 않는다 — 그 문장은 브랜드 보이스로 계속 다시 쓰이는데, 여기서 문자열을
// 잘라 쓰면 desc가 바뀔 때마다 미리보기 문구가 이상하게 끊길 위험이 생긴다.
export function adhdEntry(type, slug) {
  const title = `${type.name}(${type.subtitle}) - 과몰입구역`;
  const description = `성인 ADHD 성향 체크 결과: ${type.name}(${type.subtitle}). ${type.tags.join(" ")} — 나는 어떤 유형일까?`;
  return { testId: "adhd", slug, title, description, url: `${SITE_ORIGIN}/test/adhd/result/${slug}` };
}

export function discEntry(type) {
  const title = `${type.name}(${type.subtitle}) - 과몰입구역`;
  const description = `DISC 행동유형 검사 결과: ${type.name}(${type.subtitle}). ${type.tags.join(" ")} — 나는 어떤 유형일까?`;
  return { testId: "disc", slug: type.slug, title, description, url: `${SITE_ORIGIN}/test/disc/result/${type.slug}` };
}

// _redirects: 명시적 규칙을 마지막 catch-all(/* → index.html) 앞에 둔다.
// Cloudflare Pages는 정적 파일 우선 → _redirects 순서로 매칭하므로 이 규칙들이
// share/<test>/<slug>.html을 원래 주소(/test/<test>/result/<slug>) 그대로 보여준다.
// 목록은 항상 슬러그 알파벳 순으로 정렬해서, entries 순서가 바뀌어도 diff가 안 흔들린다.
export function buildRedirects(entries) {
  const lines = entries
    .map((e) => `/test/${e.testId}/result/${e.slug}  /share/${e.testId}/${e.slug}.html  200`)
    .sort();
  return [...lines, "/*    /index.html   200", ""].join("\n");
}
