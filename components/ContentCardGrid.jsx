import CardGrid from "./CardGrid";
import { parseSongRows } from "./trackList";
import { loadPublicContent } from "./publicContent";
import { safeExternalUrl, safeImageUrl } from "./securityUrls";

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
        cover: safeImageUrl(row.photoUrl),
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
        cover: safeImageUrl(row.photoUrl),
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
        cover: safeImageUrl(row.photoUrl),
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

export default function ContentCardGrid({ contentType, emptyMessage = "No content has been published yet." }) {
  const cards = toCards(contentType, loadPublicContent(contentType));

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
