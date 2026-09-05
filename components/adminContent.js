// Keep successful collections visible, but never total an incomplete load.
export async function loadPublicContent(collections, fetchRows) {
  const results = await Promise.allSettled(collections.map(async (collection) => {
    const rows = await fetchRows(collection.key);
    if (!Array.isArray(rows)) throw new Error("Expected a collection of rows.");
    return [collection.key, rows];
  }));
  const failures = results.flatMap((result, index) =>
    result.status === "rejected" ? [collections[index].label] : []
  );
  const entries = results.filter((result) => result.status === "fulfilled").map((result) => result.value);
  return {
    failures,
    records: Object.fromEntries(entries),
    count: failures.length ? null : entries.reduce((total, [, rows]) => total + rows.length, 0)
  };
}
