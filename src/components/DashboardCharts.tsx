"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatILS, formatMonthShort } from "@/lib/format";

interface MonthDatum {
  month: string;
  totalEntriesAmount: number;
  gamesCount: number;
}

interface PlayerDatum {
  playerName: string;
  net: number;
}

interface PotDatum {
  label: string;
  averagePot: number;
}

const AXIS_STYLE = { fontSize: 11, fill: "#4a5d50" };

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="poker-card p-4">
      <h4 className="mb-2 text-sm font-extrabold text-poker-text/70">{title}</h4>
      <div className="h-56" dir="ltr">
        {children}
      </div>
    </div>
  );
}

export default function DashboardCharts({
  months,
  players,
  potOverTime,
}: {
  months: MonthDatum[];
  players: PlayerDatum[];
  potOverTime: PotDatum[];
}) {
  const monthData = months.map((m) => ({ ...m, label: formatMonthShort(m.month) }));
  const potData = potOverTime.map((p) => ({ ...p, label: formatMonthShort(p.label) }));
  const playerData = players.slice(0, 20);

  if (months.length === 0) return null;

  return (
    <section className="mt-8">
      <h2 className="gold-heading mb-4 text-xl font-extrabold sm:text-2xl">גרפים</h2>
      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard title="סך כניסות לפי חודש">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={monthData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e3ddc8" />
              <XAxis dataKey="label" tick={AXIS_STYLE} />
              <YAxis tick={AXIS_STYLE} width={70} tickFormatter={(v) => formatILS(v)} />
              <Tooltip formatter={(v) => formatILS(Number(v))} labelFormatter={(l) => `חודש ${l}`} />
              <Bar dataKey="totalEntriesAmount" name="כניסות" fill="#0b5a2a" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="מספר משחקים לפי חודש">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={monthData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e3ddc8" />
              <XAxis dataKey="label" tick={AXIS_STYLE} />
              <YAxis tick={AXIS_STYLE} width={35} allowDecimals={false} />
              <Tooltip labelFormatter={(l) => `חודש ${l}`} />
              <Bar dataKey="gamesCount" name="משחקים" fill="#d9b45a" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="רווח/הפסד נטו לפי שחקן (Top 20)">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={playerData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e3ddc8" />
              <XAxis
                dataKey="playerName"
                tick={{ ...AXIS_STYLE, fontSize: 9 }}
                interval={0}
                angle={-40}
                textAnchor="end"
                height={70}
              />
              <YAxis tick={AXIS_STYLE} width={70} tickFormatter={(v) => formatILS(v)} />
              <Tooltip formatter={(v) => formatILS(Number(v))} />
              <Bar dataKey="net" name="נטו" radius={[4, 4, 0, 0]}>
                {playerData.map((p) => (
                  <Cell key={p.playerName} fill={p.net >= 0 ? "#147a35" : "#a12a2a"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="התפתחות קופה ממוצעת לאורך זמן">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={potData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e3ddc8" />
              <XAxis dataKey="label" tick={AXIS_STYLE} />
              <YAxis tick={AXIS_STYLE} width={70} tickFormatter={(v) => formatILS(v)} />
              <Tooltip formatter={(v) => formatILS(Number(v))} labelFormatter={(l) => `חודש ${l}`} />
              <Line
                type="monotone"
                dataKey="averagePot"
                name="קופה ממוצעת"
                stroke="#d9b45a"
                strokeWidth={3}
                dot={{ fill: "#0b5a2a", r: 3 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </section>
  );
}
