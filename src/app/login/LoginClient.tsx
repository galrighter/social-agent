"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiUrl } from "@/lib/basePath";

export default function LoginClient() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(apiUrl("/api/login"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      if (res.ok) {
        router.push("/dashboard");
        router.refresh();
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "ההתחברות נכשלה");
      }
    } catch {
      setError("שגיאת תקשורת");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="poker-card w-full max-w-sm p-6 sm:p-8">
      <div className="mb-5 text-center">
        <div className="mb-2 flex items-center justify-center gap-2 text-2xl suit-decor" aria-hidden>
          <span className="text-poker-green">♠</span>
          <span className="text-poker-red">♥</span>
          <span className="text-poker-red">♦</span>
          <span className="text-poker-green">♣</span>
        </div>
        <h1 className="text-2xl font-extrabold text-poker-text">רמי שכונתי</h1>
        <p className="mt-1 text-sm text-poker-text/55">התחברות לצפייה בסיכום</p>
      </div>
      <form onSubmit={submit} className="space-y-3">
        <label className="flex flex-col gap-1 text-sm font-bold text-poker-text/70">
          שם משתמש
          <input
            type="text"
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="field-input"
            required
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-bold text-poker-text/70">
          סיסמה
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="field-input"
            required
          />
        </label>
        {error ? (
          <p className="text-center text-sm font-bold text-poker-red">{error}</p>
        ) : null}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-poker-green px-5 py-2.5 font-extrabold text-white transition hover:brightness-110 disabled:opacity-50"
        >
          {loading ? "מתחבר…" : "כניסה"}
        </button>
      </form>
    </div>
  );
}
