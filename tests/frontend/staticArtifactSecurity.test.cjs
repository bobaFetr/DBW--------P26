const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { inspectStaticFiles } = require("../../scripts/static-artifact-security.cjs");

function fixture(t, files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "paralyze-static-security-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  for (const [name, source] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(root, name)), { recursive: true });
    fs.writeFileSync(path.join(root, name), source);
  }
  return root;
}

test("approved static files and external scripts can be published", (t) => {
  const root = fixture(t, { "index.html": '<script src="/site.js"></script>', "site.js": "console.log('public');", "_headers": "/*", "robots.txt": "User-agent: *" });
  assert.deepEqual(inspectStaticFiles(root, { exported: true }), []);
});

test("publication rejects admin, secrets, maps, backups and server binaries", (t) => {
  const root = fixture(t, { "admin/index.html": "admin", ".env": "SECRET=example", "site.js.map": "{}", "backup.sql": "backup", "server.dll": "binary", "appsettings.json": "{}" });
  assert.equal(inspectStaticFiles(root).length, 6);
});

test("private credentials inside allowed files are rejected without printing their values", (t) => {
  const root = fixture(t, { "leak.js": 'const connection="postgresql://user:example-password@host/db";', "key.css": "-----BEGIN PRIVATE KEY-----" });
  const findings = inspectStaticFiles(root);
  assert.equal(findings.length, 2);
  assert.ok(findings.every((finding) => !finding.includes("example-password")));
});

test("export rejects inline executable scripts", (t) => {
  const root = fixture(t, { "index.html": "<script>window.secret = 1;</script>" });
  assert.equal(inspectStaticFiles(root, { exported: true }).length, 1);
});

test("an orphaned admin JavaScript bundle blocks publication too", (t) => {
  const root = fixture(t, { "_next/static/chunks/app/admin/page.js": "admin code" });
  assert.equal(inspectStaticFiles(root, { exported: true }).length, 1);
});
