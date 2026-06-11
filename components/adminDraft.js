const IMAGE_DATA_URL_PATTERN = /^data:image\/(?:jpeg|png|webp|gif);base64,/i;

export function isImageDataUrl(value) {
  return IMAGE_DATA_URL_PATTERN.test(String(value ?? "").trim());
}

export function displayImageInputValue(value) {
  const raw = String(value ?? "").trim();
  return isImageDataUrl(raw) ? "" : raw;
}

export function normalizeDraft(collection, draft) {
  return Object.fromEntries(
    collection.fields.map((field) => {
      const raw = String(draft[field.key] ?? "").trim();
      if (field.type === "number") {
        if (!raw && field.nullable) {
          return [field.key, null];
        }

        return [field.key, raw ? Number(raw) : 0];
      }

      if (
        (field.type === "url" || field.type === "image") &&
        raw &&
        !/^https?:/i.test(raw) &&
        !isImageDataUrl(raw) &&
        !raw.startsWith("/")
      ) {
        return [field.key, `https://${raw}`];
      }

      if (raw) {
        return [field.key, raw];
      }

      return [field.key, field.emptyValue ?? null];
    })
  );
}
