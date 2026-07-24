import Link from "next/link";

const CATEGORIES = [
  {
    emoji: "🧠",
    bg: "bg-[#EFEBFF]",
    iconBg: "bg-primary",
    title: "심리테스트",
    desc: "나를 알아보는 시간",
    href: "/tests/adhd",
    ready: true,
  },
  {
    emoji: "⚡",
    bg: "bg-[#E4F5EC]",
    iconBg: "bg-[#1FAE6A]",
    title: "미니게임",
    desc: "반응속도·기억력",
    href: "#",
    ready: false,
  },
  {
    emoji: "💡",
    bg: "bg-[#FDF0D8]",
    iconBg: "bg-[#E8A317]",
    title: "상식퀴즈",
    desc: "몇 문제 맞힐까?",
    href: "#",
    ready: false,
  },
  {
    emoji: "🎂",
    bg: "bg-[#FCE7EF]",
    iconBg: "bg-[#E5568C]",
    title: "이름·생일",
    desc: "재미로 보는 운세",
    href: "#",
    ready: false,
  },
];

export default function Home() {
  return (
    <div className="flex-1 flex flex-col items-center bg-(--color-bg-canvas) py-6 px-4">
      <main className="w-full max-w-[440px] bg-bg rounded-[32px] shadow-[0_24px_60px_rgba(23,23,26,0.10)] overflow-hidden">
        <div className="flex items-center justify-between px-6 pt-6 pb-2">
          <div className="flex items-center gap-2">
            <div className="w-[30px] h-[30px] rounded-[9px] bg-primary text-white flex items-center justify-center font-black text-[17px]">
              과
            </div>
            <span className="text-[18px] font-extrabold text-ink tracking-tight">과몰입구역</span>
          </div>
        </div>

        <div className="px-5 pt-4 pb-1.5">
          <p className="text-[22px] font-extrabold text-ink leading-snug tracking-tight m-0">
            오늘, 뭐에 과몰입해볼까?
          </p>
          <p className="text-[13px] text-ink-faint mt-0.5 mb-0">
            1분이면 끝나는 테스트 · 게임 · 퀴즈
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2.5 px-5 pt-3">
          {CATEGORIES.map((c) => (
            <Link
              key={c.title}
              href={c.href}
              aria-disabled={!c.ready}
              className={`relative rounded-[18px] p-4 ${c.bg} ${
                c.ready ? "" : "pointer-events-none opacity-60"
              }`}
            >
              {!c.ready && (
                <span className="absolute top-2.5 right-2.5 text-[10px] font-bold text-ink-quiet bg-white/70 rounded-full px-2 py-0.5">
                  준비중
                </span>
              )}
              <div
                className={`w-9 h-9 rounded-[11px] ${c.iconBg} flex items-center justify-center text-[18px] mb-6`}
              >
                {c.emoji}
              </div>
              <div className="text-[15px] font-extrabold text-ink">{c.title}</div>
              <div className="text-[11px] text-ink-faint mt-0.5">{c.desc}</div>
            </Link>
          ))}
        </div>

        <div className="px-5 pt-4.5 pb-6">
          <div className="text-[13px] font-extrabold text-ink mb-2">🔥 지금 하는 중</div>
          <Link
            href="/tests/adhd"
            className="flex items-center gap-3.5 rounded-[20px] bg-ink px-4.5 py-4.5"
          >
            <div className="w-14 h-14 rounded-2xl bg-primary flex items-center justify-center text-[28px] shrink-0">
              🎯
            </div>
            <div className="flex-1">
              <div className="text-[15px] font-extrabold text-white">성인 ADHD 자가 체크</div>
              <div className="text-[12px] text-[#B7B4BD] mt-0.5">
                집중 안 되는 나, 혹시…? · 12문항
              </div>
            </div>
            <div className="text-ink-faint text-[20px]">›</div>
          </Link>
        </div>
      </main>
    </div>
  );
}
