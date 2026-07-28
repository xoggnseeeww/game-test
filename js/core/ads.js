// 카카오 AdFit 광고 단위. 단위 코드는 여기 한 곳에서만 관리한다.
const AD_UNITS = {
  banner: { unit: "DAN-YtXY1keVu0glLXJQ", width: 320, height: 50 },
  rect: { unit: "DAN-PKr3oCfRI9IIiXwz", width: 250, height: 250 },
};

export function adSlotMarkup(kind, style = "") {
  const { unit, width, height } = AD_UNITS[kind];
  const styleAttr = style ? ` style="${style}"` : "";
  return `<div class="ad-slot ${kind}"${styleAttr}><ins class="kakao_ad_area" style="display:none;" data-ad-unit="${unit}" data-ad-width="${width}" data-ad-height="${height}"></ins></div>`;
}

// ba.min.js는 로드되는 시점에 DOM에 있는 .kakao_ad_area만 스캔한다. 이 앱은 SPA라
// 화면 전환마다 광고 슬롯을 새로 그리는데, 최초 로드 이후에 생기는 슬롯은 스크립트가
// 다시 스캔해주지 않아 광고가 비어 있는 채로 남는다(뜨다가 말다가 하는 원인).
// 스크립트 태그를 새로 갈아끼워 재실행시키면 그 시점의 DOM을 다시 스캔한다.
export function refreshAds() {
  const prev = document.querySelector('script[src*="ba.min.js"]');
  if (!prev) return;
  const next = document.createElement("script");
  next.src = prev.src;
  next.async = true;
  prev.replaceWith(next);
}
