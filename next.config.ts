import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['pg', 'bcrypt'],
  allowedDevOrigins: ['http://10.7.157.105:3000'],
};

export default nextConfig;
