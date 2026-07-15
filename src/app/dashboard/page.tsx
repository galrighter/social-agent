import Link from "next/link";
import PokerLayout from "@/components/PokerLayout";
import KpiCard from "@/components/KpiCard";
import LeaderboardPanel from "@/components/LeaderboardPanel";
import FullRankingPanel from "@/components/FullRankingPanel";
import InterestingStatCard from "@/components/InterestingStatCard";
import MiniRankingPanel from "@/components/MiniRankingPanel";
import DateRangeFilter from "@/components/DateRangeFilter";
import DashboardCharts from "@/components/DashboardCharts";
import { requireAuth } from "@/lib/auth";
import { resolveRange } from "@/lib/dateRange";
import { statsForRange, hasAnyTransactions } from "@/lib/statsService";
import {
  popularWeekdays,
  topAttendance,
  topAvgEntries,
  topAvgLoss,
  topAvgNet,
  topWinners,
} from "@/lib/stats";
import {
  formatDecimal,
  formatILS,
  formatILSAvg,
  formatILSSigned,
  formatInt,
  formatMonth,
  formatShortDate,
  formatYmdDisplay,
  weekdayName,
} from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  await requireAuth();
  const params = await searchParams;
  const { range, allTime } = resolveRange(params.from, params.to);
  const [stats, hasData] = await Promise.all([statsForRange(range), hasAnyTransactions()]);

  const subtitle = allTime
    ? "כל התקופה בקובץ"
    : `מתאריך ${formatYmdDisplay(range.from)} ועד ${formatYmdDisplay(range.to)}`;

  // מציגים בדירוגים רק שחקנים עם 10 משחקים ומעלה (הסתרת מזדמנים)
  const MIN_GAMES = 10;
  const rankedPlayers = stats.players.filter((p) => p.gamesAttended >= MIN_GAMES);

  const winners = topWinners(rankedPlayers);
  const avgLosses = topAvgLoss(rankedPlayers);
  const attendance = topAttendance(rankedPlayers);
  const avgEntries = topAvgEntries(rankedPlayers);
  const avgNet = topAvgNet(rankedPlayers);
  const popularDays = popularWeekdays(stats.weekdayGameCounts);

  const topWinner = rankedPlayers.length > 0 ? rankedPlayers[0] : null;
  const attendanceChampion = rankedPlayers.reduce<(typeof rankedPlayers)[number] | null>(
    (best, p) => (best === null || p.gamesAttended > best.gamesAttended ? p : best),
    null
  );

  return (
    <PokerLayout active="/dashboard">
      {/* Header */}
      <header className="mb-6 text-center">
        <div className="mb-2 flex items-center justify-center gap-3 text-3xl suit-decor sm:text-4xl" aria-hidden>
          <span className="text-poker-cream/80">♠</span>
          <span className="text-red-400/90">♥</span>
          <h1 className="mx-2 text-3xl font-extrabold text-white drop-shadow-lg sm:text-5xl">
            רמי שכונתי – סיכום משחקים
          </h1>
          <span className="text-red-400/90">♦</span>
          <span className="text-poker-cream/80">♣</span>
        </div>
        <p className="gold-heading text-lg font-bold sm:text-xl">{subtitle}</p>
        <p className="mt-1 text-sm text-poker-cream/60">
          פלוס = תשלום כניסה / ריבאיי | מינוס = העברת זכייה
        </p>
      </header>

      <DateRangeFilter from={range.from} to={range.to} allTime={allTime} />

      {!hasData ? (
        <div className="poker-card mx-auto max-w-lg p-8 text-center">
          <div className="mb-3 text-4xl" aria-hidden>🎲</div>
          <h2 className="mb-2 text-xl font-extrabold text-poker-text">עדיין אין נתונים</h2>
          <p className="mb-4 text-sm text-poker-text/60">
            כדי להתחיל, העלה קובץ Excel עם רשומות המשחקים.
          </p>
          <Link
            href="/import"
            className="inline-block rounded-lg bg-poker-green px-5 py-2 font-bold text-white transition hover:brightness-110"
          >
            לייבוא קובץ Excel
          </Link>
        </div>
      ) : (
        <>
          {/* KPI cards */}
          <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            <KpiCard icon="🎲" value={formatInt(stats.gamesCount)} label="משחקים" />
            <KpiCard icon="👥" value={formatInt(stats.playersCount)} label="שחקנים" />
            <KpiCard icon="🎟️" value={formatILS(stats.totalPayments)} label="סך כל הכניסות" />
            <KpiCard icon="🏆" value={formatILS(stats.totalRedeems)} label="סך כל הזכיות ששולמו" />
            <KpiCard icon="💰" value={formatILS(stats.averagePot)} label="קופה ממוצעת למשחק" />
            <KpiCard
              icon="🪑"
              value={formatDecimal(stats.averagePlayersPerGame, 1)}
              label="שחקנים בממוצע למשחק"
            />
            <KpiCard
              icon="🚪"
              value={formatDecimal(stats.averageEntriesPerGame, 1)}
              label="כניסות בממוצע למשחק"
            />
            <KpiCard icon="⚖️" value={formatILS(stats.accountingDiff)} label="פער רישומי בנתונים" />
          </section>

          {/* מי הרוויח ומי הפסיד */}
          <section className="mt-8">
            <h2 className="gold-heading mb-4 text-xl font-extrabold sm:text-2xl">
              מי הרוויח ומי הפסיד – נטו
            </h2>
            <div className="grid gap-4 lg:grid-cols-2">
              <LeaderboardPanel
                title="המובילים ברווח"
                icon="📈"
                variant="green"
                rows={winners.map((p) => ({
                  name: p.playerName,
                  value: formatILSSigned(p.net),
                  sub: `${formatInt(p.gamesAttended)} משחקים`,
                }))}
              />
              <LeaderboardPanel
                title="ממוצע הפסד למשחק"
                icon="🎯"
                variant="gold"
                rows={avgLosses.map((p) => ({
                  name: p.playerName,
                  value: formatILSAvg(p.avgLossPerGame ?? 0),
                  sub: `${formatInt(p.gamesAttended)} משחקים`,
                }))}
                emptyText="אין מספיק נתונים (מינימום 10 משחקים)"
              />
            </div>
            <div className="mt-4">
              <FullRankingPanel
                players={rankedPlayers.map((p) => ({
                  playerKey: p.playerKey,
                  playerName: p.playerName,
                  net: p.net,
                  gamesAttended: p.gamesAttended,
                  entriesCount: p.entriesCount,
                }))}
              />
            </div>
          </section>

          {/* סטטיסטיקות מעניינות */}
          <section className="mt-8">
            <h2 className="gold-heading mb-4 text-xl font-extrabold sm:text-2xl">
              סטטיסטיקות מעניינות
            </h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {topWinner && topWinner.net > 0 ? (
                <InterestingStatCard
                  icon="🏆"
                  title="הזוכה הגדול"
                  name={topWinner.playerName}
                  value={formatILSSigned(topWinner.net)}
                />
              ) : null}
              {attendanceChampion ? (
                <InterestingStatCard
                  icon="👥"
                  title="שיאן נוכחות"
                  name={attendanceChampion.playerName}
                  value={`${formatInt(attendanceChampion.gamesAttended)} משחקים`}
                />
              ) : null}
              {stats.bestAvgNetPerGame ? (
                <InterestingStatCard
                  icon="📈"
                  title="הממוצע הטוב ביותר למשחק"
                  name={stats.bestAvgNetPerGame.playerName}
                  value={formatILSSigned(stats.bestAvgNetPerGame.avgNetPerGame)}
                  sub={`${formatInt(stats.bestAvgNetPerGame.gamesAttended)} משחקים`}
                />
              ) : null}
              {stats.mostAvgEntriesPerGame ? (
                <InterestingStatCard
                  icon="🚪"
                  title="הכי הרבה כניסות בממוצע למשחק"
                  name={stats.mostAvgEntriesPerGame.playerName}
                  value={formatDecimal(stats.mostAvgEntriesPerGame.avgEntriesPerGame, 2)}
                  sub={`${formatInt(stats.mostAvgEntriesPerGame.gamesAttended)} משחקים`}
                />
              ) : null}
              {stats.hottestMonth ? (
                <InterestingStatCard
                  icon="📅"
                  title="החודש הכי חם"
                  name={formatMonth(stats.hottestMonth.month)}
                  value={formatILS(stats.hottestMonth.totalEntriesAmount)}
                  sub={`${formatInt(stats.hottestMonth.gamesCount)} משחקים`}
                />
              ) : null}
              {stats.biggestGame ? (
                <InterestingStatCard
                  icon="🪙"
                  title="המשחק הגדול ביותר"
                  name={formatShortDate(stats.biggestGame.startAt)}
                  value={formatILS(stats.biggestGame.totalEntriesAmount)}
                  sub={`${formatInt(stats.biggestGame.players)} שחקנים`}
                />
              ) : null}
              {popularDays.length > 0 ? (
                <InterestingStatCard
                  icon="🗓️"
                  title="הימים הכי פופולריים"
                  name={popularDays.map((d) => weekdayName(d)).join(" · ")}
                  value={popularDays
                    .map((d) => `${formatInt(stats.weekdayGameCounts[d])} משחקים`)
                    .join(" · ")}
                />
              ) : null}
            </div>
          </section>

          {/* פאנלים תחתונים */}
          <section className="mt-8 grid gap-4 lg:grid-cols-3">
            <MiniRankingPanel
              title="נוכחות – הכי הרבה משחקים"
              icon="👥"
              variant="purple"
              rows={attendance.map((p) => ({
                name: p.playerName,
                value: `${formatInt(p.gamesAttended)}`,
                sub: "משחקים",
              }))}
            />
            <MiniRankingPanel
              title="ממוצע כניסות למשחק"
              icon="🚪"
              variant="deepblue"
              rows={avgEntries.map((p) => ({
                name: p.playerName,
                value: formatDecimal(p.avgEntriesPerGame, 2),
                sub: `${formatInt(p.gamesAttended)} משחקים`,
              }))}
            />
            <MiniRankingPanel
              title="רווח ממוצע למשחק"
              icon="💰"
              variant="gold"
              rows={avgNet.map((p) => ({
                name: p.playerName,
                value: formatILSSigned(p.avgNetPerGame),
                sub: `${formatInt(p.gamesAttended)} משחקים`,
              }))}
            />
          </section>

          <DashboardCharts
            months={stats.months}
            players={stats.players.map((p) => ({ playerName: p.playerName, net: p.net }))}
            potOverTime={stats.potOverTime}
          />
        </>
      )}
    </PokerLayout>
  );
}
