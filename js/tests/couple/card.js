// 공유 카드(drawCoupleCard, screens.js)의 배경·헤더·바닥 URL. 예전에는 배우자 전용
// 코드 카드도 같이 썼지만 그 흐름은 D-108에서 없앴다 — 파일을 합치지 않고 남겨둔 이유는
// 캔버스 배경을 그리는 코드가 결과 화면 로직과 섞이면 둘 다 읽기 나빠지기 때문이다.
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
