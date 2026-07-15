import { describe, expect, it } from "vitest";
import {
  buildGamesFromTransactions,
  assignTransactionsToGames,
  computeDashboardStats,
  allTimeGamesAttended,
  regularPlayerKeys,
  topAvgLoss,
  ENTRY_FEE,
  type TransactionForStats,
} from "@/lib/stats";
import { rangeToBounds } from "@/lib/dateRange";

let seq = 0;
const at = (iso: string) => new Date(iso + "Z");

function tx(p: Partial<TransactionForStats> & { occurredAt: Date }): TransactionForStats {
  seq += 1;
  const rawAmount = p.rawAmount ?? p.effectiveAmount ?? 25;
  return {
    id: p.id ?? `t${seq}`,
    playerName: p.playerName ?? "שחקן",
    phone: p.phone ?? null,
    type: p.type ?? (rawAmount >= 0 ? "payment" : "redeem"),
    rawAmount,
    effectiveAmount: p.effectiveAmount ?? rawAmount,
    occurredAt: p.occurredAt,
    excludedFromStats: p.excludedFromStats ?? false,
  };
}

const JULY = rangeToBounds({ from: "2026-07-01", to: "2026-07-15" });

describe("בניית משחקים (אשכולות 12+ שעות, payment בלבד)", () => {
  it("פער של יותר מ־12 שעות פותח משחק חדש", () => {
    const games = buildGamesFromTransactions([
      tx({ playerName: "א", effectiveAmount: 25, occurredAt: at("2026-07-07T20:00:00") }),
      tx({ playerName: "ב", effectiveAmount: 25, occurredAt: at("2026-07-07T22:00:00") }),
      tx({ playerName: "א", effectiveAmount: 25, occurredAt: at("2026-07-08T01:00:00") }), // 3ש — אותו משחק
      tx({ playerName: "ג", effectiveAmount: 25, occurredAt: at("2026-07-08T20:00:00") }), // 19ש — משחק חדש
    ]);
    expect(games).toHaveLength(2);
    expect(games[0].startAt).toEqual(at("2026-07-07T20:00:00"));
    expect(games[0].endAt).toEqual(at("2026-07-08T01:00:00"));
    expect(games[1].startAt).toEqual(at("2026-07-08T20:00:00"));
  });

  it("redeem אינו פותח משחק ואינו משפיע על startAt/endAt", () => {
    const games = buildGamesFromTransactions([
      tx({ effectiveAmount: 25, occurredAt: at("2026-07-07T22:00:00") }),
      tx({ type: "redeem", effectiveAmount: -100, occurredAt: at("2026-07-05T10:00:00") }),
      tx({ type: "redeem", effectiveAmount: -50, occurredAt: at("2026-07-09T10:00:00") }),
    ]);
    expect(games).toHaveLength(1);
    expect(games[0].startAt).toEqual(at("2026-07-07T22:00:00"));
    expect(games[0].endAt).toEqual(at("2026-07-07T22:00:00"));
  });

  it("playersCount לפי שם מנורמל", () => {
    const [game] = buildGamesFromTransactions([
      tx({ playerName: "Gal Righter", effectiveAmount: 25, occurredAt: at("2026-07-07T22:00:00") }),
      tx({ playerName: "  gal   righter ", effectiveAmount: 25, occurredAt: at("2026-07-07T22:30:00") }),
      tx({ playerName: "אורן לוי", effectiveAmount: 25, occurredAt: at("2026-07-07T23:00:00") }),
    ]);
    expect(game.playersCount).toBe(2);
  });
});

