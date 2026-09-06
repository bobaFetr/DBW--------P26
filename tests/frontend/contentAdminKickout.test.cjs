const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const ROOT = path.resolve(__dirname, "../..");

test("kicked content admins are returned to login with the revocation message", () => {
  const dashboard = fs.readFileSync(path.join(ROOT, "components", "AdminDashboard.jsx"), "utf8");
  const login = fs.readFileSync(path.join(ROOT, "components", "AdminLogin.jsx"), "utf8");

  assert.match(dashboard, /KICKED_CONTENT_ADMIN_MESSAGE\s*=\s*"Your content admin access has been revoked\."/);
  assert.match(dashboard, /setForcedLogoutNotice\(KICKED_CONTENT_ADMIN_MESSAGE\)/);
  assert.match(dashboard, /<AdminLogin[\s\S]*initialNotice=\{forcedLogoutNotice\}/);
  assert.match(login, /setNotice\(initialNotice\)/);
  assert.match(login, /\{notice\s*&&\s*<p[^>]*>\{notice\}<\/p>\}/);
});
