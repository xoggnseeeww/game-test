// Google AdSense 광고 단위. 단위 코드는 여기 한 곳에서만 관리한다.
// (임시) AdFit ↔ AdSense 수익 비교용 교체 — 기존 4개 지면(위치·크기)은 그대로 두고
// 네트워크만 갈아끼웠다. adSlotMarkup()/adGateMarkup() 호출부(각 화면)는 손대지 않는다.
//
// data-ad-slot 값은 AdSense에서 같은 크기(320x50/250x250/300x250)로 만든 디스플레이
// 광고 단위의 실제 슬롯 ID로 교체해야 광고가 뜬다 — 지금은 자리표시자다.
const AD_CLIENT = "ca-pub-2220762633547591";

const AD_UNITS = {
  bannerTop: { slot: "REPLACE_BANNER_TOP", width: 320, height: 50, cssClass: "banner" },
  bannerBottom: { slot: "REPLACE_BANNER_BOTTOM", width: 320, height: 50, cssClass: "banner" },
  rect: { slot: "REPLACE_RECT", width: 250, height: 250, cssClass: "rect" },
  // 게임(반응속도·딜레마)이 끝나고 결과로 넘어가기 직전에 한 번 보여주는 게이트 화면 전용.
  interstitial: { slot: "REPLACE_INTERSTITIAL", width: 300, height: 250, cssClass: "interstitial" },
};

export function adSlotMarkup(kind, style = "") {
  const { slot, width, height, cssClass } = AD_UNITS[kind];
  const styleAttr = style ? ` style="${style}"` : "";
  return `<div class="ad-slot ${cssClass}"${styleAttr}><ins class="adsbygoogle" style="display:inline-block;width:${width}px;height:${height}px" data-ad-client="${AD_CLIENT}" data-ad-slot="${slot}"></ins></div>`;
}

// AdFit 웹 SDK엔 몇 초 뒤 자동 전환되는 진짜 전면광고 포맷이 없어서, 고정 크기 광고
// 단위(interstitial)를 화면 하나로 채우고 짧은 카운트다운 뒤에 "계속하기" 버튼을
// 활성화하는 것으로 대신해왔다. AdSense 전환 뒤에도 당장은 같은 방식을 유지한다
// (Auto ads의 실제 전면 포맷 전환은 4단위 비교 이후 과제).
// 카운트다운 진행/버튼 활성화는 core/dom.js의 bindAdGate()가 맡는다 — 여긴 마크업만.
// 홈 버튼(.exit-btn)은 이 카운트다운과 무관하게 항상 즉시 동작한다(트래픽 이탈 방지).
export function adGateMarkup(message) {
  return `
    <div class="ad-gate">
      <p class="ad-gate-msg">${message}</p>
      ${adSlotMarkup("interstitial", "margin-top:6px; margin-bottom:18px;")}
      <button class="cta-btn" id="ad-gate-continue" disabled>결과 보러 가기 (<span id="ad-gate-count">3</span>)</button>
    </div>
  `;
}

// AdSense 스크립트는 로드된 후 페이지에 남는다 — AdFit처럼 스캔용 태그를 갈아끼울 필요
// 없이, 새로 생긴 <ins class="adsbygoogle"> 하나당 push({})를 한 번씩 호출하면 그 슬롯만
// 채워진다. data-adsbygoogle-status는 처리된 슬롯에 스크립트가 직접 붙이는 속성이라
// 이미 채워진 슬롯을 다시 push하지 않게 걸러주는 용도로 그대로 쓴다.
export function refreshAds() {
  document.querySelectorAll(".adsbygoogle:not([data-adsbygoogle-status])").forEach(() => {
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch (e) {
      console.error(e);
    }
  });
}
