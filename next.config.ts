import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ['pg', 'bcrypt'],
  allowedDevOrigins: ['http://10.7.157.105:3000'],
  env: {
    DATABASE_URL: process.env.DATABASE_URL!,
    BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET!,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL!,
    AWX_URL: process.env.AWX_URL!,
    AWX_USER: process.env.AWX_USER!,
    AWX_PASSWORD: process.env.AWX_PASSWORD!,
    AWX_TOKEN: process.env.AWX_TOKEN!,
    MAIA_API_URL: process.env.MAIA_API_URL!,
    GROQ_API_KEY: process.env.GROQ_API_KEY!,
    HF_TOKEN: process.env.HF_TOKEN!,
  },
};

export default nextConfig;
