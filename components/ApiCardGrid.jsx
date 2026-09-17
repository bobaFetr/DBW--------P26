"use client";

import { useEffect, useState } from "react";
import CardGrid from "./CardGrid";
import { parseSongRows } from "./adminDraft";
import { loadPublicContent } from "./publicContent";
import { resolveApiMediaUrl, safeExternalUrl } from "./securityUrls";

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
        body: albumBody(row),
        cover: resolveApiMediaUrl(row.photoUrl, API_BASE),
        coverAlt: row.title
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
        cover: resolveApiMediaUrl(row.photoUrl, API_BASE),
        coverAlt: row.songName,
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
        cover: resolveApiMediaUrl(row.photoUrl, API_BASE),
        coverAlt: row.name
      }));
    default:
      return [];
  }
}

function albumBody(row) {
  const songs = parseSongRows(row.trackListJson);
  if (!songs.length) {
    return `${row.numberOfSongs || 0} songs`;
  }

  return songs.map((song) => `${song.songName} (${song.duration})`).join(" / ");
}

export default function ApiCardGrid({ contentType, emptyMessage = "No content has been published yet." }) {
  const [cards, setCards] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let ignore = false;

    async function loadCards() {
      try {
        const rows = await loadPublicContent(contentType);
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

  return (
    <CardGrid
      cards={cards}
      className={contentType === "members" ? "member-card-grid" : ""}
    />
  );
}
