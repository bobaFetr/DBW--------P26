"use client";

import { useEffect, useState } from "react";
import CardGrid from "./CardGrid";

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
      return rows.map((row) => ({
        title: row.songName,
        badge: "Single",
        meta: dateOnly(row.releaseDate) || "Release date TBA",
        body:
          [row.availableOnYoutube && "YouTube", row.availableOnSpotify && "Spotify"]
            .filter(Boolean)
            .join(" / ") || "Streaming links pending",
        href: row.availableOnYoutube || row.availableOnSpotify || undefined,
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
        body: row.photoUrl,
        cover: row.photoUrl,
        coverAlt: row.name
      }));
    default:
      return [];
  }
}

export default function ApiCardGrid({ contentType, fallbackCards }) {
  const [cards, setCards] = useState(fallbackCards);

  useEffect(() => {
    let ignore = false;

    async function loadCards() {
      try {
        const response = await fetch(`${API_BASE}/api/content/${contentType}`);
        if (!response.ok) return;

        const rows = await response.json();
        if (!ignore && rows.length) {
          setCards(toCards(contentType, rows));
        }
      } catch {
        // Keep the static fallback when the API is offline.
      }
    }

    void loadCards();
    return () => {
      ignore = true;
    };
  }, [contentType]);

  return <CardGrid cards={cards} />;
}

