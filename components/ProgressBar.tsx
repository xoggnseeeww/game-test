export function ProgressBar({ current, total }: { current: number; total: number }) {
  const pct = Math.min(100, Math.round((current / total) * 100));
  return (
    <div className="flex items-center gap-3.5 px-1">
      <div className="flex-1 h-2 rounded-full bg-(--color-border) overflow-hidden">
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="text-[13px] font-extrabold text-primary whitespace-nowrap">
        {current}
        <span className="text-ink-ghost">/{total}</span>
      </div>
    </div>
  );
}
