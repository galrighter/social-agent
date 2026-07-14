import { describe, expect, it } from "vitest";
import { applyCorrections, SEED_CORRECTIONS } from "@/lib/corrections";

const at = (iso: string) => new Date(iso + "Z");

describe("תיקון הנתונים של 23.3.2024", () => {
  it("payment של 2500 מקבל effectiveAmount של 25", () => {
    const outcome = applyCorrections(
      {
        playerName: "Lidor Horovitz",
        phone: null,
        type: "payment",
        rawAmount: 2500,
        occurredAt: at("2024-03-23T23:33:21"),
      },
      SEED_CORRECTIONS
    );
    expect(outcome.effectiveAmount).toBe(25);
    expect(outcome.excludedFromStats).toBe(false);
    expect(outcome.appliedCorrections).toHaveLength(1);
  });

  it("redeem של -2475 מוחרג מהסטטיסטיקות", () => {
    const outcome = applyCorrections(
      {
        playerName: "Lidor Horovitz",
        phone: null,
        type: "redeem",
        rawAmount: -2475,
        occurredAt: at("2024-03-23T23:34:43"),
      },
      SEED_CORRECTIONS
    );
    expect(outcome.excludedFromStats).toBe(true);
    expect(outcome.appliedCorrections).toHaveLength(1);
  });

  it("שורה רגילה של אותו שחקן לא מושפעת", () => {
    const outcome = applyCorrections(
      {
        playerName: "Lidor Horovitz",
        phone: null,
        type: "payment",
        rawAmount: 25,
        occurredAt: at("2024-03-23T20:00:00"),
      },
      SEED_CORRECTIONS
    );
    expect(outcome.effectiveAmount).toBe(25);
    expect(outcome.excludedFromStats).toBe(false);
    expect(outcome.appliedCorrections).toHaveLength(0);
  });

  it("תיקון כבוי לא חל", () => {
    const disabled = SEED_CORRECTIONS.map((r) => ({ ...r, enabled: false }));
    const outcome = applyCorrections(
      {
        playerName: "Lidor Horovitz",
        phone: null,
        type: "payment",
        rawAmount: 2500,
        occurredAt: at("2024-03-23T23:33:21"),
      },
      disabled
    );
    expect(outcome.effectiveAmount).toBe(2500);
  });

  it("ההתאמה לא תלויה ברישיות או ברווחים בשם", () => {
    const outcome = applyCorrections(
      {
        playerName: "  lidor  horovitz ",
        phone: null,
        type: "payment",
        rawAmount: 2500,
        occurredAt: at("2024-03-23T23:33:21"),
      },
      SEED_CORRECTIONS
    );
    expect(outcome.effectiveAmount).toBe(25);
  });
});
