"use client";

import { useCallback, useEffect, useState } from "react";
import { safeImageUrl } from "../../components/securityUrls";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:5001";

const GALLERY_ITEMS = [
  { id: "live-mood", caption: "Live Mood", category: "Live", className: "gallery-item gallery-item-tall" },
  { id: "promo-shot", caption: "Promo Shot", category: "Press", className: "gallery-item photo gallery-item-wide" },
  { id: "logo-focus", caption: "Logo Focus", category: "Artwork", className: "gallery-item alt-logo gallery-item-square" },
  { id: "stage-energy", caption: "Stage Energy", category: "Live", className: "gallery-item gallery-item-wide" },
  { id: "future-artwork", caption: "Future Artwork", category: "Artwork", className: "gallery-item gallery-item-tall" },
  { id: "old-skulls", caption: "Old Skulls — Oct 31, 2025", category: "Live", className: "gallery-item photo gallery-item-wide" }
];

export default function GalleryGrid() {
  const [items, setItems] = useState(GALLERY_ITEMS);
  const [activeIndex, setActiveIndex] = useState(null);

  const isOpen = activeIndex !== null;

  const close = useCallback(() => setActiveIndex(null), []);

  const prev = useCallback(() => {
    setActiveIndex((i) => (i > 0 ? i - 1 : items.length - 1));
  }, [items.length]);

  const next = useCallback(() => {
    setActiveIndex((i) => (i < items.length - 1 ? i + 1 : 0));
  }, [items.length]);

  useEffect(() => {
    let ignore = false;

    async function loadGallery() {
      try {
        const response = await fetch(`${API_BASE}/api/content/gallery`);
        if (!response.ok) return;

        const rows = await response.json();
        if (!ignore && rows.length) {
          setItems(
            rows.map((row, index) => ({
              id: String(row.id),
              caption: row.title,
              category: row.description,
              imageUrl: safeImageUrl(row.imageUrl),
              className:
                index % 3 === 0
                  ? "gallery-item gallery-item-tall"
                  : index % 3 === 1
                    ? "gallery-item photo gallery-item-wide"
                    : "gallery-item alt-logo gallery-item-square"
            }))
          );
        }
      } catch {
        // Keep fallback gallery.
      }
    }

    void loadGallery();
    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    function onKey(e) {
      if (e.key === "Escape") close();
      if (e.key === "ArrowLeft") prev();
      if (e.key === "ArrowRight") next();
    }

    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [isOpen, close, prev, next]);

  // Touch/swipe support
  const [touchStartX, setTouchStartX] = useState(null);

  function onTouchStart(e) {
    setTouchStartX(e.touches[0].clientX);
  }

  function onTouchEnd(e) {
    if (touchStartX === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX;
    if (Math.abs(dx) > 50) {
      dx < 0 ? next() : prev();
    }
    setTouchStartX(null);
  }

  const activeItem = isOpen ? items[activeIndex] : null;

  return (
    <>
      <div className="gallery-masonry">
        {items.map((item, index) => (
          <div
            key={item.id}
            className={item.className}
            role="button"
            tabIndex={0}
            aria-label={`Open ${item.caption}`}
            onClick={() => setActiveIndex(index)}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setActiveIndex(index); } }}
          >
            {item.imageUrl ? (
              <img className="gallery-thumb-img" src={item.imageUrl} alt={item.caption} />
            ) : null}
            <div className="gallery-caption">{item.caption}</div>
          </div>
        ))}
      </div>

      {isOpen && (
        <div
          className="lightbox-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="Gallery lightbox"
          onClick={close}
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
        >
          <div
            className="lightbox-inner"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="lightbox-close"
              onClick={close}
              aria-label="Close lightbox"
              type="button"
            >
              ✕
            </button>
            <div className="lightbox-media">
              {activeItem.imageUrl ? (
                <img src={activeItem.imageUrl} alt={activeItem.caption} />
              ) : (
                "PARALYZE"
              )}
            </div>
            <p className="lightbox-caption">
              {activeItem.caption}
              {activeItem.category && (
                <span style={{ marginLeft: "10px", opacity: 0.5, fontSize: "0.82rem" }}>
                  — {activeItem.category}
                </span>
              )}
            </p>
            <div className="lightbox-controls">
              <button className="lightbox-btn" onClick={prev} aria-label="Previous image" type="button">‹</button>
              <span className="lightbox-counter">{activeIndex + 1} / {items.length}</span>
              <button className="lightbox-btn" onClick={next} aria-label="Next image" type="button">›</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
