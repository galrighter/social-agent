import { describe, expect, it } from "vitest";
import { clusterGames, computeStats, type StatsTx } from "@/lib/stats";

function tx(partial: Partial<StatsTx> & { occurredAt: Date }): StatsTx {
  return {
    playerKey: "p:0501111111",
    playerName: "שחקן",
    type: "payment",
    effectiveAmount: 25,
    excludedFromStats: false,
    ...partial,
  };
}

const at = (iso: string) => new Date(iso + "Z");

describe("חישוב משחקים (אשכולות 12+ שעות)", () => {
  it("פער של יותר מ־12 שעות פותח משחק חדש", () => {
    const payments = [
      tx({ occurredAt: at("2024-03-23T20:00:00") }),
      tx({ occurredAt: at("2024-03-23T22:00:00") }),
      tx({ occurredAt: at("2024-03-24T01:00:00") }), // 3 שעות מהקודם — אותו משחק
      tx({ occurredAt: at("2024-03-24T20:00:00") }), // 19 שעות — משחק חדש
    ];
    const games = clusterGames(payments);
    expect(games).toHaveLength(2);
    expect(games[0].startAt).toEqual(at("2024-03-23T20:00:00"));
    expect(games[0].endAt).toEqual(at("2024-03-24T01:00:00"));
    expect(games[1].startAt).toEqual(at("2024-03-24T20:00:00"));
  });

  it("פער של בדיוק 12 שעות נשאר באותו משחק", () => {
    const payments = [
      tx({ occurredAt: at("2024-03-23T08:00:00") }),
      tx({ occurredAt: at("2024-03-23T20:00:00") }),
    ];
    expect(clusterGames(payments)).toHaveLength(1);
  });

  it("מחשב שחקנים, סכום וכניסות לכל משחק", () => {
    const payments = [
      tx({ playerKey: "a", occurredAt: at("2024-03-23T20:00:00"), effectiveAmount: 25 }),
      tx({ playerKey: "b", occurredAt: at("2024-03-23T20:05:00"), effectiveAmount: 25 }),
      tx({ playerKey: "a", occurredAt: at("2024-03-23T21:00:00"), effectiveAmount: 50 }),
    ];
    const [game] = clusterGames(payments);
    expect(game.players).toBe(2);
    expect(game.totalEntriesAmount).toBe(100);
    expect(game.entriesCount).toBe(4);
  });
});

describe("חישוב נטו לשחקן", () => {
  it("net = received - paid", () => {
    const transactions = [
      tx({ playerKey: "a", playerName: "אלון", occurredAt: at("2024-03-23T20:00:00"), effectiveAmount: 25 }),
      tx({ playerKey: "a", playerName: "אלון", occurredAt: at("2024-03-23T21:00:00"), effectiveAmount: 25 }),
      tx({
        playerKey: "a",
        playerName: "אלון",
        type: "redeem",
        occurredAt: at("2024-03-24T01:00:00"),
        effectiveAmount: -150,
      }),
    ];
    const stats = computeStats(transactions);
    const player = stats.players.find((p) => p.playerKey === "a");
    expect(player?.paid).toBe(50);
    expect(player?.received).toBe(150);
    expect(player?.net).toBe(100);
  });

  it("avgEntriesPerGame = כניסות / משחקים", () => {
    const transactions = [
      // משחק 1: שתי כניסות (50 ש"ח)
      tx({ playerKey: "a", occurredAt: at("2024-03-23T20:00:00"), effectiveAmount: 25 }),
      tx({ playerKey: "a", occurredAt: at("2024-03-23T22:00:00"), effectiveAmount: 25 }),
      // משחק 2: כניסה אחת
      tx({ playerKey: "a", occurredAt: at("2024-03-30T20:00:00"), effectiveAmount: 25 }),
    ];
    const stats = computeStats(transactions);
    const player = stats.players.find((p) => p.playerKey === "a");
    expect(player?.gamesAttended).toBe(2);
    expect(player?.entriesCount).toBe(3);
    expect(player?.avgEntriesPerGame).toBe(1.5);
  });

  it("avgLossPerGame קיים רק לשחקנים בהפסד", () => {
    const transactions = [
      tx({ playerKey: "a", occurredAt: at("2024-03-23T20:00:00"), effectiveAmount: 100 }),
      tx({ playerKey: "b", occurredAt: at("2024-03-23T20:00:00"), effectiveAmount: 25 }),
      tx({
        playerKey: "b",
        type: "redeem",
        occurredAt: at("2024-03-24T01:00:00"),
        effectiveAmount: -100,
      }),
    ];
    const stats = computeStats(transactions);
    const loser = stats.players.find((p) => p.playerKey === "a");
    const winner = stats.players.find((p) => p.playerKey === "b");
    expect(loser?.avgLossPerGame).toBe(100);
    expect(winner?.avgLossPerGame).toBeNull();
  });

  it("עסקאות מוחרגות לא נספרות", () => {
    const transactions = [
      tx({ playerKey: "a", occurredAt: at("2024-03-23T20:00:00"), effectiveAmount: 25 }),
      tx({
        playerKey: "a",
        occurredAt: at("2024-03-23T21:00:00"),
        effectiveAmount: 1000,
        excludedFromStats: true,
      }),
    ];
    const stats = computeStats(transactions);
    expect(stats.totalPayments).toBe(25);
  });

  it("סטטיסטיקות כלליות: קופה ממוצעת ופער רישומי", () => {
    const transactions = [
      tx({ playerKey: "a", occurredAt: at("2024-03-23T20:00:00"), effectiveAmount: 100 }),
      tx({ playerKey: "b", occurredAt: at("2024-03-23T20:30:00"), effectiveAmount: 100 }),
      tx({
        playerKey: "a",
        type: "redeem",
        occurredAt: at("2024-03-24T01:00:00"),
        effectiveAmount: -150,
      }),
    ];
    const stats = computeStats(transactions);
    expect(stats.totalPayments).toBe(200);
    expect(stats.totalRedeems).toBe(150);
    expect(stats.accountingDiff).toBe(50);
    expect(stats.gamesCount).toBe(1);
    expect(stats.averagePot).toBe(200);
    expect(stats.averageEntriesPerGame).toBe(8);
  });
});
