export function ResultCard({
  eyebrow,
  title,
  description,
  chips,
}: {
  eyebrow: string;
  title: string;
  description: string;
  chips?: string[];
}) {
  return (
    <div
      className="rounded-[26px] px-6 py-7 text-center text-white"
      style={{
        background: "linear-gradient(160deg, #6E58F5, #4A32D6)",
      }}
    >
      <div className="text-[12px] font-bold tracking-wide text-[#D8D2FF]">{eyebrow}</div>
      <h2 className="text-[22px] font-extrabold mt-2.5 mb-2 tracking-tight text-balance">
        {title}
      </h2>
      <p className="text-[13px] leading-relaxed text-[#E4E0FF]">{description}</p>
      {chips && chips.length > 0 && (
        <div className="inline-flex gap-1.5 mt-4 rounded-full bg-white/15 px-3.5 py-1.5 flex-wrap justify-center">
          {chips.map((chip, i) => (
            <span key={chip} className="text-[11px] font-bold text-white">
              {i > 0 && <span className="text-[#9F8FF5] mr-1.5">·</span>}
              {chip}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
