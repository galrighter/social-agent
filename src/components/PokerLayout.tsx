import Link from "next/link";

const NAV_ITEMS = [
  { href: "/dashboard", label: "דשבורד" },
  { href: "/import", label: "ייבוא Excel" },
  { href: "/data", label: "נתונים" },
  { href: "/settings/corrections", label: "תיקוני נתונים" },
];

function Chip({ color, size = 44 }: { color: string; size?: number }) {
  return (
    <span
      className="poker-chip"
      style={{ backgroundColor: color, width: size, height: size }}
      aria-hidden
    />
  );
}

export default function PokerLayout({
  active,
  children,
}: {
  active: string;
  children: React.ReactNode;
}) {
  return (
    <div className="poker-container">
      <nav className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-2xl suit-decor" aria-hidden>
          <span className="text-poker-cream">♠</span>
          <span className="text-red-400">♥</span>
          <span className="text-red-400">♦</span>
          <span className="text-poker-cream">♣</span>
        </div>
        <div className="flex flex-wrap items-center gap-1 rounded-full border border-poker-gold/40 bg-black/20 p-1">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`nav-link ${active === item.href ? "nav-link-active" : ""}`}
            >
              {item.label}
            </Link>
          ))}
        </div>
        <div className="hidden items-center gap-2 sm:flex" aria-hidden>
          <Chip color="#a12a2a" size={34} />
          <Chip color="#1f3a5c" size={40} />
          <Chip color="#d9b45a" size={30} />
        </div>
      </nav>
      {children}
      <footer className="mt-10 pb-4 text-center text-xs text-poker-cream/50">
        המשחקים זוהו לפי אשכולות של תשלומי כניסה, עם פער של 12+ שעות בין משחקים.
      </footer>
    </div>
  );
}
