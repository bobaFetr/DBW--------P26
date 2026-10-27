import { PHASE_DEVELOPMENT_SERVER } from "next/constants.js";

/** @type {import('next').NextConfig} */
const sharedConfig = {
  output: "export",
  trailingSlash: true,
  productionBrowserSourceMaps: false,
  poweredByHeader: false,
  images: {
    unoptimized: true
  }
};

export default function nextConfig(phase) {
  return {
    ...sharedConfig,
    // Keep a production build from replacing chunks used by a running dev server.
    distDir: phase === PHASE_DEVELOPMENT_SERVER ? ".next-dev" : ".next"
  };
}
