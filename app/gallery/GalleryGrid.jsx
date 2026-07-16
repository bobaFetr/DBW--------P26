"use client";

import { useCallback, useEffect, useState } from "react";

export default function GalleryGrid() {
  const [items, setItems] = useState([]);
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
      {!items.length ? (
        <p className="content-empty-state">No gallery items have been published yet.</p>
      ) : null}
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
            {item.mediaUrl && item.isVideo ? (
              <video className="gallery-thumb-img gallery-thumb-video" src={item.mediaUrl} muted playsInline preload="metadata" />
            ) : item.mediaUrl ? (
              <img className="gallery-thumb-img" src={item.mediaUrl} alt={item.caption} />
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
              {activeItem.mediaUrl && activeItem.isVideo ? (
                <video src={activeItem.mediaUrl} controls playsInline preload="metadata" />
              ) : activeItem.mediaUrl ? (
                <img src={activeItem.mediaUrl} alt={activeItem.caption} />
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
