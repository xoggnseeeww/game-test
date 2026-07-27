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
