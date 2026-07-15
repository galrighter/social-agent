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
    <div className="poker-card flex items-center gap-3 p-3 sm:gap-4 sm:p-5">
      <div
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-poker-bg3 to-poker-dark text-lg text-poker-cream shadow-inner sm:h-14 sm:w-14 sm:text-2xl"
        aria-hidden
      >
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        {/* בלי truncate — המספר המלא תמיד נראה, כולל בנייד */}
        <div className="text-xl font-extrabold leading-tight text-poker-text [font-variant-numeric:tabular-nums] sm:text-3xl">
          {value}
        </div>
        <div className="text-xs font-semibold leading-tight text-poker-text/60 sm:text-sm">
          {label}
        </div>
        {sub ? <div className="text-xs text-poker-text/45">{sub}</div> : null}
      </div>
    </div>
  );
}
