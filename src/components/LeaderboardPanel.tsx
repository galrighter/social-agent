export interface LeaderboardRow {
  name: string;
  value: string;
  sub?: string;
}

const HEADER_CLASS: Record<string, string> = {
  green: "panel-header-green",
  gold: "panel-header-gold",
  blue: "panel-header-blue",
  deepblue: "panel-header-deepblue",
  purple: "panel-header-purple",
};

const VALUE_CLASS: Record<string, string> = {
  green: "profit-text",
  gold: "soft-loss-text",
  blue: "text-[#24395c]",
  deepblue: "text-[#142743]",
  purple: "text-[#423468]",
};

export default function LeaderboardPanel({
  title,
  icon,
  variant,
  rows,
  emptyText = "אין נתונים בטווח שנבחר",
}: {
  title: string;
  icon: string;
  variant: keyof typeof HEADER_CLASS;
  rows: LeaderboardRow[];
  emptyText?: string;
}) {
  return (
    <div className="poker-card">
      <div className={`${HEADER_CLASS[variant]} flex items-center gap-2 px-4 py-3`}>
        <span className="text-lg" aria-hidden>
          {icon}
        </span>
        <h3 className="text-base font-extrabold sm:text-lg">{title}</h3>
      </div>
      {rows.length === 0 ? (
        <div className="px-4 py-6 text-center text-sm text-poker-text/50">{emptyText}</div>
      ) : (
        <ol className="divide-y divide-poker-goldBorder/25">
          {rows.map((row, i) => (
            <li key={`${row.name}-${i}`} className="flex items-center gap-3 px-4 py-2.5">
              <span
                className={`rank-badge ${
                  i === 0
                    ? "bg-poker-gold text-poker-text"
                    : i === 1
                      ? "bg-poker-gold/60 text-poker-text"
                      : i === 2
                        ? "bg-poker-gold/35 text-poker-text"
                        : "bg-poker-text/10 text-poker-text/70"
                }`}
              >
                {i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-bold text-poker-text">{row.name}</div>
                {row.sub ? (
                  <div className="text-xs text-poker-text/50">{row.sub}</div>
                ) : null}
              </div>
              <div className={`text-base font-extrabold ${VALUE_CLASS[variant]}`}>
                {row.value}
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
