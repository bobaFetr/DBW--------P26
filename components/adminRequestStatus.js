export function deniedRequestExpiresAt(request) {
  if (request.status !== "Denied" && request.status !== 3) return null;
  if (!request.reviewedAtUtc) return null;
  const timestamp = String(request.reviewedAtUtc);
  const reviewedAt = Date.parse(/[zZ]$|[+-]\d{2}:\d{2}$/.test(timestamp) ? timestamp : `${timestamp}Z`);
  return Number.isFinite(reviewedAt) ? reviewedAt + 60000 : null;
}

export function isVisibleOwnRequest(request, now = Date.now()) {
  if (request.status === "Pending" || request.status === 1) return true;
  const expiresAt = deniedRequestExpiresAt(request);
  return expiresAt !== null && now < expiresAt;
}

// Refresh every loaded page so an older awaiting request can receive its decision.
export async function loadOwnRequestStatus(fetchRows, loadedCount, pageSize = 50) {
  const requests = [];
  const pageCount = Math.max(1, Math.ceil(loadedCount / pageSize));
  let rows = [];
  for (let page = 0; page < pageCount; page++) {
    const cursor = requests.at(-1);
    const query = cursor
      ? `pageSize=${pageSize}&afterRequestedAtUtc=${encodeURIComponent(cursor.requestedAtUtc)}&afterId=${cursor.id}`
      : `page=1&pageSize=${pageSize}`;
    rows = await fetchRows(`/api/content-requests/mine?${query}`);
    if (!Array.isArray(rows)) throw new Error("Expected a collection of requests.");
    requests.push(...rows);
    if (rows.length < pageSize) break;
  }
  return { requests, hasMore: rows.length === pageSize };
}
