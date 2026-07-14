import PokerLayout from "@/components/PokerLayout";
import ImportClient from "./ImportClient";

export const dynamic = "force-dynamic";

export default function ImportPage() {
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
