import { formatILSSigned, formatInt } from "@/lib/format";

export interface RankingPlayer {
  playerKey: string;
  playerName: string;
  net: number;
  gamesAttended: number;
  entriesCount: number;
}

export default function FullRankingPanel({ players }: { players: RankingPlayer[] }) {
  return (
    <div className="poker-card">
      <div className="panel-header-green flex flex-wrap items-center justify-between gap-2 px-4 py-3">
        <h3 className="flex items-center gap-2 text-base font-extrabold sm:text-lg">
          <span aria-hidden>🃏</span>
          דירוג מלא – תוצאה נטו לפי שחקן
        </h3>
      </div>
      {players.length === 0 ? (
        <div className="px-4 py-6 text-center text-sm text-poker-text/50">
          אין נתונים בטווח שנבחר
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[340px] text-sm">
            <thead>
              <tr className="bg-poker-panel2 text-xs font-bold text-poker-text/60">
                <th className="px-3 py-2 text-right">#</th>
                <th className="px-2 py-2 text-right">שחקן</th>
                <th className="px-2 py-2 text-center">משחקים</th>
                <th className="px-2 py-2 text-center">כניסות</th>
                <th className="px-3 py-2 text-left">נטו</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-poker-goldBorder/20">
              {players.map((p, i) => (
                <tr key={p.playerKey} className="hover:bg-poker-panel2/60">
                  <td className="px-3 py-2 font-extrabold text-poker-text/50">{i + 1}</td>
                  <td className="px-2 py-2 font-bold text-poker-text">{p.playerName}</td>
                  <td className="px-2 py-2 text-center text-poker-text/70">
                    {formatInt(p.gamesAttended)}
                  </td>
                  <td className="px-2 py-2 text-center text-poker-text/70">
                    {formatInt(p.entriesCount)}
                  </td>
                  <td
                    className={`px-3 py-2 text-left font-extrabold [font-variant-numeric:tabular-nums] ${
                      p.net > 0 ? "profit-text" : p.net < 0 ? "loss-text" : "text-poker-text/60"
                    }`}
                  >
                    {formatILSSigned(p.net)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
