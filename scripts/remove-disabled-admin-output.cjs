const fs = require("node:fs");
const path = require("node:path");
const { loadEnvConfig } = require("@next/env");

loadEnvConfig(path.resolve(__dirname, ".."));

if (process.env.ENABLE_LOCAL_ADMIN === "true") {
  console.log("Keeping /admin/ in the static output because local admin is enabled.");
  process.exit(0);
}

const outputDirectory = path.resolve(__dirname, "..", "out");
const adminDirectory = path.resolve(outputDirectory, "admin");

if (path.dirname(adminDirectory) !== outputDirectory) {
  throw new Error("Refusing to remove an admin output path outside the static output directory.");
}

fs.rmSync(adminDirectory, { recursive: true, force: true });
console.log("Removed /admin/ from static output (local admin is disabled).");