describe("שיוך עסקאות למשחקים", () => {
  it("redeem אחרי חצות שייך למשחק שהתחיל בערב", () => {
    const txs = [
      tx({ id: "p1", effectiveAmount: 25, occurredAt: at("2026-07-11T22:00:00") }),
      tx({ id: "r1", type: "redeem", effectiveAmount: -50, occurredAt: at("2026-07-12T01:00:00") }),
    ];
    const games = buildGamesFromTransactions(txs);
    const { transactionGameMap } = assignTransactionsToGames(txs, games);
    expect(transactionGameMap.get("r1")).toBe(games[0].id);
    expect(transactionGameMap.get("p1")).toBe(games[0].id);
  });

  it("redeem לפני תחילת המשחק הבא שייך למשחק הקודם, לא לבא", () => {
    const txs = [
      tx({ id: "a", effectiveAmount: 25, occurredAt: at("2026-07-01T22:00:00") }), // game A
      tx({ id: "r", type: "redeem", effectiveAmount: -40, occurredAt: at("2026-07-07T20:00:00") }),
      tx({ id: "b", effectiveAmount: 25, occurredAt: at("2026-07-07T22:00:00") }), // game B
    ];
    const games = buildGamesFromTransactions(txs);
    const gameA = games[0];
    const { transactionGameMap } = assignTransactionsToGames(txs, games);
    expect(transactionGameMap.get("r")).toBe(gameA.id);
  });

  it("redeem יום אחרי המשחק אך לפני הבא שייך למשחק הקודם", () => {
    const txs = [
      tx({ id: "a", effectiveAmount: 25, occurredAt: at("2026-07-07T22:00:00") }),
      tx({ id: "r", type: "redeem", effectiveAmount: -30, occurredAt: at("2026-07-08T09:00:00") }),
      tx({ id: "b", effectiveAmount: 25, occurredAt: at("2026-07-11T22:00:00") }),
    ];
    const games = buildGamesFromTransactions(txs);
    const { transactionGameMap } = assignTransactionsToGames(txs, games);
    expect(transactionGameMap.get("r")).toBe(games[0].id);
  });

  it("עסקה לפני המשחק הראשון נשארת ללא שיוך", () => {
    const txs = [
      tx({ id: "early", type: "redeem", effectiveAmount: -20, occurredAt: at("2026-07-01T10:00:00") }),
      tx({ id: "p", effectiveAmount: 25, occurredAt: at("2026-07-07T22:00:00") }),
    ];
    const games = buildGamesFromTransactions(txs);
    const { transactionGameMap, unassignedTransactionIds } = assignTransactionsToGames(txs, games);
    expect(transactionGameMap.has("early")).toBe(false);
    expect(unassignedTransactionIds).toContain("early");
  });
});

describe("סינון לפי משחקים שהתחילו בטווח", () => {
  it("משחק שהתחיל לפני הטווח ונמשך אחרי חצות לא נספר", () => {
    const txs = [
      // משחק יוני — התחיל 30.6, נמשך ל־1.7
      tx({ id: "j1", playerName: "א", effectiveAmount: 100, occurredAt: at("2026-06-30T22:00:00") }),
      tx({ id: "j2", playerName: "ב", effectiveAmount: 100, occurredAt: at("2026-07-01T00:30:00") }),
      // משחק יולי
      tx({ id: "p1", playerName: "א", effectiveAmount: 25, occurredAt: at("2026-07-07T22:00:00") }),
      tx({ id: "p2", playerName: "ב", effectiveAmount: 25, occurredAt: at("2026-07-07T22:30:00") }),
    ];
    const stats = computeDashboardStats(txs, JULY);
    expect(stats.gamesCount).toBe(1);
    expect(stats.totalPayments).toBe(50); // רק משחק יולי
  });

  it("redeem אחרי חצות של משחק בטווח כן נספר", () => {
    const txs = [
      tx({ id: "p", playerName: "א", effectiveAmount: 25, occurredAt: at("2026-07-11T22:00:00") }),
      tx({ id: "r", playerName: "א", type: "redeem", effectiveAmount: -60, occurredAt: at("2026-07-12T01:00:00") }),
    ];
    const stats = computeDashboardStats(txs, JULY);
    expect(stats.gamesCount).toBe(1);
    expect(stats.totalPayments).toBe(25);
    expect(stats.totalRedeems).toBe(60);
  });
});

