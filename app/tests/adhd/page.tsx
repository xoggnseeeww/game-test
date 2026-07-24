import type { Metadata } from "next";
import Link from "next/link";
import {
  DISCLAIMER,
  INTRO_SECTIONS,
  SOURCE_ATTRIBUTION,
  TEST_TAGLINE,
  TEST_TITLE,
} from "@/content/adhd";

export const metadata: Metadata = {
  title: TEST_TITLE,
  description:
    "WHO ASRS v1.1 기반 성인 ADHD 자가 체크. 우울·불안 등 비슷한 이유도 함께 확인하는 12문항, 2분 자가 점검.",
};

export default function AdhdTestIntroPage() {
  return (
    <div className="flex-1 flex flex-col items-center bg-(--color-bg-canvas) py-6 px-4">
      <main className="w-full max-w-[440px] bg-bg rounded-[32px] shadow-[0_24px_60px_rgba(23,23,26,0.10)] overflow-hidden">
        <div className="flex items-center gap-3.5 px-5 pt-5">
          <Link href="/" className="text-[22px] text-ink-muted" aria-label="홈으로">
            ‹
          </Link>
          <span className="text-[14px] font-bold text-ink">심리테스트</span>
        </div>

        <div
          className="mx-5 mt-3.5 rounded-[26px] px-6 pt-8 pb-7 text-center"
          style={{ background: "linear-gradient(160deg, #6E58F5, #4A32D6)" }}
        >
          <div className="text-[52px] leading-none">🎯</div>
          <div className="inline-block mt-4 rounded-full bg-white/15 text-white text-[11px] font-bold px-3.5 py-1.5">
            주의력 자가 점검
          </div>
          <h1 className="text-[24px] font-extrabold text-white mt-3 mb-1.5 tracking-tight text-balance">
            {TEST_TITLE}
          </h1>
          <p className="text-[13px] text-[#D8D2FF] leading-relaxed">{TEST_TAGLINE}</p>
        </div>

        <div className="flex gap-2 px-5 pt-4">
          {[
            { big: "12문항", small: "약 2분" },
            { big: "4단계", small: "결과 구간" },
            { big: "익명", small: "저장 안 함" },
          ].map((c) => (
            <div
              key={c.big}
              className="flex-1 rounded-xl bg-white py-2.5 text-center shadow-[0_2px_8px_rgba(0,0,0,0.05)]"
            >
              <div className="text-[16px] font-extrabold text-ink">{c.big}</div>
              <div className="text-[10px] text-ink-faint mt-0.5">{c.small}</div>
            </div>
          ))}
        </div>

        <div className="px-5 pt-5 flex flex-col gap-4">
          {INTRO_SECTIONS.map((s) => (
            <section key={s.heading}>
              <h2 className="text-[14px] font-extrabold text-ink mb-1">{s.heading}</h2>
              <p className="text-[13px] text-ink-muted leading-relaxed">{s.body}</p>
            </section>
          ))}
        </div>

        <p className="text-[12px] text-ink-quiet text-center px-6 pt-5 leading-relaxed">
          {DISCLAIMER}
        </p>

        <div className="px-5 pt-4">
          <Link
            href="/tests/adhd/run"
            className="block text-center rounded-2xl bg-primary text-white text-[16px] font-extrabold py-[17px] shadow-[0_8px_20px_rgba(91,68,242,0.32)]"
          >
            자가 체크 시작하기
          </Link>
        </div>

        <p className="text-[11px] text-ink-ghost text-center px-6 py-5 leading-relaxed">
          {SOURCE_ATTRIBUTION}
        </p>
      </main>
    </div>
  );
}
