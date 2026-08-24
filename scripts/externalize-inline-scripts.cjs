const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const OUTPUT = path.join(ROOT, "out");
const SCRIPT_OUTPUT = path.join(OUTPUT, "_next", "static", "inline-csp");

function filesBelow(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);
    return entry.isDirectory() ? filesBelow(entryPath) : [entryPath];
  });
}

function scriptName(source) {
  return `${crypto.createHash("sha256").update(source).digest("hex")}.js`;
}

fs.mkdirSync(SCRIPT_OUTPUT, { recursive: true });

const htmlFiles = filesBelow(OUTPUT).filter((file) => file.endsWith(".html"));
const writtenScripts = new Set();
let replacements = 0;

for (const file of htmlFiles) {
  const html = fs.readFileSync(file, "utf8");
  const externalized = html.replace(
    /<script(\s[^>]*)?>([\s\S]*?)<\/script>/gi,
    (element, attributes = "", source) => {
      if (!source) return element;

      const name = scriptName(source);
      if (!writtenScripts.has(name)) {
        fs.writeFileSync(path.join(SCRIPT_OUTPUT, name), source);
        writtenScripts.add(name);
      }

      replacements += 1;
      return `<script${attributes} src="/_next/static/inline-csp/${name}"></script>`;
    }
  );

  const remainingInlineScript = [...externalized.matchAll(
    /<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi
  )].some((match) => match[1]);

  if (remainingInlineScript) {
    throw new Error(`Inline script remains in ${path.relative(ROOT, file)}`);
  }

  fs.writeFileSync(file, externalized);
}

// This site uses ordinary document navigation. Publishing App Router flight
// payloads beside the HTML lets static CDNs cache an index.txt response for an
// index.html URL, which can expose the serialized React payload in the browser.
const flightFiles = filesBelow(OUTPUT).filter((file) => file.endsWith(".txt"));
for (const file of flightFiles) {
  fs.rmSync(file);
}

console.log(
  `Externalized ${replacements} inline script blocks into ${writtenScripts.size} same-origin files; removed ${flightFiles.length} flight payloads.`
);
