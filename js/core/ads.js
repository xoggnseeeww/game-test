// 카카오 AdFit 광고 단위. 단위 코드는 여기 한 곳에서만 관리한다.
//
// 배너가 상단+하단으로 2개인 화면에서 둘 다 같은 단위 코드를 썼더니 하나만 채워지고
// 나머지는 비어 있었다 — AdFit(다른 네트워크도 대개 마찬가지)은 같은 광고 단위 ID가
// 한 페이지에 두 번 나오면 하나의 실물 지면을 나타낸다고 보고 뒤쪽 인스턴스를 채우지
// 않는다. 그래서 배너는 위치별로 서로 다른 단위 코드(bannerTop/bannerBottom)를 쓴다.
// cssClass는 실제 마크업/스타일이 참조하는 이름 — 위치가 늘어도 .ad-slot.banner CSS
// 규칙은 그대로 재사용된다.
const AD_UNITS = {
  bannerTop: { unit: "DAN-YtXY1keVu0glLXJQ", width: 320, height: 50, cssClass: "banner" },
  bannerBottom: { unit: "DAN-o7v5hdDAgfmSu96C", width: 320, height: 50, cssClass: "banner" },
  rect: { unit: "DAN-PKr3oCfRI9IIiXwz", width: 250, height: 250, cssClass: "rect" },
  // 게임(반응속도·딜레마)이 끝나고 결과로 넘어가기 직전에 한 번 보여주는 게이트 화면 전용.
  interstitial: { unit: "DAN-tmLP8h8cur4SzSpG", width: 300, height: 250, cssClass: "interstitial" },
};

// Google AdSense — 승인 대기 중이라 ADSENSE_ENABLED=false로 꺼둔다. data-pantry-web-site의
// AdSlot.astro는 env로 카카오→애드센스를 전환하지만, 이 레포엔 env 자체가 없어서 같은 역할을
// 이 플래그 하나로 대신한다. 승인되면 이 값만 true로 바꾸면 되고, 그 전까지는 아래 adSlotMarkup()이
// 항상 기존 AD_UNITS(카카오) 분기를 타서 화면에 아무 변화가 없다. 반응형 슬롯은 2개뿐이라
// bannerTop/bannerBottom에만 대응시켰다 — rect·interstitial은 계속 카카오를 쓴다.
const ADSENSE_CLIENT = "ca-pub-2220762633547591";
const ADSENSE_ENABLED = false;
const ADSENSE_UNITS = {
  bannerTop: { slot: "8195471167" },
  bannerBottom: { slot: "4256226152" },
};

export function adSlotMarkup(kind, style = "") {
  const styleAttr = style ? ` style="${style}"` : "";
  if (ADSENSE_ENABLED && ADSENSE_UNITS[kind]) {
    const { slot } = ADSENSE_UNITS[kind];
    return `<div class="ad-slot banner"${styleAttr}><ins class="adsbygoogle" style="display:block" data-ad-client="${ADSENSE_CLIENT}" data-ad-slot="${slot}" data-ad-format="auto" data-full-width-responsive="true"></ins></div>`;
  }
  const { unit, width, height, cssClass } = AD_UNITS[kind];
  return `<div class="ad-slot ${cssClass}"${styleAttr}><ins class="kakao_ad_area" style="display:none;" data-ad-unit="${unit}" data-ad-width="${width}" data-ad-height="${height}"></ins></div>`;
}

// 게임 종료 → 결과 화면 사이에 끼우는 광고 게이트. AdFit 웹 SDK엔 몇 초 뒤 자동
// 전환되는 진짜 전면광고 포맷이 없어서, 고정 크기 광고 단위(interstitial)를 화면
// 하나로 채우고 짧은 카운트다운 뒤에 "계속하기" 버튼을 활성화하는 것으로 대신한다.
// 카운트다운 진행/버튼 활성화는 core/dom.js의 bindAdGate()가 맡는다 — 여긴 마크업만.
// 햄버거 메뉴의 "홈으로 가기"는 이 카운트다운과 무관하게 항상 즉시 동작한다(트래픽 이탈 방지).
export function adGateMarkup(message) {
  return `
    <div class="ad-gate">
      <p class="ad-gate-msg">${message}</p>
      ${adSlotMarkup("interstitial", "margin-top:6px; margin-bottom:18px;")}
      <button class="cta-btn" id="ad-gate-continue" disabled>결과 보러 가기 (<span id="ad-gate-count">3</span>)</button>
    </div>
  `;
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

// adsbygoogle.js는 <ins class="adsbygoogle"> 태그 하나당 push({}) 호출을 한 번씩 받아야
// 채워진다(카카오처럼 스크립트 재실행으로 전체 재스캔되는 방식이 아니다). ADSENSE_ENABLED가
// false인 동안은 adSlotMarkup()이 이 클래스를 아예 그리지 않으므로 이 함수는 항상 조용히 리턴한다.
function ensureAdSenseScript() {
  if (document.querySelector('script[src*="pagead2.googlesyndication.com"]')) return;
  const script = document.createElement("script");
  script.async = true;
  script.crossOrigin = "anonymous";
  script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}`;
  document.head.appendChild(script);
}

export function refreshAdSense() {
  if (!ADSENSE_ENABLED) return;
  ensureAdSenseScript();
  document.querySelectorAll("ins.adsbygoogle:not([data-adsbygoogle-status])").forEach(() => {
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch (err) {
      console.error(err);
    }
  });
}
