"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { loadPublicContent } from "../../components/publicContent";
import { isVideoUrl, resolveApiMediaUrl } from "../../components/securityUrls";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:5001";

export default function GalleryGrid() {
  const [items, setItems] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeIndex, setActiveIndex] = useState(null);
  const closeButtonRef = useRef(null);
  const triggerRef = useRef(null);

  const isOpen = activeIndex !== null;

  const close = useCallback(() => {
    setActiveIndex(null);
    triggerRef.current?.focus();
  }, []);

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
        const rows = await loadPublicContent("gallery");
        if (!ignore) {
          setItems(
            rows.map((row, index) => ({
              id: String(row.id),
              caption: row.title,
              category: row.description,
              mediaUrl: resolveApiMediaUrl(row.imageUrl, API_BASE),
              isVideo: isVideoUrl(row.imageUrl),
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
        // Leave the gallery empty when the API is offline.
      } finally {
        if (!ignore) {
          setIsLoading(false);
        }
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
      if (e.key === "Tab") {
        const focusable = Array.from(
          document.querySelectorAll(".lightbox-inner button:not(:disabled)")
        );
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (!first || !last) return;
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }

    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [isOpen, close, prev, next]);

  useEffect(() => {
    if (isOpen) {
      closeButtonRef.current?.focus();
    }
  }, [isOpen]);

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
      {isLoading ? <p className="content-empty-state">Loading gallery...</p> : null}
      {!isLoading && !items.length ? (
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
            onClick={(event) => {
              triggerRef.current = event.currentTarget;
              setActiveIndex(index);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                triggerRef.current = e.currentTarget;
                setActiveIndex(index);
              }
            }}
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
              ref={closeButtonRef}
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
