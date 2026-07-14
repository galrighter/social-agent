import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "פוקר שכונתי – סיכום משחקים",
  description: "דשבורד ניהול וניתוח משחקי פוקר שכונתיים",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl">
      <body className="poker-bg antialiased">{children}</body>
    </html>
  );
}
