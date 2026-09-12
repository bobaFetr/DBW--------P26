// Retry only reads; mutations must never be replayed automatically.
export async function adminReadFetch(url, options, fetchImpl = fetch, sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))) {
  const { retry = true, ...fetchOptions } = options;
  const canRetry = retry && ["GET", "HEAD"].includes((options.method ?? "GET").toUpperCase());
  for (let attempt = 0; ; attempt++) {
    const response = await fetchImpl(url, fetchOptions);
    if (!canRetry || ![429, 503].includes(response.status) || attempt >= 3) return response;
    const retryAfter = response.headers.get("Retry-After");
    const seconds = retryAfter === null ? NaN : Number(retryAfter);
    const delay = Number.isFinite(seconds)
      ? seconds * 1000
      : Date.parse(retryAfter) - Date.now();
    // Cross-origin APIs may not expose Retry-After. Allow a full token refill
    // period for 429 responses instead of exhausting retries within seconds.
    await response.body?.cancel();
    await sleep(Number.isFinite(delay) ? Math.max(1000, delay) : response.status === 429 ? 30000 : 1000 * 2 ** attempt);
  }
}
