const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { loadEnvConfig } = require("@next/env");
const { assertStaticFiles } = require("./static-artifact-security.cjs");

const root = path.resolve(__dirname, "..");
loadEnvConfig(root, false);

// A deployment build must not inherit local admin/API settings from .env.local.
const env = {
  ...process.env,
  NODE_ENV: "production",
  ENABLE_LOCAL_ADMIN: "false",
  NEXT_PUBLIC_CONTENT_SOURCE: "temporary",
  NEXT_PUBLIC_LOCAL_ADMIN_OVERLAY: "false",
  NEXT_PUBLIC_API_BASE_URL: "https://api.invalid"
};

function run(file, args = []) {
  const result = spawnSync(process.execPath, [file, ...args], {
    cwd: root, env, stdio: "inherit"
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

assertStaticFiles(path.join(root, "public"));
run(require.resolve("next/dist/bin/next"), ["build"]);
run(path.join(__dirname, "remove-disabled-admin-output.cjs"));
run(path.join(__dirname, "externalize-inline-scripts.cjs"));
assertStaticFiles(path.join(root, "out"), { exported: true });
console.log("Static publication checks passed: admin disabled, local API overlay disabled, artifacts checked.");
