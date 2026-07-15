import PokerLayout from "@/components/PokerLayout";
import { requireAuth } from "@/lib/auth";
import ImportClient from "./ImportClient";

export const dynamic = "force-dynamic";

export default async function ImportPage() {
  await requireAuth();
  return (
    <PokerLayout active="/import">
      <header className="mb-6 text-center">
        <h1 className="text-2xl font-extrabold text-white sm:text-3xl">ייבוא קובץ Excel</h1>
        <p className="gold-heading mt-1 text-sm font-bold">
          העלאה חוזרת של אותו קובץ לא תיצור כפילויות — רק שורות חדשות נוספות
        </p>
      </header>
      <ImportClient />
    </PokerLayout>
  );
}
