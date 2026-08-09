const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const OUTPUT = path.join(ROOT, "out");
const mode = process.argv[2];

if (!["--verify", "--write"].includes(mode)) {
  console.error("Usage: node scripts/generate-csp-hashes.cjs --verify|--write");
  process.exit(2);
}

function filesBelow(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);
    return entry.isDirectory() ? filesBelow(entryPath) : [entryPath];
  });
}

function sha256(value) {
  return `'sha256-${crypto.createHash("sha256").update(value).digest("base64")}'`;
}

const htmlFiles = filesBelow(OUTPUT).filter((file) => file.endsWith(".html"));
const inlineScripts = new Set();
const inlineStyles = [];

for (const file of htmlFiles) {
  const html = fs.readFileSync(file, "utf8");

  for (const match of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)) {
    if (match[1]) inlineScripts.add(match[1]);
  }

  if (/<style(?:\s[^>]*)?>[\s\S]*?<\/style>/i.test(html) || /\sstyle="[^"]*"/i.test(html)) {
    inlineStyles.push(path.relative(ROOT, file));
  }
}

if (inlineStyles.length) {
  console.error(`Inline styles remain in: ${inlineStyles.join(", ")}`);
  process.exit(1);
}

const hashes = [...inlineScripts].map(sha256).sort();
const scriptDirective = `script-src 'self' ${hashes.join(" ")}`;

function expectedSource(source) {
  return source
    .replace(/script-src 'self'(?: 'unsafe-inline'| 'sha256-[^']+')*/, scriptDirective)
    .replace(/style-src 'self'(?: 'unsafe-inline')?/, "style-src 'self'");
}

const targets = ["render.yaml", path.join("public", "_headers")];
let stale = false;

for (const relativeTarget of targets) {
  const target = path.join(ROOT, relativeTarget);
  const source = fs.readFileSync(target, "utf8");
  const expected = expectedSource(source);

  if (source === expected) continue;
  stale = true;

  if (mode === "--write") {
    fs.writeFileSync(target, expected);
    console.log(`Updated ${relativeTarget}`);
  } else {
    console.error(`${relativeTarget} has stale CSP hashes. Run npm run security:csp.`);
  }
}

if (mode === "--verify" && stale) process.exit(1);
console.log(`CSP permits ${hashes.length} exact inline scripts and no inline styles.`);
