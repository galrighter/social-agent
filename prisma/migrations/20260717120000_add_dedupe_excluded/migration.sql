-- AlterTable: mark a transaction as excluded because it is a redundant
-- identity-duplicate (same player/phone/type/amount/second as another row,
-- differing only in the cosmetic notes column). Kept separate from
-- excludedFromStats so re-applying data corrections never clears it.
ALTER TABLE "Transaction" ADD COLUMN "dedupeExcluded" BOOLEAN NOT NULL DEFAULT false;
