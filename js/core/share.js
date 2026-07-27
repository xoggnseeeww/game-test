// 결과 공유 블록(공유하기 · 링크 복사 · 이미지 저장)을 두 테스트가 같이 쓴다.

export function shareBlockMarkup(title = "친구는 무슨 유형일까? 👀") {
  return `
    <div class="share-block">
      <div class="share-title">${title}</div>
      <button class="share-kakao active" data-share="native">📤 결과 공유하기</button>
      <div class="share-row">
        <button class="share-mini active" data-share="copy">🔗 링크 복사</button>
        <button class="share-mini active" data-share="image">🖼️ 이미지 저장</button>
      </div>
    </div>
  `;
}

function flash(btn, text, ms = 1500) {
  const original = btn.textContent;
  btn.textContent = text;
  setTimeout(() => {
    btn.textContent = original;
  }, ms);
}

// 웹폰트가 아직 안 왔으면 시스템 폰트로 그려도 되지만, 기다리다 영영 안 돌아오면
// 버튼이 "그리는 중..."에 붙박이가 된다. 일부 인앱 브라우저에서 실제로 그렇게 된다.
function fontsReady(timeout = 2000) {
  if (!document.fonts) return Promise.resolve();
  return Promise.race([
    document.fonts.ready.catch(() => {}),
    new Promise((resolve) => setTimeout(resolve, timeout)),
  ]);
}

async function saveImage(btn, draw, filename) {
  btn.textContent = "그리는 중...";
  try {
    await fontsReady();
    const canvas = await draw();
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
    const file = new File([blob], filename, { type: "image/png" });

    // 카카오톡·인스타그램 인앱 브라우저에서는 a[download]가 조용히 아무 일도 안 한다.
    // 이 사이트 트래픽의 상당수가 그쪽에서 오므로 공유 시트를 먼저 시도한다.
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file] });
      btn.textContent = "🖼️ 이미지 저장";
      return;
    }

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    flash(btn, "✅ 저장 완료!");
  } catch {
    flash(btn, "저장 실패, 다시 시도해주세요");
  }
}

export function wireShare(root, { url, text, filename, draw }) {
  const copyBtn = root.querySelector('[data-share="copy"]');
  copyBtn.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(url);
      flash(copyBtn, "✅ 복사 완료!");
    } catch {
      flash(copyBtn, "복사 실패, 직접 복사해주세요");
    }
  });

  const shareBtn = root.querySelector('[data-share="native"]');
  shareBtn.addEventListener("click", async () => {
    // navigator.share는 모바일에서 카카오톡을 포함한 OS 공유시트를 띄운다
    // (카카오 전용 SDK가 아니다). 지원 안 되면 링크 복사로 대체한다.
    if (navigator.share) {
      try {
        await navigator.share({ title: "과몰입구역", text, url });
      } catch {
        // 사용자가 공유창을 닫은 경우 등 — 별도 처리 없음
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      flash(shareBtn, "✅ 링크를 복사했어요!");
    } catch {
      flash(shareBtn, "공유 실패, 직접 복사해주세요");
    }
  });

  const imageBtn = root.querySelector('[data-share="image"]');
  imageBtn.addEventListener("click", () => saveImage(imageBtn, draw, filename));
}
