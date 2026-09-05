const CONTENT_ID_KEYS = {
  albums: "albumId",
  singles: "songId",
  concerts: "concertId",
  news: "newsId",
  gallery: "id",
  members: "id",
  timeline: "id"
};

export function mergeTemporaryWithLocal(contentType, temporaryRows, localRows) {
  const idKey = CONTENT_ID_KEYS[contentType];
  if (!idKey || !Array.isArray(localRows)) return [...temporaryRows];

  // A fresh local database commonly starts its IDs at 1, which can overlap
  // with IDs in temporaryContent. Public-detail links only need a stable
  // client-side ID, so namespace local records instead of hiding either row.
  return [
    ...temporaryRows,
    ...localRows.map((row) => ({
      ...row,
      [idKey]: `local-${row[idKey]}`
    }))
  ];
}
