"use client";

export function OptionCard({
  label,
  selected,
  onClick,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "w-full flex items-center gap-3 rounded-2xl px-[18px] py-4 text-[15px] font-bold text-left transition-colors " +
        (selected
          ? "bg-primary text-white shadow-[0_6px_16px_rgba(91,68,242,0.28)]"
          : "bg-white text-[#3B3941] shadow-[0_2px_8px_rgba(0,0,0,0.05)]")
      }
    >
      <span
        className={
          "inline-flex items-center justify-center w-5 h-5 rounded-full border-2 shrink-0 text-[11px] " +
          (selected ? "border-white" : "border-[#D3CFC7]")
        }
      >
        {selected ? "✓" : ""}
      </span>
      {label}
    </button>
  );
}
