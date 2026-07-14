import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // לפריסה תחת powdercoat.co.il/playgames — הגדר NEXT_PUBLIC_BASE_PATH=/playgames
  basePath: process.env.NEXT_PUBLIC_BASE_PATH || undefined,
  serverExternalPackages: ["@prisma/client", "prisma"],
};

export default nextConfig;
