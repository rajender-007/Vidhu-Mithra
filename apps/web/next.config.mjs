import fs from "node:fs";
import path from "node:path";

const projectEnvPath = path.resolve(process.cwd(), "../../.env");
const publicEnv = { NEXT_PUBLIC_API_BASE_URL: "http://localhost:8000" };

if (fs.existsSync(projectEnvPath)) {
  for (const line of fs.readFileSync(projectEnvPath, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*(NEXT_PUBLIC_[A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (match) publicEnv[match[1]] = match[2].replace(/^['"]|['"]$/g, "");
  }
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
  env: publicEnv,
};

export default nextConfig;