describe("זיהוי שחקן לפי שם ולא לפי טלפון", () => {
  const SHARED_PHONE = "972-50-333-1337";

  it("שורות redeem עם אותו טלפון מתחלקות לפי שם השחקן", () => {
    const txs = [
      tx({ id: "pa", playerName: "אורן לוי", phone: "0501111111", effectiveAmount: 25, occurredAt: at("2026-07-07T22:00:00") }),
      tx({ id: "pb", playerName: "Gal Righter", phone: "0502222222", effectiveAmount: 25, occurredAt: at("2026-07-07T22:30:00") }),
      // כל ה־redeem חולקים טלפון זהה — אסור שכולם ילכו לשחקן אחד
      tx({ id: "ra", playerName: "אורן לוי", phone: SHARED_PHONE, type: "redeem", effectiveAmount: -100, occurredAt: at("2026-07-08T01:00:00") }),
      tx({ id: "rb", playerName: "Gal Righter", phone: SHARED_PHONE, type: "redeem", effectiveAmount: -30, occurredAt: at("2026-07-08T01:05:00") }),
    ];
    const stats = computeDashboardStats(txs, JULY);
    const oren = stats.players.find((p) => p.playerName === "אורן לוי");
    const gal = stats.players.find((p) => p.playerName === "Gal Righter");
    expect(oren?.received).toBe(100);
    expect(gal?.received).toBe(30);
    // אין שחקן שקיבל את *כל* הזכיות
    expect(stats.players.every((p) => p.received <= 100)).toBe(true);
  });
});

describe("gamesAttended נספר לפי payment בלבד", () => {
  it("שחקן עם redeem בלבד במשחק לא מקבל נוכחות", () => {
    const txs = [
      tx({ id: "p", playerName: "משלם", effectiveAmount: 25, occurredAt: at("2026-07-07T22:00:00") }),
      // מקבל זכייה אך לא שילם באותו משחק
      tx({ id: "r", playerName: "רק זוכה", type: "redeem", effectiveAmount: -50, occurredAt: at("2026-07-08T01:00:00") }),
    ];
    const stats = computeDashboardStats(txs, JULY);
    const payer = stats.players.find((p) => p.playerName === "משלם");
    const receiver = stats.players.find((p) => p.playerName === "רק זוכה");
    expect(payer?.gamesAttended).toBe(1);
    expect(receiver?.gamesAttended).toBe(0);
  });
});

describe("פאנל ממוצע הפסד למשחק כולל גם מפסידים גדולים", () => {
  it("שחקן עם הפסד כולל גדול לא מוחרג מהפאנל", () => {
    const players = [
      { playerKey: "gil", playerName: "Gil Armon", paid: 3000, received: 500, net: -2500, gamesAttended: 12, entriesCount: 120, avgEntriesPerGame: 10, avgNetPerGame: -208.3, avgLossPerGame: 2500 / 12 },
      { playerKey: "x", playerName: "מפסיד קטן", paid: 300, received: 200, net: -100, gamesAttended: 12, entriesCount: 12, avgEntriesPerGame: 1, avgNetPerGame: -8.3, avgLossPerGame: 100 / 12 },
      { playerKey: "w", playerName: "מרוויח", paid: 300, received: 900, net: 600, gamesAttended: 12, entriesCount: 12, avgEntriesPerGame: 1, avgNetPerGame: 50, avgLossPerGame: null },
    ];
    const loss = topAvgLoss(players);
    expect(loss.map((p) => p.playerName)).toContain("Gil Armon");
    expect(loss[0].playerName).toBe("Gil Armon"); // ממוצע ההפסד הגבוה ביותר
    expect(loss.every((p) => p.net < 0)).toBe(true);
  });
});

describe("תיקון נתונים משפיע על החישוב", () => {
  it("payment שתוקן ל־25 נספר כ־25, redeem מוחרג לא נספר", () => {
    const txs = [
      // תיקון 23.3.2024 מיושם כבר ב־effectiveAmount/excludedFromStats בזמן הייבוא
      tx({ playerName: "Lidor Horovitz", type: "payment", rawAmount: 2500, effectiveAmount: 25, occurredAt: at("2026-07-07T22:00:00") }),
      tx({ playerName: "Lidor Horovitz", type: "redeem", rawAmount: -2475, effectiveAmount: -2475, excludedFromStats: true, occurredAt: at("2026-07-08T01:00:00") }),
    ];
    const stats = computeDashboardStats(txs, JULY);
    expect(stats.totalPayments).toBe(25);
    expect(stats.totalRedeems).toBe(0); // ה־redeem המוחרג לא נספר
  });
});

