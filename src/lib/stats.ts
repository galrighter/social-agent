export const ENTRY_FEE = 25;
export const GAME_GAP_HOURS = 12;

export interface StatsTx {
  playerKey: string;
  playerName: string;
  type: string; // payment | redeem | unknown
  effectiveAmount: number;
  occurredAt: Date;
  excludedFromStats: boolean;
}

export interface Game {
  index: number;
  startAt: Date;
  endAt: Date;
  players: number;
  playerKeys: string[];
  totalEntriesAmount: number;
  entriesCount: number;
}

export interface PlayerStats {
  playerKey: string;
  playerName: string;
  paid: number;
  received: number;
  net: number;
  gamesAttended: number;
  entriesCount: number;
  avgEntriesPerGame: number;
  avgNetPerGame: number;
  avgLossPerGame: number | null; // רק לשחקנים עם net שלילי
}

export interface MonthStats {
  month: string; // yyyy-MM
  totalEntriesAmount: number;
  gamesCount: number;
}

export interface DashboardStats {
  totalPayments: number;
  totalRedeems: number;
  accountingDiff: number;
  playersCount: number;
  gamesCount: number;
  averagePot: number;
  averagePlayersPerGame: number;
  averageEntriesPerGame: number;
  players: PlayerStats[];
  games: Game[];
  months: MonthStats[];
  weekdayGameCounts: number[]; // אינדקס 0 = ראשון
  biggestGame: Game | null;
  hottestMonth: MonthStats | null;
  topWinner: PlayerStats | null;
  attendanceChampion: PlayerStats | null;
  bestAvgNetPerGame: PlayerStats | null;
  mostAvgEntriesPerGame: PlayerStats | null;
  potOverTime: { label: string; averagePot: number }[];
}

const MIN_GAMES_FOR_AVG = 10;

/**
 * זיהוי משחקים לפי אשכולות של תשלומי כניסה:
 * פער של יותר מ־12 שעות בין תשלום לתשלום פותח משחק חדש.
 */
export function clusterGames(payments: StatsTx[]): Game[] {
  const sorted = [...payments].sort(
    (a, b) => a.occurredAt.getTime() - b.occurredAt.getTime()
  );
  const games: Game[] = [];
  let current: StatsTx[] = [];

  const flush = () => {
    if (current.length === 0) return;
    const keys = new Set(current.map((t) => t.playerKey));
    const total = current.reduce((sum, t) => sum + t.effectiveAmount, 0);
    games.push({
      index: games.length + 1,
      startAt: current[0].occurredAt,
      endAt: current[current.length - 1].occurredAt,
      players: keys.size,
      playerKeys: [...keys],
      totalEntriesAmount: total,
      entriesCount: total / ENTRY_FEE,
    });
    current = [];
  };

  const gapMs = GAME_GAP_HOURS * 3600 * 1000;
  for (const tx of sorted) {
    if (
      current.length > 0 &&
      tx.occurredAt.getTime() - current[current.length - 1].occurredAt.getTime() > gapMs
    ) {
      flush();
    }
    current.push(tx);
  }
  flush();

  return games;
}

function monthKey(date: Date): string {
  return date.toISOString().slice(0, 7);
}

