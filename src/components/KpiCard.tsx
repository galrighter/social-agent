export default function KpiCard({
  icon,
  value,
  label,
  sub,
}: {
  icon: string;
  value: string;
  label: string;
  sub?: string;
}) {
  return (
    <div className="poker-card flex items-center gap-4 p-4 sm:p-5">
      <div
        className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-poker-bg3 to-poker-dark text-2xl text-poker-cream shadow-inner"
        aria-hidden
      >
        {icon}
      </div>
      <div className="min-w-0">
        <div className="truncate text-2xl font-extrabold leading-tight text-poker-text sm:text-3xl">
          {value}
        </div>
        <div className="text-sm font-semibold text-poker-text/60">{label}</div>
        {sub ? <div className="text-xs text-poker-text/45">{sub}</div> : null}
      </div>
    </div>
  );
}
