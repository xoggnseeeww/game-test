// 카카오 AdFit 광고 단위. 단위 코드는 여기 한 곳에서만 관리한다.
const AD_UNITS = {
  banner: { unit: "DAN-YtXY1keVu0glLXJQ", width: 320, height: 50 },
  rect: { unit: "DAN-PKr3oCfRI9IIiXwz", width: 250, height: 250 },
};

const LOADER_SRC = "//t1.daumcdn.net/kas/static/ba.min.js";

export function adSlotMarkup(kind, style = "") {
  const { unit, width, height } = AD_UNITS[kind];
  const styleAttr = style ? ` style="${style}"` : "";
  return `<div class="ad-slot ${kind}"${styleAttr}><ins class="kakao_ad_area" style="display:none;" data-ad-unit="${unit}" data-ad-width="${width}" data-ad-height="${height}"></ins></div>`;
}

// AdFit 로더는 "자기가 실행되는 순간 문서에 있던" <ins>만 훑고 끝난다. 이 앱은 화면을 바꿀 때마다
// app.innerHTML을 통째로 갈아끼우는 SPA라, index.html에 로더를 한 번 심어두는 방식으로는
// 광고가 절대 안 붙는다 — 로더(async)가 빈 #app을 훑고 끝나거나, 운 좋게 첫 화면을 잡더라도
// 그 다음 화면 이동에서 새로 생긴 <ins>는 아무도 처리하지 않는다.
// 그래서 화면을 그린 뒤, 아직 로더가 붙지 않은 슬롯마다 로더를 새로 하나씩 붙인다.
//
// innerHTML로 넣은 <script>는 브라우저가 실행하지 않는다. adSlotMarkup 문자열에 로더를
// 끼워 넣는 방식이 통하지 않는 이유이고, 여기서 DOM API로 만들어 붙이는 이유다.
export function mountAds(root) {
  if (!root) return;
  for (const ins of root.querySelectorAll("ins.kakao_ad_area:not([data-adfit-mounted])")) {
    ins.dataset.adfitMounted = "1";
    const script = document.createElement("script");
    script.type = "text/javascript";
    script.async = true;
    script.src = LOADER_SRC;
    script.onerror = () => {
      console.error(`AdFit 로더를 불러오지 못했습니다 (단위 ${ins.dataset.adUnit})`);
    };
    // AdFit은 로더 바로 앞의 <ins>를 자기 슬롯으로 본다. body 끝에 몰아넣으면 안 된다.
    ins.insertAdjacentElement("afterend", script);
  }
}
