import { temporaryContent } from "../data/temporaryContent";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:5001";
const CONTENT_SOURCE = process.env.NEXT_PUBLIC_CONTENT_SOURCE ?? "temporary";
const LOCAL_ADMIN_OVERLAY = process.env.NEXT_PUBLIC_LOCAL_ADMIN_OVERLAY === "true";
const TEMPORARY_CONTENT_TYPES = new Set([
  "albums",
  "singles",
  "concerts",
  "gallery",
  "news",
  "members",
  "timeline"
]);

export function isTemporaryContentEnabled(contentType) {
  return CONTENT_SOURCE.toLowerCase() === "temporary" &&
    TEMPORARY_CONTENT_TYPES.has(contentType);
}

export async function loadPublicContent(contentType, fetchOptions) {
  if (isTemporaryContentEnabled(contentType)) {
    const temporaryRows = temporaryContent[contentType] ?? [];

    if (!LOCAL_ADMIN_OVERLAY) {
      return orderRows(contentType, temporaryRows);
    }

    try {
      const response = await fetch(`${API_BASE}/api/content/${contentType}`, fetchOptions);
      if (!response.ok) {
        return orderRows(contentType, temporaryRows);
      }

      const localAdminRows = await response.json();
      return orderRows(contentType, [
        ...temporaryRows,
        ...namespaceLocalIds(contentType, localAdminRows)
      ]);
    } catch {
      return orderRows(contentType, temporaryRows);
    }
  }

  const response = await fetch(`${API_BASE}/api/content/${contentType}`, fetchOptions);
  if (!response.ok) {
    return [];
  }

  return response.json();
}

const CONTENT_ID_KEYS = {
  albums: "albumId",
  singles: "songId",
  concerts: "concertId",
  news: "newsId",
  gallery: "id",
  members: "id",
  timeline: "id"
};

function namespaceLocalIds(contentType, rows) {
  const idKey = CONTENT_ID_KEYS[contentType];
  if (!idKey || !Array.isArray(rows)) return [];

  // A fresh local database commonly starts its IDs at 1, which can overlap
  // with IDs in temporaryContent. Public-detail links only need a stable
  // client-side ID, so namespace local records instead of hiding either row.
  return rows.map((row) => ({
    ...row,
    [idKey]: `local-${row[idKey]}`
  }));
}

function orderRows(contentType, rows) {
  const orderedRows = [...rows];

  switch (contentType) {
    case "albums":
    case "singles":
      return orderedRows.sort(byDateDesc((row) => row.releaseDate));
    case "concerts":
    case "timeline":
      return orderedRows.sort(byDateDesc((row) => row.date));
    case "news":
      return orderedRows.sort(byDateDesc((row) => row.publicationDate));
    case "members":
      return orderedRows.sort((left, right) =>
        String(left.name ?? "").localeCompare(String(right.name ?? "")));
    default:
      return orderedRows;
  }
}

function byDateDesc(getDate) {
  return (left, right) => {
    const leftTime = Date.parse(getDate(left) ?? "") || 0;
    const rightTime = Date.parse(getDate(right) ?? "") || 0;
    return rightTime - leftTime;
  };
}
