"use client";

import { useEffect, useState } from "react";
import CardGrid from "./CardGrid";
import { safeExternalUrl, safeImageUrl } from "./securityUrls";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:5001";

function dateOnly(value) {
  return value ? String(value).slice(0, 10) : "";
}

function toCards(contentType, rows) {
  switch (contentType) {
    case "albums":
      return rows.map((row) => ({
        title: row.title,
        badge: "Album",
        meta: dateOnly(row.releaseDate) || "Release date TBA",
        body: `${row.numberOfSongs || 0} songs`
      }));
    case "singles":
      return rows.map((row, index) => ({
        title: row.songName,
        badge: index === 0 ? "Latest Release" : "Single",
        urgent: index === 0,
        meta: dateOnly(row.releaseDate) || "Release date TBA",
        body:
          [row.availableOnYoutube && "YouTube", row.availableOnSpotify && "Spotify"]
            .filter(Boolean)
            .join(" / ") || "Streaming links pending",
        href: safeExternalUrl(row.availableOnYoutube || row.availableOnSpotify),
        linkLabel: row.availableOnYoutube ? "Listen on YouTube" : "Listen"
      }));
    case "concerts":
      return rows.map((row) => ({
        title: row.location,
        badge: "Concert",
        meta: [dateOnly(row.date), row.time].filter(Boolean).join(" at "),
        body: `${row.numberOfSongs || 0} songs planned`
      }));
    case "news":
      return rows.map((row) => ({
        title: row.title,
        meta: [dateOnly(row.publicationDate), row.author].filter(Boolean).join(" / "),
        body: row.content
      }));
    case "members":
      return rows.map((row) => ({
        title: row.name,
        meta: row.instrument,
        cover: safeImageUrl(row.photoUrl),
        coverAlt: row.name
      }));
    default:
      return [];
  }
}

export default function ApiCardGrid({ contentType, emptyMessage = "No content has been published yet." }) {
  const [cards, setCards] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let ignore = false;

    async function loadCards() {
      try {
        const response = await fetch(`${API_BASE}/api/content/${contentType}`);
        if (!response.ok) {
          return;
        }

        const rows = await response.json();
        if (!ignore) {
          setCards(toCards(contentType, rows));
        }
      } catch {
        // Leave the page empty when the API is offline.
      } finally {
        if (!ignore) {
          setIsLoading(false);
        }
      }
    }

    void loadCards();
    return () => {
      ignore = true;
    };
  }, [contentType]);

  if (isLoading) {
    return <p className="content-empty-state">Loading content...</p>;
  }

  if (!cards.length) {
    return <p className="content-empty-state">{emptyMessage}</p>;
  }

  return <CardGrid cards={cards} />;
}
