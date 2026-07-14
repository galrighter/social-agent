export interface ImportSummaryData {
  fileName: string;
  totalRows: number;
  insertedRows: number;
  skippedDuplicateRows: number;
  invalidRows: number;
  correctionRows: number;
  errors?: string[];
}

function SummaryStat({ value, label, tone }: { value: number; label: string; tone: string }) {
  return (
    <div className="rounded-xl border border-poker-goldBorder/40 bg-poker-panel2 p-3 text-center">
      <div className={`text-2xl font-extrabold ${tone}`}>{value}</div>
      <div className="text-xs font-semibold text-poker-text/60">{label}</div>
    </div>
  );
}

export default function ImportSummaryCard({ summary }: { summary: ImportSummaryData }) {
  return (
    <div className="poker-card p-4 sm:p-5">
      <h3 className="mb-3 flex items-center gap-2 text-lg font-extrabold text-poker-text">
        <span aria-hidden>📥</span>
        סיכום ייבוא: {summary.fileName}
      </h3>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        <SummaryStat value={summary.totalRows} label="שורות נקראו" tone="text-poker-text" />
        <SummaryStat value={summary.insertedRows} label="שורות חדשות נוספו" tone="profit-text" />
        <SummaryStat
          value={summary.skippedDuplicateRows}
          label="דילוגים (כבר קיימות)"
          tone="text-poker-text/60"
        />
        <SummaryStat value={summary.invalidRows} label="שורות לא תקינות" tone="loss-text" />
        <SummaryStat value={summary.correctionRows} label="תיקוני נתונים הופעלו" tone="soft-loss-text" />
      </div>
      {summary.errors && summary.errors.length > 0 ? (
        <details className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-poker-red">
          <summary className="cursor-pointer font-bold">
            שגיאות בקריאת הקובץ ({summary.errors.length})
          </summary>
          <ul className="mt-2 list-inside list-disc space-y-1 text-xs">
            {summary.errors.slice(0, 30).map((err, i) => (
              <li key={i}>{err}</li>
            ))}
            {summary.errors.length > 30 ? <li>ועוד {summary.errors.length - 30} שגיאות…</li> : null}
          </ul>
        </details>
      ) : null}
    </div>
  );
}
