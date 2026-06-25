const IMAGE_DATA_URL_PATTERN = /^data:image\/(?:jpeg|png|webp|gif);base64,/i;
const VIDEO_DATA_URL_PATTERN = /^data:video\/(?:mp4|webm|quicktime);base64,/i;
const SONG_DURATION_PATTERN = /^\d{1,3}:[0-5]\d$/;

export function isImageDataUrl(value) {
  return IMAGE_DATA_URL_PATTERN.test(String(value ?? "").trim());
}

export function isMediaDataUrl(value) {
  const raw = String(value ?? "").trim();
  return IMAGE_DATA_URL_PATTERN.test(raw) || VIDEO_DATA_URL_PATTERN.test(raw);
}

export function displayImageInputValue(value) {
  const raw = String(value ?? "").trim();
  return isMediaDataUrl(raw) ? "" : raw;
}

export function normalizeDraft(collection, draft) {
  return Object.fromEntries(
    collection.fields.map((field) => {
      if (field.type === "songRows") {
        const rows = Array.isArray(draft[field.key]) ? draft[field.key] : parseSongRows(draft[field.key]);
        const normalizedRows = rows
          .map((row) => ({
            songName: String(row?.songName ?? "").trim(),
            duration: normalizeDuration(row?.duration),
            text: String(row?.text ?? "").trim()
          }))
          .filter((row) => row.songName || row.duration || row.text);

        return [
          field.key,
          normalizedRows.length ? JSON.stringify(normalizedRows) : field.emptyValue ?? null
        ];
      }

      const raw = String(draft[field.key] ?? "").trim();
      if (field.type === "number") {
        if (!raw && field.nullable) {
          return [field.key, null];
        }

        return [field.key, raw ? Number(raw) : 0];
      }

      if (
        (field.type === "url" || field.type === "image" || field.type === "media") &&
        raw &&
        !/^https?:/i.test(raw) &&
        !isMediaDataUrl(raw) &&
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

export function parseSongRows(value) {
  if (Array.isArray(value)) {
    return value.map((row) => ({
      songName: String(row?.songName ?? ""),
      duration: String(row?.duration ?? ""),
      text: String(row?.text ?? "")
    }));
  }

  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(String(value));
    return Array.isArray(parsed) ? parseSongRows(parsed) : [];
  } catch {
    return [];
  }
}

export function normalizeDuration(value) {
  const raw = String(value ?? "").trim();
  if (!raw) {
    return "";
  }

  const match = raw.match(/^(\d{1,3}):(\d{1,2})$/);
  if (!match) {
    return raw;
  }

  const minutes = Number(match[1]);
  const seconds = Number(match[2]);
  if (Number.isNaN(minutes) || Number.isNaN(seconds) || seconds > 59) {
    return raw;
  }

  const normalized = `${minutes}:${String(seconds).padStart(2, "0")}`;
  return SONG_DURATION_PATTERN.test(normalized) ? normalized : raw;
}
