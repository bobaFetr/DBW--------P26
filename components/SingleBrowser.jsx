"use client";

import { useSearchParams } from "next/navigation";
import { useMemo } from "react";
import CardGrid from "./CardGrid";
import { loadPublicContent } from "./publicContent";
import { safeExternalUrl, safeImageUrl } from "./securityUrls";

function dateOnly(value) {
  return value ? String(value).slice(0, 10) : "";
}

function singleCards(singles, latestSingleIsLatestRelease) {
  return singles.map((single, index) => ({
    title: single.songName,
    badge: index === 0 && latestSingleIsLatestRelease ? "Latest Release" : "Single",
    urgent: index === 0 && latestSingleIsLatestRelease,
    meta: dateOnly(single.releaseDate) || "Release date TBA",
    body: single.description || (
      [single.availableOnYoutube && "YouTube", single.availableOnSpotify && "Spotify"]
        .filter(Boolean)
        .join(" / ") || "Streaming links pending"
    ),
    cover: safeImageUrl(single.photoUrl),
    coverAlt: single.songName,
    href: `/singles/?singleId=${single.songId}`,
    linkLabel: "View single"
  }));
}

export default function SingleBrowser({ emptyMessage = "No singles have been published yet." }) {
  const searchParams = useSearchParams();
  const selectedSingleId = searchParams.get("singleId");
  const singles = useMemo(() => loadPublicContent("singles"), []);
  const latestAlbum = useMemo(() => loadPublicContent("albums")[0], []);
  const latestSingleTime = Date.parse(singles[0]?.releaseDate ?? "") || 0;
  const latestAlbumTime = Date.parse(latestAlbum?.releaseDate ?? "") || 0;
  const latestSingleIsLatestRelease = !latestAlbum || latestSingleTime > latestAlbumTime;

  const selectedSingle = useMemo(
    () => singles.find((single) => String(single.songId) === String(selectedSingleId)),
    [singles, selectedSingleId]
  );

  if (!singles.length) {
    return <p className="content-empty-state">{emptyMessage}</p>;
  }

  if (selectedSingleId) {
    if (!selectedSingle) {
      return (
        <section className="single-detail">
          <p className="content-empty-state">Single was not found.</p>
          <a className="action-link" href="/singles/">
            <span>Back to singles</span>
          </a>
        </section>
      );
    }

    const cover = safeImageUrl(selectedSingle.photoUrl);
    const youtubeUrl = safeExternalUrl(selectedSingle.availableOnYoutube);
    const spotifyUrl = safeExternalUrl(selectedSingle.availableOnSpotify);

    return (
      <section className="single-detail">
        <a className="action-link single-back-link" href="/singles/">
          <span>Back to singles</span>
        </a>

        <section className="single-summary">
          {cover ? (
            <div className="single-cover-large">
              <img src={cover} alt={selectedSingle.songName} />
            </div>
          ) : (
            <div className="single-cover-large" aria-hidden="true">
              PARALYZE
            </div>
          )}

          <div>
            <p className="meta">{dateOnly(selectedSingle.releaseDate) || "Release date TBA"}</p>
            <h2>{selectedSingle.songName}</h2>
            {selectedSingle.description ? (
              <p>{selectedSingle.description}</p>
            ) : (
              <p>More information about this single is coming soon.</p>
            )}
            <div className="single-listen-links">
              {youtubeUrl ? (
                <a className="action-link" href={youtubeUrl} target="_blank" rel="noreferrer">
                  <span>Listen on YouTube</span>
                </a>
              ) : null}
              {spotifyUrl ? (
                <a className="action-link" href={spotifyUrl} target="_blank" rel="noreferrer">
                  <span>Listen on Spotify</span>
                </a>
              ) : null}
            </div>
          </div>
        </section>
      </section>
    );
  }

  return <CardGrid cards={singleCards(singles, latestSingleIsLatestRelease)} />;
}
