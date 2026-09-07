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
    `${source}\nmodule.exports = { displayImageInputValue, isImageDataUrl, isMediaDataUrl, normalizeDraft, normalizeDuration, parseSongRows };`,
    context,
    { filename: sourcePath }
  );

  return context.module.exports;
}

test("blank optional image and media fields serialize as null", () => {
  const { normalizeDraft } = loadAdminDraftModule();
  for (const type of ["image", "media"]) {
    for (const value of [undefined, null, "", " \t "]) {
      const result = normalizeDraft({ fields: [{key: "url", type}] }, {url: value});
      assert.equal(result.url, null);
      assert.equal(JSON.stringify(result), '{"url":null}');
    }
  }
});

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

test("normalizeDraft stores album song rows as JSON", () => {
  const { normalizeDraft } = loadAdminDraftModule();

  const result = normalizeDraft(
    {
      fields: [{ key: "trackListJson", type: "songRows" }]
    },
    {
      trackListJson: [
        { songName: "Intro", duration: "1:5", text: "Opening words" },
        { songName: "Closer", duration: "4:02" },
        { songName: "", duration: "", text: "" }
      ]
    }
  );

  assert.equal(
    result.trackListJson,
    JSON.stringify([
      { songName: "Intro", duration: "1:05", text: "Opening words" },
      { songName: "Closer", duration: "4:02", text: "" }
    ])
  );
});

test("parseSongRows reads saved album song JSON", () => {
  const { parseSongRows } = loadAdminDraftModule();

  assert.equal(
    JSON.stringify(parseSongRows('[{"songName":"Intro","duration":"1:05","text":"Opening words"}]')),
    JSON.stringify([{ songName: "Intro", duration: "1:05", text: "Opening words" }])
  );
});
