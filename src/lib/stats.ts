import { normalizePlayerName } from "./normalize";

export const ENTRY_FEE = 25;
export const GAME_GAP_HOURS = 12;
const MIN_GAMES_FOR_AVG = 10;

/** עסקה בודדת כפי שהיא נכנסת למנוע הסטטיסטיקות. */
export type TransactionForStats = {
  id: string;
  playerName: string;
  playerKey?: string; // metadata בלבד — לא בשימוש לחישובים
  phone?: string | null; // metadata בלבד — לא בשימוש לחישובים
  type: "payment" | "redeem" | "unknown" | string;
  rawAmount: number;
  effectiveAmount: number;
  occurredAt: Date;
  excludedFromStats?: boolean;
};

/** משחק כפי שנבנה מאשכולות תשלומי הכניסה. */
export type GameForStats = {
  id: string;
  startAt: Date;
  endAt: Date;
  nextStartAt: Date | null;
  paymentTransactionIds: string[];
  transactionIds: string[]; // כולל redeem לאחר שיוך
  totalPayments: number;
  entriesCount: number;
  playersCount: number;
};

/** תצוגת משחק לדשבורד (השם ההיסטורי — נשמר לתאימות קומפוננטות). */
export interface Game {
  index: number;
  id: string;
  startAt: Date;
  endAt: Date;
  players: number;
  playerKeys: string[];
  totalEntriesAmount: number;
  entriesCount: number;
}

export interface PlayerStats {
  playerKey: string; // שם מנורמל — המזהה לחישובים
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

/**
 * בניית משחקים מכל העסקאות — לפי אשכולות של תשלומי כניסה בלבד.
 * פער של יותר מ־12 שעות בין payment ל־payment פותח משחק חדש.
 * redeem אינו פותח משחק ואינו משפיע על startAt/endAt.
 */
export function buildGamesFromTransactions(
  transactions: TransactionForStats[]
): GameForStats[] {
  const payments = transactions
    .filter((t) => !t.excludedFromStats && t.type === "payment" && t.effectiveAmount > 0)
    .sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime());

  const games: GameForStats[] = [];
  let cluster: TransactionForStats[] = [];
  const gapMs = GAME_GAP_HOURS * 3600 * 1000;

  const flush = () => {
    if (cluster.length === 0) return;
    const startAt = cluster[0].occurredAt;
    const endAt = cluster[cluster.length - 1].occurredAt;
    const totalPayments = cluster.reduce((s, t) => s + t.effectiveAmount, 0);
    const playerKeys = new Set(cluster.map((t) => normalizePlayerName(t.playerName)));
    games.push({
      id: `game-${startAt.toISOString()}`,
      startAt,
      endAt,
      nextStartAt: null,
      paymentTransactionIds: cluster.map((t) => t.id),
      transactionIds: cluster.map((t) => t.id),
      totalPayments,
      entriesCount: totalPayments / ENTRY_FEE,
      playersCount: playerKeys.size,
    });
    cluster = [];
  };

  for (const p of payments) {
    if (
      cluster.length > 0 &&
      p.occurredAt.getTime() - cluster[cluster.length - 1].occurredAt.getTime() > gapMs
    ) {
      flush();
    }
    cluster.push(p);
  }
  flush();

  for (let i = 0; i < games.length; i++) {
    games[i].nextStartAt = i + 1 < games.length ? games[i + 1].startAt : null;
  }
  return games;
}

/**
 * שיוך כל עסקה למשחק הנכון.
 * עסקה שייכת למשחק G אם: G.startAt <= t.occurredAt וגם
 * (G.nextStartAt === null או t.occurredAt < G.nextStartAt).
 * כך redeem שנרשם אחרי חצות משויך למשחק שהתחיל בערב, ולא נספר בטעות למשחק הבא.
 */
