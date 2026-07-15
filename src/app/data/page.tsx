import PokerLayout from "@/components/PokerLayout";
import { requireAuth } from "@/lib/auth";
import DataClient from "./DataClient";

export const dynamic = "force-dynamic";

export default async function DataPage() {
  await requireAuth();
  return (
    <PokerLayout active="/data">
      <header className="mb-6 text-center">
        <h1 className="text-2xl font-extrabold text-white sm:text-3xl">נתונים – עסקאות</h1>
        <p className="gold-heading mt-1 text-sm font-bold">
          חיפוש לפי שם, תאריך, סוג וסכום · השוואת סכום מקורי מול סכום אפקטיבי
        </p>
      </header>
      <DataClient />
    </PokerLayout>
  );
}