// ---------------------------------------------------------------------------
// בדיקת רגרסיה — יולי 2026
// ה־xlsx המקורי אינו בריפו; ה־fixture משחזר את הערכים הצפויים (2 משחקים,
// 11 שחקנים, ₪1,653 כניסות / ₪1,650 זכיות) ומגן על נכונות הצנרת מקצה לקצה.
// כולל משחק יוני שחייב להיות מוחרג, וכל שורות ה־redeem חולקות טלפון זהה.
// ---------------------------------------------------------------------------
describe("רגרסיה: הנמושות — יולי 2026", () => {
  const SHARED_REDEEM_PHONE = "972503331337";

  // [שם, paid במשחק A, paid במשחק B, received כולל, המשחק בו נרשם ה־redeem]
  const TABLE: Array<[string, number, number, number, "A" | "B"]> = [
    ["אורן לוי", 75, 75, 523, "B"],
    ["Gal Righter", 75, 75, 510, "B"],
    ["Lidor Horovitz", 100, 75, 303, "B"],
    ["רועי פלדמן", 75, 53, 133, "B"],
    ["יובל לאב", 50, 25, 30, "B"],
    ["עמית זיו", 50, 50, 25, "B"],
    ["David Salama", 50, 50, 25, "B"],
    ["אורן בן-יזרי", 100, 0, 10, "A"],
    ["אברהם אלפסי", 125, 0, 25, "A"],
    ["Gil Armon", 0, 250, 35, "B"],
    ["דדי יונני", 0, 300, 31, "B"],
  ];

  function buildFixture(): TransactionForStats[] {
    const rows: TransactionForStats[] = [];
    let n = 0;
    const uid = (p: string) => `${p}-${(n += 1)}`;
    const A_PAY = "2026-07-07T22:00:00";
    const B_PAY = "2026-07-11T22:00:00";
    const A_REDEEM = "2026-07-08T01:00:00"; // אחרי חצות — עדיין משחק A
    const B_REDEEM = "2026-07-12T01:00:00"; // אחרי חצות — עדיין משחק B

    for (const [name, paidA, paidB, received, redeemGame] of TABLE) {
      if (paidA > 0) {
        rows.push(tx({ id: uid("pa"), playerName: name, phone: "05000000", type: "payment", rawAmount: paidA, effectiveAmount: paidA, occurredAt: at(A_PAY) }));
      }
      if (paidB > 0) {
        rows.push(tx({ id: uid("pb"), playerName: name, phone: "05000000", type: "payment", rawAmount: paidB, effectiveAmount: paidB, occurredAt: at(B_PAY) }));
      }
      if (received > 0) {
        rows.push(
          tx({
            id: uid("r"),
            playerName: name,
            phone: SHARED_REDEEM_PHONE, // כל ה־redeem חולקים טלפון — חייב להתחלק לפי שם
            type: "redeem",
            rawAmount: -received,
            effectiveAmount: -received,
            occurredAt: at(redeemGame === "A" ? A_REDEEM : B_REDEEM),
          })
        );
      }
    }

    // משחק יוני שהתחיל 30.6 — חייב להיות מוחרג מטווח יולי (startAt ביוני)
    rows.push(tx({ id: "june-p1", playerName: "יוני א", effectiveAmount: 500, occurredAt: at("2026-06-30T22:00:00") }));
    rows.push(tx({ id: "june-p2", playerName: "יוני ב", effectiveAmount: 500, occurredAt: at("2026-07-01T00:30:00") }));
    rows.push(tx({ id: "june-r", playerName: "יוני א", type: "redeem", effectiveAmount: -900, occurredAt: at("2026-07-01T02:00:00") }));

    return rows;
  }

  it("סטטיסטיקות כלליות תואמות", () => {
    const stats = computeDashboardStats(buildFixture(), JULY);
    expect(stats.gamesCount).toBe(2);
    expect(stats.totalPayments).toBe(1653);
    expect(stats.totalRedeems).toBe(1650);
    expect(stats.accountingDiff).toBe(3);
    expect(stats.playersCount).toBe(11);
    expect(stats.averagePot).toBeCloseTo(826.5, 2);
    expect(stats.averagePlayersPerGame).toBeCloseTo(9.0, 2);
    expect(stats.averageEntriesPerGame).toBeCloseTo(33.06, 2);
    expect(stats.totalPayments / ENTRY_FEE).toBeCloseTo(66.12, 2);
  });

  it("דירוג נטו תואם", () => {
    const stats = computeDashboardStats(buildFixture(), JULY);
    const ranking = stats.players.map((p) => [p.playerName, p.net] as const);
    expect(ranking).toEqual([
      ["אורן לוי", 373],
      ["Gal Righter", 360],
      ["Lidor Horovitz", 128],
      ["רועי פלדמן", 5],
      ["יובל לאב", -45],
      ["עמית זיו", -75],
      ["David Salama", -75],
      ["אורן בן-יזרי", -90],
      ["אברהם אלפסי", -100],
      ["Gil Armon", -215],
      ["דדי יונני", -269],
    ]);
  });

  it("אורן לוי לא מקבל את כל הזכיות (באג הטלפון תוקן)", () => {
    const stats = computeDashboardStats(buildFixture(), JULY);
    const oren = stats.players.find((p) => p.playerName === "אורן לוי");
    expect(oren?.received).toBe(523);
    expect(oren?.net).not.toBe(2292);
    // אין שחקן שבלע את כל 1650 הזכיות
    expect(stats.players.every((p) => p.received < 1650)).toBe(true);
  });
});

