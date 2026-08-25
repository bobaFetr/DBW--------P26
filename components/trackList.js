export function parseSongRows(value) {
  if (Array.isArray(value)) {
    return value.map((row) => ({
      songName: String(row?.songName ?? ""),
      duration: String(row?.duration ?? ""),
      text: String(row?.text ?? ""),
      availableOnYoutube: String(row?.availableOnYoutube ?? "")
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
