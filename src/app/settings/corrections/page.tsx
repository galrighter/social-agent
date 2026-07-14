import PokerLayout from "@/components/PokerLayout";
import CorrectionsClient from "./CorrectionsClient";

export const dynamic = "force-dynamic";

export default function CorrectionsPage() {
  return (
    <PokerLayout active="/settings/corrections">
      <header className="mb-6 text-center">
        <h1 className="text-2xl font-extrabold text-white sm:text-3xl">תיקוני נתונים</h1>
        <p className="gold-heading mt-1 text-sm font-bold">
          תיקונים מוחלים לפני חישוב הסטטיסטיקות — בלי לשנות את הנתונים המקוריים
        </p>
      </header>
      <CorrectionsClient />
    </PokerLayout>
  );
}
