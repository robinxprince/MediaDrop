import type { NextConfig } from "next";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// The app's version comes from the MediaDrop package itself, so the site never drifts from the release.
const appPackage = JSON.parse(readFileSync(join(__dirname, "..", "package.json"), "utf8"));

// GitHub Pages serves a project site from /<repo>. Set PAGES_BASE_PATH="" for a custom domain.
const basePath = process.env.PAGES_BASE_PATH ?? "/MediaDrop";

const nextConfig: NextConfig = {
  output: "export",
  basePath,
  trailingSlash: true,
  images: { unoptimized: true },
  env: {
    NEXT_PUBLIC_APP_VERSION: appPackage.version,
    NEXT_PUBLIC_BASE_PATH: basePath,
  },
};

export default nextConfig;
