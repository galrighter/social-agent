"use client";

import { useCallback } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

export default function SoftModeToggle({ softMode }: { softMode: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const setMode = useCallback(
    (soft: boolean) => {
      const query = new URLSearchParams(searchParams.toString());
      if (soft) query.delete("softMode");
      else query.set("softMode", "false");
      router.push(`${pathname}?${query.toString()}`);
    },
    [router, pathname, searchParams]
  );

  return (
    <div className="flex items-center gap-1 rounded-full bg-black/20 p-1 text-xs font-bold">
      <button
        type="button"
        onClick={() => setMode(true)}
        className={`rounded-full px-3 py-1 transition ${
          softMode ? "bg-poker-gold text-poker-text" : "text-poker-cream/80 hover:bg-white/10"
        }`}
      >
        מצב עדין
      </button>
      <button
        type="button"
        onClick={() => setMode(false)}
        className={`rounded-full px-3 py-1 transition ${
          !softMode ? "bg-poker-gold text-poker-text" : "text-poker-cream/80 hover:bg-white/10"
        }`}
      >
        מצב רגיל
      </button>
    </div>
  );
}
