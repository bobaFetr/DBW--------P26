"use client";

import { useMemo } from "react";
import CardGrid from "./CardGrid";
import { parseSongRows } from "./trackList";
import { loadPublicContent } from "./publicContent";
import { safeImageUrl } from "./securityUrls";
import { useHashParams } from "./useHashParams";

function dateOnly(value) {
  return value ? String(value).slice(0, 10) : "";
}

function albumCards(albums) {
  return albums.map((album) => {
    const songs = parseSongRows(album.trackListJson);
    return {
      title: album.title,
      badge: "Album",
      meta: dateOnly(album.releaseDate) || "Release date TBA",
      body: `${songs.length || album.numberOfSongs || 0} songs`,
      cover: safeImageUrl(album.photoUrl),
      coverAlt: album.title,
      href: `/albums/#albumId=${album.albumId}`,
      linkLabel: "View songs"
    };
  });
}

export default function AlbumBrowser({ emptyMessage = "No albums have been published yet." }) {
  const hashParams = useHashParams();
  const selectedAlbumId = hashParams.get("albumId");
  const selectedSongNumber = hashParams.get("song");
  const albums = useMemo(() => loadPublicContent("albums"), []);

  const selectedAlbum = useMemo(
    () => albums.find((album) => String(album.albumId) === String(selectedAlbumId)),
    [albums, selectedAlbumId]
  );

  if (!albums.length) {
    return <p className="content-empty-state">{emptyMessage}</p>;
  }

  if (selectedAlbumId) {
    if (!selectedAlbum) {
      return (
        <section className="album-detail">
          <p className="content-empty-state">Album was not found.</p>
          <a className="action-link" href="/albums/">
            <span>Back to albums</span>
          </a>
        </section>
      );
    }

    const songs = parseSongRows(selectedAlbum.trackListJson);
    const cover = safeImageUrl(selectedAlbum.photoUrl);
    const selectedSongIndex = Number(selectedSongNumber) - 1;
    const selectedSong = Number.isInteger(selectedSongIndex) && selectedSongIndex >= 0
      ? songs[selectedSongIndex]
      : null;

    if (selectedSongNumber) {
      if (!selectedSong?.text?.trim()) {
        return (
          <section className="album-detail">
            <p className="content-empty-state">Song text was not found.</p>
            <a className="action-link" href={`/albums/#albumId=${selectedAlbum.albumId}`}>
              <span>Back to album</span>
            </a>
          </section>
        );
      }

      return (
        <section className="album-detail song-text-detail">
          <a className="action-link album-back-link" href={`/albums/#albumId=${selectedAlbum.albumId}`}>
            <span>Back to album</span>
          </a>

          <div className="song-text-page">
            <p className="meta">{selectedAlbum.title}</p>
            <h2>{selectedSong.songName}</h2>
            <p className="meta">{selectedSong.duration}</p>
            <div className="song-text-body">
              <p>{selectedSong.text}</p>
            </div>
          </div>
        </section>
      );
    }

    return (
      <section className="album-detail">
        <a className="action-link album-back-link" href="/albums/">
          <span>Back to albums</span>
        </a>

        <section className="album-summary">
          {cover ? (
            <div className="album-cover-large">
              <img src={cover} alt={selectedAlbum.title} />
            </div>
          ) : (
            <div className="album-cover-large" aria-hidden="true">
              PARALYZE
            </div>
          )}

          <div>
            <p className="meta">{dateOnly(selectedAlbum.releaseDate) || "Release date TBA"}</p>
            <h2>{selectedAlbum.title}</h2>
            <p>{songs.length || selectedAlbum.numberOfSongs || 0} songs</p>
          </div>
        </section>

        <section className="track-list" aria-label={`${selectedAlbum.title} songs`}>
          {songs.length ? (
            songs.map((song, index) => {
              const hasText = Boolean(song.text?.trim());

              return (
                <article className="track-row-wrap" key={`${song.songName}-${index}`}>
                  <div className="track-row">
                    <span className="track-number">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <span className="track-title">{song.songName}</span>
                    <span className="track-duration">{song.duration}</span>
                    {hasText ? (
                      <a
                        className="track-text-link"
                        href={`/albums/#albumId=${selectedAlbum.albumId}&song=${index + 1}`}
                      >
                        Song text
                      </a>
                    ) : null}
                  </div>
                </article>
              );
            })
          ) : (
            <p className="content-empty-state">No songs have been added for this album yet.</p>
          )}
        </section>
      </section>
    );
  }

  return <CardGrid cards={albumCards(albums)} className="album-card-grid" />;
}
