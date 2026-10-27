const fs = require("node:fs");
const path = require("node:path");

const ALLOWED_EXTENSIONS = new Set([
  ".html", ".js", ".css", ".ico", ".png", ".jpg", ".jpeg", ".webp",
  ".gif", ".svg", ".woff", ".woff2", ".ttf", ".otf", ".xml"
]);
const TEXT_EXTENSIONS = new Set([".html", ".js", ".css", ".svg", ".xml", ".txt"]);
const PRIVATE_CONTENT = /-----BEGIN (?:[A-Z]+ )*PRIVATE KEY-----|(?:postgres(?:ql)?:\/\/)[^\s"'<>]+:[^\s"'<>]+@|(?:AccountKey|SharedAccessKey)=[A-Za-z0-9+/]{30,}={0,2}/i;

function inspectStaticFiles(root, { exported = false } = {}) {
  const problems = [];
  function visit(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const absolute = path.join(directory, entry.name);
      const relative = path.relative(root, absolute).split(path.sep).join("/");
      if (entry.isSymbolicLink()) {
        problems.push(`${relative}: symbolic links are not publishable`);
        continue;
      }
      if (entry.name.startsWith(".") || /^(?:admin|node_modules|back end|scripts|tests)$/i.test(entry.name)) {
        problems.push(`${relative}: private or administrative path`);
        continue;
      }
      if (entry.isDirectory()) {
        visit(absolute);
        continue;
      }
      const extension = path.extname(entry.name).toLowerCase();
      const specialFile = relative === "_headers" || relative === "robots.txt";
      if (!specialFile && !ALLOWED_EXTENSIONS.has(extension)) {
        problems.push(`${relative}: file type is not approved for this static site`);
        continue;
      }
      if (specialFile || TEXT_EXTENSIONS.has(extension)) {
        const source = fs.readFileSync(absolute, "utf8");
        if (PRIVATE_CONTENT.test(source)) {
          problems.push(`${relative}: possible private key or credential (value withheld)`);
        }
        if (exported && extension === ".html") {
          const scripts = [...source.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)];
          if (scripts.some(([, attributes, body]) => body.trim() || !/\bsrc\s*=/.test(attributes))) {
            problems.push(`${relative}: script must be externalized for the production CSP`);
          }
        }
      }
    }
  }
  visit(root);
  return problems;
}

function assertStaticFiles(root, options) {
  const problems = inspectStaticFiles(root, options);
  if (problems.length) {
    throw new Error(`Static publication blocked:\n${problems.join("\n")}`);
  }
}

module.exports = { inspectStaticFiles, assertStaticFiles };
