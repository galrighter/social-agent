"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import ImportSummaryCard, { type ImportSummaryData } from "@/components/ImportSummaryCard";
import { formatDateTime } from "@/lib/format";
import { apiUrl } from "@/lib/basePath";

interface BatchRow {
  id: string;
  fileName: string;
  uploadedAt: string;
  totalRows: number;
  insertedRows: number;
  skippedDuplicateRows: number;
  invalidRows: number;
  correctionRows: number;
}

interface ImportResponse extends ImportSummaryData {
  batchId: string;
  error?: string;
  /** הקובץ מוגן בסיסמה — צריך לבקש מהמשתמש סיסמה ולנסות שוב. */
  passwordRequired?: boolean;
  /** הסיסמה שנשלחה שגויה (להבדיל מסיסמה שכלל לא נשלחה). */
  wrongPassword?: boolean;
}

export default function ImportClient() {
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [summary, setSummary] = useState<ImportResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [batches, setBatches] = useState<BatchRow[]>([]);
  // הקובץ המוגן ממתין בזיכרון הדפדפן עד שהמשתמש יזין סיסמה — כך אין צורך לבחור אותו מחדש.
  const [lockedFile, setLockedFile] = useState<File | null>(null);
  const [password, setPassword] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  const loadBatches = useCallback(async () => {
    try {
      const res = await fetch(apiUrl("/api/import-batches"));
      if (res.ok) setBatches(await res.json());
    } catch {
      // היסטוריה היא תוספת — כישלון טעינה לא חוסם את הייבוא
    }
  }, []);

  useEffect(() => {
    loadBatches();
  }, [loadBatches]);

  const upload = useCallback(
    async (file: File, filePassword?: string) => {
      setUploading(true);
      setError(null);
      setSummary(null);
      try {
        const formData = new FormData();
        formData.append("file", file);
        if (filePassword) formData.append("password", filePassword);
        const res = await fetch(apiUrl("/api/import"), { method: "POST", body: formData });
        const data: ImportResponse = await res.json();
        if (!res.ok) {
          setError(data.error ?? "הייבוא נכשל");
          if (data.passwordRequired) {
            // שומרים את הקובץ ומציגים שדה סיסמה; סיסמה שגויה מתנקה כדי להזין מחדש.
            setLockedFile(file);
            setPassword("");
          } else {
            setLockedFile(null);
          }
        } else {
          setSummary(data);
          setLockedFile(null);
          setPassword("");
          loadBatches();
        }
      } catch {
        setError("הייבוא נכשל — בעיית תקשורת");
      } finally {
        setUploading(false);
        if (inputRef.current) inputRef.current.value = "";
      }
    },
    [loadBatches]
  );

  // מיקוד אוטומטי בשדה הסיסמה ברגע שמתברר שהקובץ מוגן.
  useEffect(() => {
    if (lockedFile) passwordRef.current?.focus();
  }, [lockedFile]);

  const cancelLocked = useCallback(() => {
    setLockedFile(null);
    setPassword("");
    setError(null);
  }, []);

  return (
    <div className="space-y-5">
      {/* אזור העלאה */}
      <div
        className={`poker-card flex flex-col items-center justify-center gap-3 border-2 border-dashed p-8 text-center transition ${
          dragOver ? "border-poker-gold bg-poker-panel2" : "border-poker-goldBorder/60"
        }`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          const file = e.dataTransfer.files?.[0];
          if (file) upload(file);
        }}
      >
        <div className="text-4xl" aria-hidden>📄</div>
        <p className="font-bold text-poker-text">גרור קובץ Excel לכאן או בחר קובץ</p>
        <p className="text-xs text-poker-text/55">
          עמודות נתמכות: שם, פלאפון, סוג, סכום, תאריך, הערות (xlsx / xls)
        </p>
        <p className="text-xs text-poker-text/45">
          🔒 קובץ מוגן בסיסמה? העלה אותו כרגיל — נבקש את הסיסמה מיד לאחר מכן
        </p>
        <label className="cursor-pointer rounded-lg bg-poker-green px-5 py-2 font-bold text-white transition hover:brightness-110">
          {uploading ? "מייבא…" : "בחירת קובץ"}
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            disabled={uploading}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) upload(file);
            }}
          />
        </label>
      </div>

      {/* קובץ מוגן בסיסמה — הזנת הסיסמה וניסיון חוזר עם אותו קובץ */}
      {lockedFile ? (
        <form
          className="poker-card space-y-3 p-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (password && !uploading) upload(lockedFile, password);
          }}
        >
          <div className="text-center">
            <p className="font-bold text-poker-text">🔒 הקובץ מוגן בסיסמה</p>
            <p className="mt-1 text-xs text-poker-text/60" dir="ltr">
              {lockedFile.name}
            </p>
            {error ? (
              <p className="mt-2 text-sm font-bold text-poker-red">{error}</p>
            ) : null}
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <input
              ref={passwordRef}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={uploading}
              autoComplete="off"
              placeholder="סיסמת הקובץ"
              aria-label="סיסמת הקובץ"
              className="flex-1 rounded-lg border border-poker-goldBorder/60 bg-black/20 px-4 py-2 text-poker-text outline-none focus:border-poker-gold"
            />
            <button
              type="submit"
              disabled={uploading || !password}
              className="rounded-lg bg-poker-green px-5 py-2 font-bold text-white transition hover:brightness-110 disabled:opacity-50"
            >
              {uploading ? "מייבא…" : "פתיחה וייבוא"}
            </button>
            <button
              type="button"
              onClick={cancelLocked}
              disabled={uploading}
              className="rounded-lg border border-poker-goldBorder/60 px-4 py-2 font-bold text-poker-text/70 transition hover:bg-poker-panel2 disabled:opacity-50"
            >
              ביטול
            </button>
          </div>
          <p className="text-center text-xs text-poker-text/45">
            הסיסמה משמשת לפתיחת הקובץ בלבד ואינה נשמרת
          </p>
        </form>
      ) : error ? (
        <div className="poker-card border-poker-red/60 p-4 text-center font-bold text-poker-red">
          {error}
        </div>
      ) : null}

      {summary ? (
        <div className="space-y-3">
          <ImportSummaryCard summary={summary} />
          {summary.insertedRows > 0 ? (
            <div className="text-center">
              <Link
                href={`/data?batchId=${summary.batchId}`}
                className="inline-block rounded-lg border border-poker-gold bg-black/20 px-4 py-2 text-sm font-bold text-poker-cream transition hover:bg-poker-gold/20"
              >
                צפייה בשורות שנוספו בייבוא זה ←
              </Link>
            </div>
          ) : null}
        </div>
      ) : null}

      {/* היסטוריית ייבוא */}
      <div className="poker-card">
        <div className="panel-header-green px-4 py-3">
          <h3 className="text-base font-extrabold sm:text-lg">היסטוריית ייבוא</h3>
        </div>
        {batches.length === 0 ? (
          <div className="px-4 py-6 text-center text-sm text-poker-text/50">
            עדיין לא בוצע ייבוא
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="bg-poker-panel2 text-xs font-bold text-poker-text/60">
                  <th className="px-4 py-2 text-right">קובץ</th>
                  <th className="px-2 py-2 text-center">מועד</th>
                  <th className="px-2 py-2 text-center">נקראו</th>
                  <th className="px-2 py-2 text-center">נוספו</th>
                  <th className="px-2 py-2 text-center">דילוגים</th>
                  <th className="px-2 py-2 text-center">לא תקינות</th>
                  <th className="px-2 py-2 text-center">תיקונים</th>
                  <th className="px-4 py-2 text-center">שורות</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-poker-goldBorder/20">
                {batches.map((b) => (
                  <tr key={b.id} className="hover:bg-poker-panel2/60">
                    <td className="px-4 py-2 font-bold text-poker-text">{b.fileName}</td>
                    <td className="px-2 py-2 text-center text-poker-text/70" dir="ltr">
                      {formatDateTime(new Date(b.uploadedAt))}
                    </td>
                    <td className="px-2 py-2 text-center">{b.totalRows}</td>
                    <td className="px-2 py-2 text-center font-bold profit-text">{b.insertedRows}</td>
                    <td className="px-2 py-2 text-center text-poker-text/60">{b.skippedDuplicateRows}</td>
                    <td className="px-2 py-2 text-center loss-text">{b.invalidRows}</td>
                    <td className="px-2 py-2 text-center soft-loss-text">{b.correctionRows}</td>
                    <td className="px-4 py-2 text-center">
                      {b.insertedRows > 0 ? (
                        <Link
                          href={`/data?batchId=${b.id}`}
                          className="text-xs font-bold text-poker-green underline"
                        >
                          צפייה
                        </Link>
                      ) : (
                        <span className="text-xs text-poker-text/40">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
