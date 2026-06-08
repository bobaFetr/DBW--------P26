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

  if (trimmed.startsWith("/uploads/images/") || trimmed === "/BUntitled.png") {
    return trimmed;
  }

  try {
    const url = new URL(trimmed);
    return ["http:", "https:"].includes(url.protocol) ? url.href : undefined;
  } catch {
    return undefined;
  }
}
