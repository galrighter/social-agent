import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // לפריסה תחת powdercoat.co.il/playgames — הגדר NEXT_PUBLIC_BASE_PATH=/playgames
  basePath: process.env.NEXT_PUBLIC_BASE_PATH || undefined,
  // פלט standalone: חבילה עצמאית (server.js + node_modules מצומצם) לפריסה בשרת
  output: "standalone",
  // מקבע את שורש ה-tracing לתיקיית האפליקציה — בלי זה, build שרץ בתוך תת-תיקייה
  // (למשל checkout כ-app-src בריפו אחר) מקנן את server.js בתוך .next/standalone/<subdir>/
  outputFileTracingRoot: process.cwd(),
  serverExternalPackages: ["@prisma/client", "prisma"],
};

export default nextConfig;
