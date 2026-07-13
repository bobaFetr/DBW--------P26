const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:5001";
const IMAGE_DATA_URL_PATTERN = /^data:image\/(?:jpeg|png|webp|gif);base64,[A-Za-z0-9+/]+={0,2}$/i;
const VIDEO_DATA_URL_PATTERN = /^data:video\/(?:mp4|webm|quicktime);base64,[A-Za-z0-9+/]+={0,2}$/i;
const API_VIDEO_PATH_PATTERN = /^\/api\/uploads\/videos\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PUBLIC_IMAGE_PATH_PATTERN = /^\/(?!\/)(?!api\/)(?!uploads\/)(?:[A-Za-z0-9._-]+\/)*[A-Za-z0-9._-]+\.(?:jpg|jpeg|png|webp|gif)$/i;

function apiAssetUrl(path) {
  return `${API_BASE.replace(/\/$/, "")}${path}`;
}

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

  if (trimmed.startsWith("/uploads/images/")) {
    return apiAssetUrl(trimmed);
  }

  if (PUBLIC_IMAGE_PATH_PATTERN.test(trimmed)) {
    return trimmed;
  }

  if (IMAGE_DATA_URL_PATTERN.test(trimmed)) {
    return trimmed;
  }

  try {
    const url = new URL(trimmed);
    return ["http:", "https:"].includes(url.protocol) ? url.href : undefined;
  } catch {
    return undefined;
  }
}

export function safeMediaUrl(value) {
  if (!value) return undefined;

  const trimmed = String(value).trim();
  if (!trimmed) return undefined;

  if (VIDEO_DATA_URL_PATTERN.test(trimmed)) {
    return trimmed;
  }

  if (API_VIDEO_PATH_PATTERN.test(trimmed)) {
    return apiAssetUrl(trimmed);
  }

  return safeImageUrl(trimmed);
}

export function isVideoUrl(value) {
  if (!value) return false;

  const trimmed = String(value).trim();
  return API_VIDEO_PATH_PATTERN.test(trimmed) ||
    VIDEO_DATA_URL_PATTERN.test(trimmed) ||
    /\.(?:mp4|webm|mov)(?:[?#].*)?$/i.test(trimmed);
}
