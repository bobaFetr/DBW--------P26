const fs = require("node:fs");
const path = require("node:path");
const { loadEnvConfig } = require("@next/env");

loadEnvConfig(path.resolve(__dirname, ".."));

if (process.env.ENABLE_LOCAL_ADMIN === "true") {
  console.log("Keeping /admin/ in the static output because local admin is enabled.");
  process.exit(0);
}

const outputDirectory = path.resolve(__dirname, "..", "out");
for (const relative of ["admin", "_next/static/chunks/app/admin"]) {
  const adminDirectory = path.resolve(outputDirectory, relative);
  const withinOutput = path.relative(outputDirectory, adminDirectory);
  if (!withinOutput || withinOutput.startsWith("..") || path.isAbsolute(withinOutput)) {
    throw new Error("Refusing to remove an admin output path outside the static output directory.");
  }
  fs.rmSync(adminDirectory, { recursive: true, force: true });
}
console.log("Removed /admin/ and its JavaScript bundle from static output (local admin is disabled).");
