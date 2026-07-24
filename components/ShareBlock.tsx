"use client";

import { useState } from "react";

export function ShareBlock({
  shareUrl,
  shareTitle,
  shareText,
  ogImageUrl,
  heading,
}: {
  shareUrl: string;
  shareTitle: string;
  shareText: string;
  ogImageUrl: string;
  heading: string;
}) {
  const [copyState, setCopyState] = useState<"idle" | "copied" | "error">("idle");

  async function handleShare() {
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: shareTitle, text: shareText, url: shareUrl });
        return;
      } catch {
        // user cancelled or share failed — fall through to clipboard copy
      }
    }
    await handleCopy();
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopyState("copied");
      setTimeout(() => setCopyState("idle"), 1800);
    } catch {
      setCopyState("error");
      setTimeout(() => setCopyState("idle"), 1800);
    }
  }

  return (
    <div className="px-5 pt-4.5">
      <div className="text-[13px] font-extrabold text-ink text-center mb-3">{heading}</div>
      <button
        type="button"
        onClick={handleShare}
        className="w-full flex items-center justify-center gap-2 rounded-2xl bg-[#FEE500] px-4 py-4 text-[15px] font-extrabold text-[#3C1E1E] shadow-[0_6px_16px_rgba(254,229,0,0.4)]"
      >
        💬 결과 공유하기
      </button>
      <div className="flex gap-2.5 mt-2.5">
        <button
          type="button"
          onClick={handleCopy}
          className="flex-1 rounded-2xl bg-white px-3.5 py-3.5 text-[14px] font-bold text-[#3B3941] shadow-[0_2px_8px_rgba(0,0,0,0.05)]"
        >
          {copyState === "copied" ? "✅ 복사됨" : copyState === "error" ? "복사 실패" : "🔗 링크 복사"}
        </button>
        <a
          href={ogImageUrl}
          download
          className="flex-1 flex items-center justify-center rounded-2xl bg-white px-3.5 py-3.5 text-[14px] font-bold text-[#3B3941] shadow-[0_2px_8px_rgba(0,0,0,0.05)] text-center"
        >
          🖼️ 이미지 저장
        </a>
      </div>
    </div>
  );
}
