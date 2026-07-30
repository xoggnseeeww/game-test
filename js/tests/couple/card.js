// 공유 카드(drawCoupleCard, screens.js)와 배우자 전용 코드 카드(drawCoupleCodeCard,
// screens-match.js)가 같은 배경·헤더·바닥 URL을 그린다. 하나만 있으면 브랜드 색이
// 바뀔 때 두 곳을 따로 고칠 필요가 없다.
export function createCoupleCanvas() {
  const W = 1080;
  const H = 1080;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");

  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, "#E2557F");
  bg.addColorStop(1, "#A32A5A");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  ctx.textAlign = "center";
  ctx.fillStyle = "rgba(255,255,255,.85)";
  ctx.font = "700 30px Pretendard, sans-serif";
  ctx.fillText("과몰입구역 · 부부 관계 성향 체크", W / 2, 90);

  return { canvas, ctx, W, H };
}

export function drawCoupleCardFooter(ctx, W) {
  ctx.textAlign = "center";
  ctx.font = "600 26px Pretendard, sans-serif";
  ctx.fillStyle = "rgba(255,255,255,.72)";
  ctx.fillText(`${location.origin}/test/couple`, W / 2, 1014);
}
