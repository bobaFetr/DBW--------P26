import { temporaryContent } from "../data/temporaryContent";
import { mergeTemporaryWithLocal } from "./publicContentMerge";

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
      const localAdminRows = await loadApiContent(contentType, fetchOptions);
      return orderRows(
        contentType,
        mergeTemporaryWithLocal(contentType, temporaryRows, localAdminRows)
      );
    } catch {
      return orderRows(contentType, temporaryRows);
    }
  }

  return loadApiContent(contentType, fetchOptions);
}

async function loadApiContent(contentType, fetchOptions) {
  const rows = [];
  let page = 1;

  while (true) {
    const response = await fetch(
      `${API_BASE}/api/content/${contentType}?page=${page}&pageSize=50`,
      fetchOptions
    );
    if (!response.ok) {
      throw new Error(`Could not load ${contentType} content.`);
    }

    const pageRows = await response.json();
    if (!Array.isArray(pageRows)) {
      throw new Error(`Could not load ${contentType} content.`);
    }

    rows.push(...pageRows);
    if (pageRows.length < 50) {
      return rows;
    }

    page += 1;
  }
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