/** חישוב כל סטטיסטיקות הדשבורד עבור עסקאות שכבר סוננו לטווח התאריכים. */
export function computeStats(transactions: StatsTx[]): DashboardStats {
  const active = transactions.filter((t) => !t.excludedFromStats);
  const payments = active.filter((t) => t.type === "payment" && t.effectiveAmount > 0);
  const redeems = active.filter((t) => t.effectiveAmount < 0);

  const totalPayments = payments.reduce((s, t) => s + t.effectiveAmount, 0);
  const totalRedeems = Math.abs(redeems.reduce((s, t) => s + t.effectiveAmount, 0));
  const accountingDiff = Math.abs(totalRedeems - totalPayments);

  const games = clusterGames(payments);
  const gamesCount = games.length;

  // לפי שחקן
  const byPlayer = new Map<
    string,
    { name: string; paid: number; received: number; gameIndexes: Set<number> }
  >();
  const ensure = (t: StatsTx) => {
    let entry = byPlayer.get(t.playerKey);
    if (!entry) {
      entry = { name: t.playerName, paid: 0, received: 0, gameIndexes: new Set() };
      byPlayer.set(t.playerKey, entry);
    }
    return entry;
  };
  for (const t of active) {
    const entry = ensure(t);
    if (t.effectiveAmount > 0) entry.paid += t.effectiveAmount;
    else if (t.effectiveAmount < 0) entry.received += Math.abs(t.effectiveAmount);
  }
  for (const game of games) {
    for (const key of game.playerKeys) {
      const entry = byPlayer.get(key);
      if (entry) entry.gameIndexes.add(game.index);
    }
  }

  const players: PlayerStats[] = [...byPlayer.entries()].map(([key, p]) => {
    const net = p.received - p.paid;
    const gamesAttended = p.gameIndexes.size;
    const entriesCount = p.paid / ENTRY_FEE;
    return {
      playerKey: key,
      playerName: p.name,
      paid: p.paid,
      received: p.received,
      net,
      gamesAttended,
      entriesCount,
      avgEntriesPerGame: gamesAttended > 0 ? entriesCount / gamesAttended : 0,
      avgNetPerGame: gamesAttended > 0 ? net / gamesAttended : 0,
      avgLossPerGame:
        net < 0 && gamesAttended > 0 ? Math.abs(net) / gamesAttended : null,
    };
  });
  players.sort((a, b) => b.net - a.net);

  // לפי חודש
  const monthMap = new Map<string, MonthStats>();
  for (const t of payments) {
    const key = monthKey(t.occurredAt);
    const m = monthMap.get(key) ?? { month: key, totalEntriesAmount: 0, gamesCount: 0 };
    m.totalEntriesAmount += t.effectiveAmount;
    monthMap.set(key, m);
  }
  for (const g of games) {
    const key = monthKey(g.startAt);
    const m = monthMap.get(key) ?? { month: key, totalEntriesAmount: 0, gamesCount: 0 };
    m.gamesCount += 1;
    monthMap.set(key, m);
  }
  const months = [...monthMap.values()].sort((a, b) => a.month.localeCompare(b.month));

  // ימי שבוע (UTC — הזמנים נשמרים כשעון קיר)
  const weekdayGameCounts = new Array(7).fill(0) as number[];
  for (const g of games) weekdayGameCounts[g.startAt.getUTCDay()]++;

  const biggestGame = games.reduce<Game | null>(
    (best, g) => (best === null || g.totalEntriesAmount > best.totalEntriesAmount ? g : best),
    null
  );
  const hottestMonth = months.reduce<MonthStats | null>(
    (best, m) =>
      best === null || m.totalEntriesAmount > best.totalEntriesAmount ? m : best,
    null
  );

  const experienced = players.filter((p) => p.gamesAttended >= MIN_GAMES_FOR_AVG);
  const topWinner = players.length > 0 && players[0].net > 0 ? players[0] : players[0] ?? null;
  const attendanceChampion = players.reduce<PlayerStats | null>(
    (best, p) => (best === null || p.gamesAttended > best.gamesAttended ? p : best),
    null
  );
  const bestAvgNetPerGame = experienced.reduce<PlayerStats | null>(
    (best, p) => (best === null || p.avgNetPerGame > best.avgNetPerGame ? p : best),
    null
  );
  const mostAvgEntriesPerGame = experienced.reduce<PlayerStats | null>(
    (best, p) => (best === null || p.avgEntriesPerGame > best.avgEntriesPerGame ? p : best),
    null
  );

  const potOverTime = months.map((m) => ({
    label: m.month,
    averagePot: m.gamesCount > 0 ? m.totalEntriesAmount / m.gamesCount : 0,
  }));

  return {
    totalPayments,
    totalRedeems,
    accountingDiff,
    playersCount: byPlayer.size,
    gamesCount,
    averagePot: gamesCount > 0 ? totalPayments / gamesCount : 0,
    averagePlayersPerGame:
      gamesCount > 0 ? games.reduce((s, g) => s + g.players, 0) / gamesCount : 0,
    averageEntriesPerGame: gamesCount > 0 ? totalPayments / ENTRY_FEE / gamesCount : 0,
    players,
    games,
    months,
    weekdayGameCounts,
    biggestGame,
    hottestMonth,
    topWinner,
    attendanceChampion,
    bestAvgNetPerGame,
    mostAvgEntriesPerGame,
    potOverTime,
  };
}

/** Top N לפי רווח נטו חיובי. */
export function topWinners(players: PlayerStats[], n = 10): PlayerStats[] {
  return players.filter((p) => p.net > 0).slice(0, n);
}

/** Top N לפי ממוצע הפסד למשחק — מינימום משחקים כדי לא להקצין מדגם קטן. */
export function topAvgLoss(
  players: PlayerStats[],
  n = 10,
  minGames = MIN_GAMES_FOR_AVG
): PlayerStats[] {
  return players
    .filter((p) => p.avgLossPerGame !== null && p.gamesAttended >= minGames)
    .sort((a, b) => (b.avgLossPerGame ?? 0) - (a.avgLossPerGame ?? 0))
    .slice(0, n);
}

/** Top N נוכחות. */
export function topAttendance(players: PlayerStats[], n = 5): PlayerStats[] {
  return [...players].sort((a, b) => b.gamesAttended - a.gamesAttended).slice(0, n);
}

/** Top N ממוצע כניסות למשחק (מינימום משחקים). */
export function topAvgEntries(
  players: PlayerStats[],
  n = 5,
  minGames = MIN_GAMES_FOR_AVG
): PlayerStats[] {
  return players
    .filter((p) => p.gamesAttended >= minGames)
    .sort((a, b) => b.avgEntriesPerGame - a.avgEntriesPerGame)
    .slice(0, n);
}

/** Top N רווח ממוצע למשחק (מינימום משחקים). */
export function topAvgNet(
  players: PlayerStats[],
  n = 5,
  minGames = MIN_GAMES_FOR_AVG
): PlayerStats[] {
  return players
    .filter((p) => p.gamesAttended >= minGames)
    .sort((a, b) => b.avgNetPerGame - a.avgNetPerGame)
    .slice(0, n);
}

/** שני ימי השבוע הפופולריים ביותר למשחקים. */
export function popularWeekdays(weekdayGameCounts: number[], n = 2): number[] {
  return weekdayGameCounts
    .map((count, day) => ({ day, count }))
    .filter((d) => d.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, n)
    .map((d) => d.day);
}
