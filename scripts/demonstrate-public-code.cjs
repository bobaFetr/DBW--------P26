// Download public browser assets as data; do not execute downloaded JavaScript.
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const origin = "https://paralyze-site.onrender.com";
const output = path.resolve(__dirname, "..", "public-code-evidence");
const snippets = [];
async function main() {
  fs.mkdirSync(output, { recursive: true });
  const resources = new Set();
  const evidence = [];
  for (const route of ["/", "/airbrush-board/"]) {
    const response = await fetch(origin + route, { signal: AbortSignal.timeout(20000) });
    const html = await response.text();
    const file = route === "/" ? "home.html" : "airbrush.html";
    fs.writeFileSync(path.join(output, file), html);
    evidence.push({ url: origin + route, status: response.status, bytes: Buffer.byteLength(html), file });
    for (const [, source] of html.matchAll(/(?:src|href)="([^"]+\.(?:js|css))"/g)) {
      const url = new URL(source, origin);
      if (url.origin === origin && (url.pathname.includes("/chunks/app/page-") || url.pathname.includes("/chunks/app/airbrush-board/") || url.pathname.includes("/static/css/") || /\/chunks\/\d+-/.test(url.pathname))) {
        resources.add(url.href);
      }
    }
  }
  for (const url of resources) {
    const response = await fetch(url, { signal: AbortSignal.timeout(20000) });
    const source = await response.text();
    const file = path.basename(new URL(url).pathname);
    fs.writeFileSync(path.join(output, file), source);
    evidence.push({ url, status: response.status, bytes: Buffer.byteLength(source), file, sha256: crypto.createHash("sha256").update(source).digest("hex") });
    for (const marker of ["airbrush-board.png", "devicePixelRatio", "Math.random()", "Paralyze basement records", "Blow", "--bg-main", "Latest From Paralyze"]) {
      const index = source.indexOf(marker);
      if (index >= 0 && !snippets.some((item) => item.marker === marker)) {
        snippets.push({ marker, file, url, excerpt: source.slice(Math.max(0, index - 100), index + marker.length + 160) });
      }
    }
  }
  fs.writeFileSync(path.join(output, "evidence.json"), JSON.stringify({ checkedAt: new Date().toISOString(), evidence, snippets }, null, 2) + "\n");
  console.log(JSON.stringify({ evidence, snippets }, null, 2));
}
main().catch((error) => { console.error(error.message); process.exitCode = 1; });
