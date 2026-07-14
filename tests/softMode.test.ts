import { describe, expect, it } from "vitest";
import { hiddenKeysForSoftMode } from "@/components/FullRankingPanel";

describe("מצב עדין", () => {
  it("מסתיר את שלושת ההפסדים הכוללים הגדולים ביותר", () => {
    const players = [
      { playerKey: "a", playerName: "א", net: 500, gamesAttended: 10, entriesCount: 20 },
      { playerKey: "b", playerName: "ב", net: -100, gamesAttended: 10, entriesCount: 20 },
      { playerKey: "c", playerName: "ג", net: -900, gamesAttended: 10, entriesCount: 20 },
      { playerKey: "d", playerName: "ד", net: -500, gamesAttended: 10, entriesCount: 20 },
      { playerKey: "e", playerName: "ה", net: -300, gamesAttended: 10, entriesCount: 20 },
    ];
    const hidden = hiddenKeysForSoftMode(players);
    expect(hidden).toEqual(new Set(["c", "d", "e"]));
  });

  it("לא מסתיר רווחים גם כשיש פחות מ־3 מפסידים", () => {
    const players = [
      { playerKey: "a", playerName: "א", net: 500, gamesAttended: 5, entriesCount: 10 },
      { playerKey: "b", playerName: "ב", net: -100, gamesAttended: 5, entriesCount: 10 },
    ];
    const hidden = hiddenKeysForSoftMode(players);
    expect(hidden).toEqual(new Set(["b"]));
  });
});