describe("זכאות לפי כל התקופה (הסתרת מזדמנים)", () => {
  // 10 משחקים לשחקן "קבוע" (5 ביוני, 5 ביולי), משחק אחד בלבד ל"מזדמן".
  function buildAllTimeFixture(): TransactionForStats[] {
    const rows: TransactionForStats[] = [];
    const days = [
      "2026-06-01", "2026-06-03", "2026-06-05", "2026-06-07", "2026-06-09",
      "2026-07-01", "2026-07-03", "2026-07-05", "2026-07-07", "2026-07-09",
    ];
    days.forEach((d) => {
      rows.push(tx({ playerName: "קבוע", effectiveAmount: 25, occurredAt: at(`${d}T20:00:00`) }));
    });
    // מזדמן משחק רק במשחק הראשון
    rows.push(tx({ playerName: "מזדמן", effectiveAmount: 25, occurredAt: at("2026-06-01T20:30:00") }));
    return rows;
  }

  it("allTimeGamesAttended סופר משחק פעם אחת לשחקן, על פני כל התקופה", () => {
    const counts = allTimeGamesAttended(buildAllTimeFixture());
    expect(counts.get("קבוע")).toBe(10);
    expect(counts.get("מזדמן")).toBe(1);
  });

  it("regularPlayerKeys כולל רק שחקנים עם 10+ משחקים בכל התקופה", () => {
    const keys = regularPlayerKeys(buildAllTimeFixture());
    expect(keys.has("קבוע")).toBe(true);
    expect(keys.has("מזדמן")).toBe(false);
  });

  it("קבוע נשאר זכאי גם בטווח קצר שבו שיחק פחות מ־10 משחקים", () => {
    const fixture = buildAllTimeFixture();
    const keys = regularPlayerKeys(fixture);
    // טווח יוני בלבד — לקבוע יש בו 5 משחקים בלבד, אך הוא עדיין קבוע
    const juneBounds = rangeToBounds({ from: "2026-06-01", to: "2026-06-30" });
    const stats = computeDashboardStats(fixture, juneBounds);
    const kavua = stats.players.find((p) => p.playerName === "קבוע");
    expect(kavua?.gamesAttended).toBe(5); // בטווח בלבד
    // הסינון לתצוגה — לפי הזכאות מכל התקופה — עדיין מכיל אותו
    const shown = stats.players.filter((p) => keys.has(p.playerKey));
    expect(shown.map((p) => p.playerName)).toContain("קבוע");
    expect(shown.map((p) => p.playerName)).not.toContain("מזדמן");
  });
});
