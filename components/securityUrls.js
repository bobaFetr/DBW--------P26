const IMAGE_DATA_URL_PATTERN = /^data:image\/(?:jpeg|png|webp|gif);base64,[A-Za-z0-9+/]+={0,2}$/i;
const VIDEO_DATA_URL_PATTERN = /^data:video\/(?:mp4|webm|quicktime);base64,[A-Za-z0-9+/]+={0,2}$/i;
const PUBLIC_IMAGE_PATH_PATTERN = /^\/(?!\/)(?!api\/)(?!uploads\/)(?:[A-Za-z0-9._-]+\/)*[A-Za-z0-9._-]+\.(?:jpg|jpeg|png|webp|gif)$/i;

export function safeExternalUrl(value) {
  if (!value) return undefined;

  const trimmed = String(value).trim();
  if (!trimmed) return undefined;

  try {
    const url = new URL(trimmed);
    return ["http:", "https:", "mailto:"].includes(url.protocol) ? url.href : undefined;
  } catch {
    try {
      const url = new URL(`https://${trimmed}`);
      return url.protocol === "https:" ? url.href : undefined;
    } catch {
      return undefined;
    }
  }
}

export function safeImageUrl(value) {
  if (!value) return undefined;

  const trimmed = String(value).trim();
  if (!trimmed) return undefined;

  if (PUBLIC_IMAGE_PATH_PATTERN.test(trimmed)) {
    return trimmed;
  }

  if (IMAGE_DATA_URL_PATTERN.test(trimmed)) {
    return trimmed;
  }

  return undefined;
}

export function safeMediaUrl(value) {
  if (!value) return undefined;

  const trimmed = String(value).trim();
  if (!trimmed) return undefined;

  if (VIDEO_DATA_URL_PATTERN.test(trimmed)) {
    return trimmed;
  }

  return safeImageUrl(trimmed);
}

export function isVideoUrl(value) {
  if (!value) return false;

  const trimmed = String(value).trim();
  return VIDEO_DATA_URL_PATTERN.test(trimmed) ||
    /\.(?:mp4|webm|mov)(?:[?#].*)?$/i.test(trimmed);
}
