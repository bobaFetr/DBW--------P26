import { temporaryContent } from "../data/temporaryContent";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:5001";
const CONTENT_SOURCE = process.env.NEXT_PUBLIC_CONTENT_SOURCE ?? "backend";
const TEMPORARY_CONTENT_TYPES = new Set([
  "albums",
  "singles",
  "concerts",
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
    return orderRows(contentType, temporaryContent[contentType] ?? []);
  }

  const response = await fetch(`${API_BASE}/api/content/${contentType}`, fetchOptions);
  if (!response.ok) {
    return [];
  }

  return response.json();
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
