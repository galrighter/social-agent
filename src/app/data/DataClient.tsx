"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { formatDateTime, formatILS } from "@/lib/format";
import { apiUrl } from "@/lib/basePath";

interface TxRow {
  id: string;
  playerName: string;
  phone: string | null;
  type: string;
  rawAmount: number;
  effectiveAmount: number;
  occurredAt: string;
  notes: string | null;
  sourceFileName: string;
  excludedFromStats: boolean;
}

interface TxResponse {
  total: number;
  page: number;
  pageSize: number;
  rows: TxRow[];
}

const TYPE_LABELS: Record<string, string> = {
  payment: "תשלום",
  redeem: "זכייה",
  unknown: "לא ידוע",
};

export default function DataClient() {
  const searchParams = useSearchParams();
  const batchId = searchParams.get("batchId") ?? "";

  const [search, setSearch] = useState("");
  const [type, setType] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [amount, setAmount] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<TxResponse | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (type) params.set("type", type);
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      if (amount) params.set("amount", amount);
      if (batchId) params.set("batchId", batchId);
      params.set("page", String(page));
      const res = await fetch(apiUrl(`/api/transactions?${params.toString()}`));
      if (res.ok) setData(await res.json());
    } finally {
      setLoading(false);
    }
  }, [search, type, from, to, amount, batchId, page]);

  useEffect(() => {
    load();
  }, [load]);

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <div className="space-y-4">
      {batchId ? (
        <div className="rounded-xl border border-poker-gold/50 bg-black/25 p-3 text-center text-sm font-bold text-poker-cream">
          מציג רק שורות מייבוא נבחר ·{" "}
          <Link href="/data" className="text-poker-gold underline">
            הצג הכול
          </Link>
        </div>
      ) : null}

      {/* סינון */}
      <div className="poker-card flex flex-wrap items-end gap-3 p-4">
        <label className="flex flex-col gap-1 text-xs font-bold text-poker-text/70">
          חיפוש שם
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="שם שחקן…"
            className="field-input w-40"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs font-bold text-poker-text/70">
          סוג
          <select
            value={type}
            onChange={(e) => {
              setType(e.target.value);
              setPage(1);
            }}
            className="field-input"
          >
            <option value="">הכול</option>
            <option value="payment">תשלום</option>
            <option value="redeem">זכייה</option>
            <option value="unknown">לא ידוע</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-bold text-poker-text/70">
          מתאריך
          <input
            type="date"
            value={from}
            onChange={(e) => {
              setFrom(e.target.value);
              setPage(1);
            }}
            className="field-input"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs font-bold text-poker-text/70">
          עד תאריך
          <input
            type="date"
            value={to}
            onChange={(e) => {
              setTo(e.target.value);
              setPage(1);
            }}
            className="field-input"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs font-bold text-poker-text/70">
          סכום מדויק
          <input
            type="number"
            value={amount}
            onChange={(e) => {
              setAmount(e.target.value);
              setPage(1);
            }}
            placeholder="25 / -100"
            className="field-input w-28"
          />
        </label>
      </div>

      {/* טבלה */}
      <div className="poker-card">
        <div className="panel-header-green flex items-center justify-between px-4 py-3">
          <h3 className="text-base font-extrabold sm:text-lg">
            עסקאות {data ? `(${data.total})` : ""}
          </h3>
          {loading ? <span className="text-xs text-poker-cream/70">טוען…</span> : null}
        </div>
        {!data || data.rows.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-poker-text/50">
            {loading ? "טוען…" : "לא נמצאו שורות"}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="bg-poker-panel2 text-xs font-bold text-poker-text/60">
                  <th className="px-4 py-2 text-right">שחקן</th>
                  <th className="px-2 py-2 text-center">טלפון</th>
                  <th className="px-2 py-2 text-center">סוג</th>
                  <th className="px-2 py-2 text-center">סכום מקורי</th>
                  <th className="px-2 py-2 text-center">סכום אפקטיבי</th>
                  <th className="px-2 py-2 text-center">תאריך</th>
                  <th className="px-2 py-2 text-center">בסטטיסטיקות?</th>
                  <th className="px-4 py-2 text-right">הערות</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-poker-goldBorder/20">
                {data.rows.map((tx) => {
                  const corrected =
                    tx.rawAmount !== tx.effectiveAmount || tx.excludedFromStats;
                  return (
                    <tr
                      key={tx.id}
                      className={`hover:bg-poker-panel2/60 ${corrected ? "bg-amber-50" : ""}`}
                    >
                      <td className="px-4 py-2 font-bold text-poker-text">{tx.playerName}</td>
                      <td className="px-2 py-2 text-center text-poker-text/60" dir="ltr">
                        {tx.phone ?? "—"}
                      </td>
                      <td className="px-2 py-2 text-center">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                            tx.type === "payment"
                              ? "bg-green-100 text-poker-success"
                              : tx.type === "redeem"
                                ? "bg-red-50 text-poker-red"
                                : "bg-gray-100 text-gray-500"
                          }`}
                        >
                          {TYPE_LABELS[tx.type] ?? tx.type}
                        </span>
                      </td>
                      <td className="px-2 py-2 text-center font-semibold" dir="ltr">
                        {formatILS(tx.rawAmount)}
                      </td>
                      <td
                        className={`px-2 py-2 text-center font-semibold ${
                          tx.rawAmount !== tx.effectiveAmount ? "soft-loss-text" : ""
                        }`}
                        dir="ltr"
                      >
                        {formatILS(tx.effectiveAmount)}
                      </td>
                      <td className="px-2 py-2 text-center text-poker-text/70" dir="ltr">
                        {formatDateTime(new Date(tx.occurredAt))}
                      </td>
                      <td className="px-2 py-2 text-center">
                        {tx.excludedFromStats ? (
                          <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-bold text-poker-red">
                            מוחרג
                          </span>
                        ) : (
                          <span className="text-xs text-poker-text/50">כן</span>
                        )}
                      </td>
                      <td className="px-4 py-2 text-xs text-poker-text/60">{tx.notes ?? ""}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {data && totalPages > 1 ? (
          <div className="flex items-center justify-center gap-3 border-t border-poker-goldBorder/25 px-4 py-3 text-sm">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              className="rounded-lg border border-poker-goldBorder/50 px-3 py-1 font-bold disabled:opacity-40"
            >
              → הקודם
            </button>
            <span className="font-bold text-poker-text/60">
              עמוד {page} מתוך {totalPages}
            </span>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="rounded-lg border border-poker-goldBorder/50 px-3 py-1 font-bold disabled:opacity-40"
            >
              הבא ←
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
