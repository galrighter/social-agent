"use client";

import { useCallback, useEffect, useState } from "react";
import { apiUrl } from "@/lib/basePath";

interface Correction {
  id: string;
  name: string;
  enabled: boolean;
  matchPlayerName: string | null;
  matchPhone: string | null;
  matchType: string | null;
  matchOccurredAt: string | null;
  matchRawAmount: number | null;
  effectiveAmount: number | null;
  excludeFromStats: boolean;
  note: string | null;
}

const EMPTY_FORM = {
  name: "",
  matchPlayerName: "",
  matchPhone: "",
  matchType: "",
  matchOccurredAt: "",
  matchRawAmount: "",
  effectiveAmount: "",
  excludeFromStats: false,
  note: "",
};

export default function CorrectionsClient() {
  const [corrections, setCorrections] = useState<Correction[]>([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(apiUrl("/api/corrections"));
    if (res.ok) setCorrections(await res.json());
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const toggle = useCallback(
    async (correction: Correction) => {
      setSaving(true);
      try {
        const res = await fetch(apiUrl("/api/corrections"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: correction.id, enabled: !correction.enabled }),
        });
        if (res.ok) {
          const data = await res.json();
          setMessage(`עודכן · ${data.affectedTransactions} עסקאות חושבו מחדש`);
          load();
        }
      } finally {
        setSaving(false);
      }
    },
    [load]
  );

  const submit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setSaving(true);
      setMessage(null);
      try {
        const res = await fetch(apiUrl("/api/corrections"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
        const data = await res.json();
        if (!res.ok) {
          setMessage(data.error ?? "השמירה נכשלה");
        } else {
          setMessage(`התיקון נוסף · ${data.affectedTransactions} עסקאות חושבו מחדש`);
          setForm(EMPTY_FORM);
          setFormOpen(false);
          load();
        }
      } finally {
        setSaving(false);
      }
    },
    [form, load]
  );

  return (
    <div className="space-y-4">
      {message ? (
        <div className="rounded-xl border border-poker-gold/50 bg-black/25 p-3 text-center text-sm font-bold text-poker-cream">
          {message}
        </div>
      ) : null}

      <div className="poker-card">
        <div className="panel-header-gold flex items-center justify-between px-4 py-3">
          <h3 className="text-base font-extrabold sm:text-lg">רשימת תיקונים</h3>
          <button
            type="button"
            onClick={() => setFormOpen((v) => !v)}
            className="rounded-full bg-white/20 px-4 py-1 text-sm font-extrabold text-white transition hover:bg-white/30"
          >
            {formOpen ? "ביטול" : "+ תיקון חדש"}
          </button>
        </div>

        {formOpen ? (
          <form onSubmit={submit} className="grid gap-3 border-b border-poker-goldBorder/30 bg-poker-panel2 p-4 sm:grid-cols-2 lg:grid-cols-3">
            <label className="flex flex-col gap-1 text-xs font-bold text-poker-text/70">
              שם התיקון *
              <input
                type="text"
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="field-input"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs font-bold text-poker-text/70">
              התאמה: שם שחקן
              <input
                type="text"
                value={form.matchPlayerName}
                onChange={(e) => setForm({ ...form, matchPlayerName: e.target.value })}
                className="field-input"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs font-bold text-poker-text/70">
              התאמה: טלפון
              <input
                type="text"
                value={form.matchPhone}
                onChange={(e) => setForm({ ...form, matchPhone: e.target.value })}
                className="field-input"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs font-bold text-poker-text/70">
              התאמה: סוג
              <select
                value={form.matchType}
                onChange={(e) => setForm({ ...form, matchType: e.target.value })}
                className="field-input"
              >
                <option value="">ללא</option>
                <option value="payment">תשלום</option>
                <option value="redeem">זכייה</option>
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs font-bold text-poker-text/70">
              התאמה: תאריך ושעה (עד שנייה)
              <input
                type="text"
                dir="ltr"
                placeholder="2024-03-23T23:33:21"
                value={form.matchOccurredAt}
                onChange={(e) => setForm({ ...form, matchOccurredAt: e.target.value })}
                className="field-input"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs font-bold text-poker-text/70">
              התאמה: סכום מקורי
              <input
                type="number"
                step="any"
                dir="ltr"
                value={form.matchRawAmount}
                onChange={(e) => setForm({ ...form, matchRawAmount: e.target.value })}
                className="field-input"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs font-bold text-poker-text/70">
              סכום אפקטיבי חדש (אופציונלי)
              <input
                type="number"
                step="any"
                dir="ltr"
                value={form.effectiveAmount}
                onChange={(e) => setForm({ ...form, effectiveAmount: e.target.value })}
                className="field-input"
              />
            </label>
            <label className="flex items-center gap-2 text-xs font-bold text-poker-text/70">
              <input
                type="checkbox"
                checked={form.excludeFromStats}
                onChange={(e) => setForm({ ...form, excludeFromStats: e.target.checked })}
              />
              להחריג מהסטטיסטיקות
            </label>
            <label className="flex flex-col gap-1 text-xs font-bold text-poker-text/70 sm:col-span-2">
              הערה
              <input
                type="text"
                value={form.note}
                onChange={(e) => setForm({ ...form, note: e.target.value })}
                className="field-input"
              />
            </label>
            <div className="flex items-end">
              <button
                type="submit"
                disabled={saving}
                className="rounded-lg bg-poker-green px-5 py-2 font-bold text-white transition hover:brightness-110 disabled:opacity-50"
              >
                {saving ? "שומר…" : "שמירת תיקון"}
              </button>
            </div>
          </form>
        ) : null}

        {corrections.length === 0 ? (
          <div className="px-4 py-6 text-center text-sm text-poker-text/50">אין תיקונים</div>
        ) : (
          <ul className="divide-y divide-poker-goldBorder/20">
            {corrections.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <div className="font-bold text-poker-text">{c.name}</div>
                  <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-poker-text/55">
                    {c.matchPlayerName ? <span>שחקן: {c.matchPlayerName}</span> : null}
                    {c.matchType ? <span>סוג: {c.matchType}</span> : null}
                    {c.matchOccurredAt ? <span dir="ltr">{c.matchOccurredAt}</span> : null}
                    {c.matchRawAmount !== null ? (
                      <span dir="ltr">סכום: {c.matchRawAmount}</span>
                    ) : null}
                    {c.effectiveAmount !== null ? (
                      <span dir="ltr">← אפקטיבי: {c.effectiveAmount}</span>
                    ) : null}
                    {c.excludeFromStats ? (
                      <span className="font-bold text-poker-red">מוחרג מסטטיסטיקות</span>
                    ) : null}
                  </div>
                  {c.note ? <div className="mt-0.5 text-xs text-poker-text/45">{c.note}</div> : null}
                </div>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => toggle(c)}
                  className={`rounded-full px-4 py-1 text-xs font-extrabold transition disabled:opacity-50 ${
                    c.enabled
                      ? "bg-poker-success/15 text-poker-success hover:bg-poker-success/25"
                      : "bg-gray-200 text-gray-500 hover:bg-gray-300"
                  }`}
                >
                  {c.enabled ? "פעיל ✓" : "כבוי"}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
