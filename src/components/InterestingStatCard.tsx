export default function InterestingStatCard({
  icon,
  title,
  name,
  value,
  sub,
}: {
  icon: string;
  title: string;
  name: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="poker-card flex items-start gap-3 p-4">
      <div
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-poker-goldBorder/60 bg-poker-panel2 text-xl"
        aria-hidden
      >
        {icon}
      </div>
      <div className="min-w-0">
        <div className="text-xs font-bold uppercase tracking-wide text-poker-text/55">
          {title}
        </div>
        <div className="truncate text-base font-extrabold text-poker-text">{name}</div>
        <div className="text-lg font-extrabold text-poker-green">{value}</div>
        {sub ? <div className="text-xs text-poker-text/50">{sub}</div> : null}
      </div>
    </div>
  );
}
