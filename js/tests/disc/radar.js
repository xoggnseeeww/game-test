// 네 축짜리 레이더 차트. 라이브러리 없이 인라인 SVG로 그린다.
//
// 축을 위·오른쪽·아래·왼쪽에 두면 대척점(D↔S, I↔C)이 화면에서도 정확히 맞은편에
// 놓인다. 이론과 그림이 어긋나지 않고, 축이 네 개뿐이라 삼각함수도 필요 없다.
//
//        D 주도
//   C 신중  ●  I 사교
//        S 안정
import { AXIS_LABELS } from "./data.js";

// 좌우 라벨("신중 100%")이 12px 기준 55px쯤 되므로 가로 여백을 그만큼 잡는다.
// 좁게 잡았더니 양쪽 라벨이 실제로 잘렸다.
const CX = 160;
const CY = 120;
const R = 82;
// 0%가 한 점으로 뭉개지지 않도록 최소 반지름을 남긴다
const FLOOR = 0.12;

function radius(pct) {
  return R * (FLOOR + (1 - FLOOR) * (pct / 100));
}

export function pointsFor(pct) {
  return [
    [CX, CY - radius(pct.D)],
    [CX + radius(pct.I), CY],
    [CX, CY + radius(pct.S)],
    [CX - radius(pct.C), CY],
  ]
    .map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`)
    .join(" ");
}

const gridAt = (ratio) => pointsFor({ D: ratio, I: ratio, S: ratio, C: ratio });

// el()은 첫 번째 요소 하나만 돌려주므로 <svg> 하나로 감싸야 한다.
// <template> 안에서도 <svg>...</svg> 전체는 SVG 네임스페이스로 제대로 파싱된다.
export function radarMarkup(pct) {
  const label = (x, y, anchor, axis) =>
    `<text class="radar-label" x="${x}" y="${y}" text-anchor="${anchor}" dy="0.35em">${AXIS_LABELS[axis]} ${pct[axis]}%</text>`;

  return `
    <svg class="disc-radar" viewBox="0 0 320 240" width="100%" role="img"
         aria-label="주도 ${pct.D}%, 사교 ${pct.I}%, 안정 ${pct.S}%, 신중 ${pct.C}%">
      ${[100, 75, 50, 25].map((r) => `<polygon class="radar-grid" points="${gridAt(r)}"/>`).join("")}
      <line class="radar-axis" x1="${CX}" y1="${CY - R}" x2="${CX}" y2="${CY + R}"/>
      <line class="radar-axis" x1="${CX - R}" y1="${CY}" x2="${CX + R}" y2="${CY}"/>
      <polygon class="radar-shape" points="${pointsFor({ D: 0, I: 0, S: 0, C: 0 })}"/>
      ${label(CX, CY - R - 24, "middle", "D")}
      ${label(CX + R + 10, CY, "start", "I")}
      ${label(CX, CY + R + 24, "middle", "S")}
      ${label(CX - R - 10, CY, "end", "C")}
    </svg>
  `;
}

// 가운데서 실제 값까지 폴리곤을 펴는 애니메이션.
// points 속성을 프레임마다 다시 쓰는 방식이라 SMIL이나 transform-origin 같은
// 브라우저별 함정이 없다. onLeave에 취소를 등록하는 건 호출하는 쪽 몫.
export function animateRadar(svg, pct, register) {
  const poly = svg.querySelector(".radar-shape");
  if (!poly) return;

  const reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduced) {
    poly.setAttribute("points", pointsFor(pct));
    return;
  }

  let raf = null;
  let aborted = false;
  if (register) register(() => { aborted = true; cancelAnimationFrame(raf); });

  const started = performance.now();
  const step = (now) => {
    if (aborted) return;
    const t = Math.min(1, (now - started) / 600);
    const eased = 1 - Math.pow(1 - t, 3);
    poly.setAttribute("points", pointsFor({
      D: pct.D * eased,
      I: pct.I * eased,
      S: pct.S * eased,
      C: pct.C * eased,
    }));
    if (t < 1) raf = requestAnimationFrame(step);
  };
  raf = requestAnimationFrame(step);
}

// 공유 이미지(캔버스)에도 같은 좌표 계산을 쓴다.
export function drawRadarOnCanvas(ctx, pct, cx, cy, scale) {
  const pts = pointsFor(pct)
    .split(" ")
    .map((p) => p.split(",").map(Number))
    .map(([x, y]) => [cx + (x - CX) * scale, cy + (y - CY) * scale]);

  const ring = (ratio, stroke) => {
    const g = gridAt(ratio)
      .split(" ")
      .map((p) => p.split(",").map(Number))
      .map(([x, y]) => [cx + (x - CX) * scale, cy + (y - CY) * scale]);
    ctx.beginPath();
    g.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.closePath();
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 2;
    ctx.stroke();
  };
  [100, 75, 50, 25].forEach((r) => ring(r, "rgba(255,255,255,.25)"));

  ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
  ctx.fillStyle = "rgba(255,255,255,.35)";
  ctx.fill();
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = 4;
  ctx.stroke();

  return pts;
}
