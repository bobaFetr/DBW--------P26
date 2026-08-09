/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "export",
  generateBuildId: async () => "paralyze-static",
  trailingSlash: true,
  images: {
    unoptimized: true
  }
};

export default nextConfig;