export function assignTransactionsToGames(
  transactions: TransactionForStats[],
  games: GameForStats[]
): {
  games: GameForStats[];
  transactionGameMap: Map<string, string>;
  unassignedTransactionIds: string[];
} {
  const active = transactions.filter((t) => !t.excludedFromStats);
  const sortedGames = [...games].sort((a, b) => a.startAt.getTime() - b.startAt.getTime());
  const transactionGameMap = new Map<string, string>();
  const unassignedTransactionIds: string[] = [];
  const idsByGame = new Map<string, string[]>();
  for (const g of sortedGames) idsByGame.set(g.id, []);

  for (const t of active) {
    const ts = t.occurredAt.getTime();
    let assigned: GameForStats | null = null;
    for (const g of sortedGames) {
      const startsBeforeOrAt = g.startAt.getTime() <= ts;
      const beforeNext = g.nextStartAt === null || ts < g.nextStartAt.getTime();
      if (startsBeforeOrAt && beforeNext) {
        assigned = g;
        break;
      }
    }
    if (assigned) {
      transactionGameMap.set(t.id, assigned.id);
      idsByGame.get(assigned.id)!.push(t.id);
    } else {
      // עסקה לפני המשחק הראשון ואין משחק קודם — נשארת ללא שיוך (לא נכנסת לחישוב)
      unassignedTransactionIds.push(t.id);
    }
  }

  const outGames = sortedGames.map((g) => ({
    ...g,
    transactionIds: idsByGame.get(g.id) ?? [],
  }));
  return { games: outGames, transactionGameMap, unassignedTransactionIds };
}

function monthKey(date: Date): string {
  return date.toISOString().slice(0, 7);
}

function toDisplayGame(g: GameForStats, index: number, playerKeys: string[]): Game {
  return {
    index,
    id: g.id,
    startAt: g.startAt,
    endAt: g.endAt,
    players: g.playersCount,
    playerKeys,
    totalEntriesAmount: g.totalPayments,
    entriesCount: g.entriesCount,
  };
}

/**
 * מנוע הדשבורד: מקבל את *כל* העסקאות (אחרי החלת תיקונים והחרגות) וגבולות טווח
 * חצי־פתוחים [fromDate, toExclusive), ומחזיר סטטיסטיקות המחושבות אך ורק ממשחקים
 * שהתחילו בתוך הטווח והעסקאות המשויכות אליהם.
 */
