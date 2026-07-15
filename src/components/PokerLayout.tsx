import Link from "next/link";

export default function PokerLayout({
  active,
  children,
}: {
  active: string;
  children: React.ReactNode;
}) {
  return (
    <div className="poker-container">
      <nav className="mb-6 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xl suit-decor sm:text-2xl" aria-hidden>
          <span className="text-poker-cream">♠</span>
          <span className="text-red-400">♥</span>
          <span className="text-red-400">♦</span>
          <span className="text-poker-cream">♣</span>
        </div>
        {active === "/import" ? (
          <Link
            href="/dashboard"
            className="rounded-full border border-poker-gold/60 bg-black/20 px-4 py-2 text-sm font-extrabold text-poker-cream transition hover:bg-poker-gold/20"
          >
            → חזרה לדשבורד
          </Link>
        ) : (
          <Link
            href="/import"
            className="rounded-full bg-poker-gold px-4 py-2 text-sm font-extrabold text-poker-text shadow transition hover:brightness-110"
          >
            ⬆ ייבוא קובץ Excel
          </Link>
        )}
      </nav>
      {children}
      <footer className="mt-10 pb-4 text-center text-xs text-poker-cream/50">
        המשחקים זוהו לפי אשכולות של תשלומי כניסה, עם פער של 12+ שעות בין משחקים.
      </footer>
    </div>
  );
}
