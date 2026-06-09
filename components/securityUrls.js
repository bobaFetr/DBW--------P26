const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:5001";

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

  if (trimmed === "/BUntitled.png") {
    return trimmed;
  }

  try {
    const url = new URL(trimmed);
    return ["http:", "https:"].includes(url.protocol) ? url.href : undefined;
  } catch {
    return undefined;
  }
}
