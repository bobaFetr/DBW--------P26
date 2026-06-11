const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

function loadAdminDraftModule() {
  const sourcePath = path.join(__dirname, "..", "..", "components", "adminDraft.js");
  const source = fs
    .readFileSync(sourcePath, "utf8")
    .replaceAll("export function ", "function ");

  const context = {
    module: { exports: {} },
    exports: {}
  };

  vm.runInNewContext(
    `${source}\nmodule.exports = { displayImageInputValue, isImageDataUrl, isMediaDataUrl, normalizeDraft };`,
    context,
    { filename: sourcePath }
  );

  return context.module.exports;
}

test("normalizeDraft preserves uploaded member image data URLs", () => {
  const { normalizeDraft } = loadAdminDraftModule();
  const dataUrl = "data:image/jpeg;base64,AQIDBA==";

  const result = normalizeDraft(
    {
      fields: [
        { key: "name", required: true },
        { key: "instrument", required: true },
        { key: "photoUrl", required: true, type: "image" }
      ]
    },
    {
      name: "Alex",
      instrument: "Guitar",
      photoUrl: dataUrl
    }
  );

  assert.equal(result.photoUrl, dataUrl);
});

test("normalizeDraft still upgrades manually typed image domains", () => {
  const { normalizeDraft } = loadAdminDraftModule();

  const result = normalizeDraft(
    {
      fields: [{ key: "photoUrl", type: "image" }]
    },
    {
      photoUrl: "example.com/photo.jpg"
    }
  );

  assert.equal(result.photoUrl, "https://example.com/photo.jpg");
});

test("normalizeDraft upgrades manually typed media domains", () => {
  const { normalizeDraft } = loadAdminDraftModule();

  const result = normalizeDraft(
    {
      fields: [{ key: "imageUrl", type: "media" }]
    },
    {
      imageUrl: "example.com/live.mp4"
    }
  );

  assert.equal(result.imageUrl, "https://example.com/live.mp4");
});

test("displayImageInputValue keeps uploaded data out of the visible text input", () => {
  const { displayImageInputValue } = loadAdminDraftModule();

  assert.equal(displayImageInputValue("data:image/png;base64,AQIDBA=="), "");
  assert.equal(displayImageInputValue("data:video/mp4;base64,AQIDBA=="), "");
  assert.equal(displayImageInputValue("https://example.com/photo.jpg"), "https://example.com/photo.jpg");
});