export function computeDashboardStats(
  transactions: TransactionForStats[],
  bounds: { fromDate: Date; toExclusive: Date }
): DashboardStats {
  const active = transactions.filter((t) => !t.excludedFromStats);
  const byId = new Map(active.map((t) => [t.id, t]));

  const allGames = buildGamesFromTransactions(active);
  const { games: assignedGames, transactionGameMap } = assignTransactionsToGames(
    active,
    allGames
  );

  // סינון לפי תאריך תחילת המשחק — לא לפי occurredAt של השורה
  const fromMs = bounds.fromDate.getTime();
  const toMs = bounds.toExclusive.getTime();
  const selectedGames = assignedGames.filter(
    (g) => g.startAt.getTime() >= fromMs && g.startAt.getTime() < toMs
  );
  const selectedGameIds = new Set(selectedGames.map((g) => g.id));

  const selectedTransactions = active.filter((t) => {
    const gameId = transactionGameMap.get(t.id);
    return gameId !== undefined && selectedGameIds.has(gameId);
  });

  // כללי
  const totalPayments = selectedTransactions.reduce(
    (s, t) => s + (t.effectiveAmount > 0 ? t.effectiveAmount : 0),
    0
  );
  const totalRedeems = Math.abs(
    selectedTransactions.reduce(
      (s, t) => s + (t.effectiveAmount < 0 ? t.effectiveAmount : 0),
      0
    )
  );
  const accountingDiff = Math.abs(totalPayments - totalRedeems);
  const gamesCount = selectedGames.length;

  // לפי שחקן — תמיד לפי שם מנורמל
  type Agg = { name: string; paid: number; received: number; attended: Set<string> };
  const byPlayer = new Map<string, Agg>();
  const ensure = (name: string): Agg => {
    const key = normalizePlayerName(name);
    let entry = byPlayer.get(key);
    if (!entry) {
      entry = { name, paid: 0, received: 0, attended: new Set() };
      byPlayer.set(key, entry);
    }
    return entry;
  };

  for (const t of selectedTransactions) {
    const entry = ensure(t.playerName);
    if (t.effectiveAmount > 0) entry.paid += t.effectiveAmount;
    else if (t.effectiveAmount < 0) entry.received += Math.abs(t.effectiveAmount);
  }

  // gamesAttended — לפי payment בלבד: שחקן השתתף במשחק רק אם שילם בו
  const gamePaymentKeys = new Map<string, string[]>();
  for (const g of selectedGames) {
    const keys: string[] = [];
    for (const txId of g.paymentTransactionIds) {
      const tx = byId.get(txId);
      if (!tx) continue;
      const key = normalizePlayerName(tx.playerName);
      keys.push(key);
      const entry = byPlayer.get(key);
      if (entry) entry.attended.add(g.id);
    }
    gamePaymentKeys.set(g.id, keys);
  }

  const players: PlayerStats[] = [...byPlayer.entries()].map(([key, p]) => {
    const net = p.received - p.paid;
    const gamesAttended = p.attended.size;
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
      avgLossPerGame: net < 0 && gamesAttended > 0 ? Math.abs(net) / gamesAttended : null,
    };
  });
  players.sort((a, b) => b.net - a.net);

  // playersCount — שחקנים ייחודיים עם לפחות payment אחד בטווח
  const playersCount = players.filter((p) => p.paid > 0).length;

  // תצוגת משחקים
  const displayGames = selectedGames.map((g, i) =>
    toDisplayGame(g, i + 1, gamePaymentKeys.get(g.id) ?? [])
  );

  // לפי חודש (לפי תאריך תחילת המשחק)
  const monthMap = new Map<string, MonthStats>();
  for (const g of selectedGames) {
    const key = monthKey(g.startAt);
    const m = monthMap.get(key) ?? { month: key, totalEntriesAmount: 0, gamesCount: 0 };
    m.totalEntriesAmount += g.totalPayments;
    m.gamesCount += 1;
    monthMap.set(key, m);
  }
  const months = [...monthMap.values()].sort((a, b) => a.month.localeCompare(b.month));

  // ימי שבוע (UTC — הזמנים נשמרים כשעון קיר)
  const weekdayGameCounts = new Array(7).fill(0) as number[];
  for (const g of selectedGames) weekdayGameCounts[g.startAt.getUTCDay()]++;

  const biggestGame = displayGames.reduce<Game | null>(
    (best, g) =>
      best === null || g.totalEntriesAmount > best.totalEntriesAmount ? g : best,
    null
  );
  const hottestMonth = months.reduce<MonthStats | null>(
    (best, m) =>
      best === null || m.totalEntriesAmount > best.totalEntriesAmount ? m : best,
    null
  );

  const experienced = players.filter((p) => p.gamesAttended >= MIN_GAMES_FOR_AVG);
  const topWinner = players.length > 0 ? players[0] : null;
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
    playersCount,
    gamesCount,
    averagePot: gamesCount > 0 ? totalPayments / gamesCount : 0,
    averagePlayersPerGame:
      gamesCount > 0
        ? selectedGames.reduce((s, g) => s + g.playersCount, 0) / gamesCount
        : 0,
    averageEntriesPerGame: gamesCount > 0 ? totalPayments / ENTRY_FEE / gamesCount : 0,
    players,
    games: displayGames,
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

/**
 * Top N לפי ממוצע הפסד למשחק. כולל גם שחקנים עם הפסד כולל גדול —
 * ההסתרה של מצב עדין חלה רק על הדירוג המלא, לא על הפאנל הזה.
 */
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
