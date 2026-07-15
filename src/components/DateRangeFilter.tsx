"use client";

import { useCallback, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  defaultRange,
  previousMonthRange,
  yearToDateRange,
  type DateRange,
} from "@/lib/dateRange";

type QuickKey = "month" | "prevMonth" | "ytd" | "all" | "custom";

export default function DateRangeFilter({
  from,
  to,
  allTime,
}: {
  from: string;
  to: string;
  allTime: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [customOpen, setCustomOpen] = useState(false);
  const [customFrom, setCustomFrom] = useState(from);
  const [customTo, setCustomTo] = useState(to);

  const navigate = useCallback(
    (params: { from?: string; to?: string; all?: boolean }) => {
      const query = new URLSearchParams(searchParams.toString());
      if (params.all) {
        query.set("from", "all");
        query.delete("to");
      } else if (params.from && params.to) {
        query.set("from", params.from);
        query.set("to", params.to);
      }
      router.push(`${pathname}?${query.toString()}`);
    },
    [router, pathname, searchParams]
  );

  const applyRange = useCallback(
    (range: DateRange) => {
      setCustomOpen(false);
      navigate(range);
    },
    [navigate]
  );

  const activeQuick: QuickKey = useMemo(() => {
    if (customOpen) return "custom";
    if (allTime) return "all";
    const month = defaultRange();
    if (from === month.from && to === month.to) return "month";
    const prev = previousMonthRange();
    if (from === prev.from && to === prev.to) return "prevMonth";
    const ytd = yearToDateRange();
    if (from === ytd.from && to === ytd.to) return "ytd";
    return "custom";
  }, [from, to, allTime, customOpen]);

  const quickButtons: { key: QuickKey; label: string; onClick: () => void }[] = [
    { key: "month", label: "מתחילת החודש", onClick: () => applyRange(defaultRange()) },
    { key: "prevMonth", label: "חודש קודם", onClick: () => applyRange(previousMonthRange()) },
    { key: "ytd", label: "מתחילת השנה", onClick: () => applyRange(yearToDateRange()) },
    {
      key: "all",
      label: "כל התקופה",
      onClick: () => {
        setCustomOpen(false);
        navigate({ all: true });
      },
    },
    { key: "custom", label: "טווח מותאם", onClick: () => setCustomOpen((v) => !v) },
  ];

  return (
    <div className="mb-6 rounded-2xl border border-poker-gold/40 bg-black/25 p-3 sm:p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-bold text-poker-cream/90">טווח תאריכים:</span>
        {quickButtons.map((btn) => (
          <button
            key={btn.key}
            type="button"
            onClick={btn.onClick}
            className={`quick-range-btn ${activeQuick === btn.key ? "quick-range-btn-active" : ""}`}
          >
            {btn.label}
          </button>
        ))}
      </div>
      {customOpen ? (
        <form
          className="mt-3 flex flex-wrap items-end gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (customFrom && customTo) applyRange({ from: customFrom, to: customTo });
          }}
        >
          <label className="flex flex-col gap-1 text-xs font-semibold text-poker-cream/80">
            מתאריך
            <input
              type="date"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
              className="field-input"
              required
            />
          </label>
          <label className="flex flex-col gap-1 text-xs font-semibold text-poker-cream/80">
            עד תאריך
            <input
              type="date"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
              className="field-input"
              required
            />
          </label>
          <button
            type="submit"
            className="rounded-lg bg-poker-gold px-4 py-1.5 text-sm font-extrabold text-poker-text transition hover:brightness-110"
          >
            החל
          </button>
        </form>
      ) : null}
      <p className="mt-2 text-xs text-poker-cream/50">הסינון מתבצע לפי תאריך תחילת המשחק.</p>
    </div>
  );
}
