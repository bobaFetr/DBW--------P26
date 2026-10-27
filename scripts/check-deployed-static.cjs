// Read-only, bounded public deployment checks. Never prints response bodies.
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const origin = "https://paralyze-site.onrender.com";
const root = path.resolve(__dirname, "..");
const pages = ["/", "/albums/", "/singles/", "/news/", "/concerts/", "/members/", "/timeline/", "/gallery/", "/airbrush-board/", "/about/", "/merch/", "/privacy-policy/"];
const privatePaths = ["/admin/", "/admin/index.html", "/.env", "/.env.local", "/.git/config", "/package.json", "/package-lock.json", "/appsettings.json", "/Back%20End/MyApi/appsettings.Development.json", "/next.config.mjs", "/SECURITY_DEPLOYMENT_REVIEW.md", "/api/auth/me", "/api/content/news"];
const headers = ["content-security-policy", "strict-transport-security", "x-content-type-options", "x-frame-options", "referrer-policy", "permissions-policy"];
const report = { checkedAt: new Date().toISOString(), origin, pages: [], privatePaths: [], assets: [], sourceMaps: [], oldAdminBundles: [] };
const assets = new Set();
const hash = (value) => crypto.createHash("sha256").update(value).digest("hex");
async function get(url) {
  const response = await fetch(url, { redirect: "manual", signal: AbortSignal.timeout(20000) });
  const body = await response.text();
  return { response, body };
}
async function batch(items, action) {
  for (let index = 0; index < items.length; index += 4) {
    await Promise.all(items.slice(index, index + 4).map(async (item) => {
      try { await action(item); } catch (error) { report.errors ??= []; report.errors.push({ item, error: error.message }); }
    }));
  }
}
async function main() {
  const redirect = await fetch("http://paralyze-site.onrender.com/", { redirect: "manual", signal: AbortSignal.timeout(20000) });
  report.httpRedirect = { status: redirect.status, location: redirect.headers.get("location") };
  await batch(pages, async (route) => {
    const { response, body } = await get(origin + route);
    const local = path.join(root, "out", route, "index.html");
    const scripts = [...body.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)];
    const inlineScripts = scripts.filter(([, attributes, source]) => source.trim() || !/\bsrc\s*=/.test(attributes)).length;
    for (const [, source] of body.matchAll(/(?:src|href)="([^"]+)"/g)) {
      const url = new URL(source.replaceAll("&amp;", "&"), origin);
      if (url.origin === origin && /\.(?:js|css|ico|png|jpe?g|webp|gif)(?:\?|$)/i.test(url.pathname)) assets.add(url.href);
    }
    report.pages.push({ route, status: response.status, headers: Object.fromEntries(headers.map((name) => [name, response.headers.get(name)])), inlineScripts, title: body.match(/<title>([^<]*)<\/title>/)?.[1], matchesLocalOutput: fs.existsSync(local) ? hash(body) === hash(fs.readFileSync(local)) : null });
  });
  await batch(privatePaths, async (route) => {
    const { response, body } = await get(origin + route);
    report.privatePaths.push({ route, status: response.status, contentType: response.headers.get("content-type"), htmlErrorPage: /<!doctype html|<html/i.test(body), sensitivePattern: /-----BEGIN (?:[A-Z]+ )*PRIVATE KEY-----|\[core\]|"ConnectionStrings"|"SeedUsers"|"dependencies"\s*:/i.test(body) });
  });
  await batch([...assets], async (url) => {
    const { response, body } = await get(url);
    const pathname = new URL(url).pathname;
    const textAsset = /\.(?:js|css)$/.test(pathname);
    const local = path.join(root, "out", pathname);
    report.assets.push({ path: pathname, status: response.status, matchesLocalOutput: textAsset && fs.existsSync(local) ? hash(body) === hash(fs.readFileSync(local)) : null, adminCode: textAsset && /paralyze\.adminSessionRole|register-content-admin-request/.test(body), privateKeyOrConnection: textAsset && /-----BEGIN (?:[A-Z]+ )*PRIVATE KEY-----|postgres(?:ql)?:\/\/[^\s"'<>]+:[^\s"'<>]+@/i.test(body), localhostApi: textAsset && /https?:\/\/(?:localhost|127\.0\.0\.1):5001/.test(body), sourceMapReference: textAsset && /sourceMappingURL\s*=/.test(body) });
  });
  const scriptUrls = [...assets].filter((url) => /\.js$/.test(new URL(url).pathname));
  await batch(scriptUrls, async (url) => {
    const response = await fetch(url + ".map", { redirect: "manual", signal: AbortSignal.timeout(20000) });
    const body = await response.text();
    report.sourceMaps.push({ path: new URL(url).pathname + ".map", status: response.status, sourceMapBody: /"(?:sources|sourcesContent|mappings)"\s*:/.test(body) });
  });
  const previousAdminDirectory = path.join(root, ".next", "static", "chunks", "app", "admin");
  if (fs.existsSync(previousAdminDirectory)) {
    await batch(fs.readdirSync(previousAdminDirectory).filter((name) => name.endsWith(".js")), async (name) => {
      const route = "/_next/static/chunks/app/admin/" + name;
      const { response } = await get(origin + route);
      report.oldAdminBundles.push({ path: route, status: response.status });
    });
  }
  fs.writeFileSync(path.join(root, "LIVE_SECURITY_CHECK.json"), JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify({ checkedAt: report.checkedAt, httpRedirect: report.httpRedirect, pages: report.pages.map(({ route, status, inlineScripts, matchesLocalOutput }) => ({ route, status, inlineScripts, matchesLocalOutput })), homepageHeaders: report.pages.find((page) => page.route === "/")?.headers, privatePaths: report.privatePaths, assetsChecked: report.assets.length, assetIssues: report.assets.filter((asset) => asset.status !== 200 || asset.adminCode || asset.privateKeyOrConnection || asset.localhostApi || asset.sourceMapReference || asset.matchesLocalOutput === false), sourceMapsChecked: report.sourceMaps.length, sourceMapIssues: report.sourceMaps.filter((map) => map.status === 200 || map.sourceMapBody), oldAdminBundles: report.oldAdminBundles, errors: report.errors ?? [] }, null, 2));
}
async function inspectAdmin() {
  const results = [];
  for (const route of ["/admin/", "/admin/index.html", "/nonexistent-security-check-20261027/"]) {
    const { response, body } = await get(origin + route);
    results.push({ route, status: response.status,
      title: body.match(/<title>([^<]*)/i)?.[1],
      headings: [...body.matchAll(/<h[12][^>]*>(.*?)<\/h[12]>/g)].map((match) => match[1]),
      adminLogin: /Sign in|Admin Login|AdminDashboard|paralyze.adminSessionRole|register-content-admin-request/i.test(body),
      notFound: /404|not found/i.test(body),
      scripts: [...body.matchAll(/<script[^>]+src="([^"]+)/g)].map((match) => match[1])
    });
  }
  const existing = JSON.parse(fs.readFileSync(path.join(root, "LIVE_SECURITY_CHECK.json"), "utf8"));
  existing.adminDetails = results;
  fs.writeFileSync(path.join(root, "LIVE_SECURITY_CHECK.json"), JSON.stringify(existing, null, 2) + "\n");
  console.log(JSON.stringify(results, null, 2));
}
(process.argv.includes("--admin") ? inspectAdmin() : main()).catch((error) => { console.error(error.message); process.exitCode = 1; });
