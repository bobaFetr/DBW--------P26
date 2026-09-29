"use client";

import { useCallback, useEffect, useState } from "react";
import { loadPublicContent } from "./publicContent";

function formatDate(value) {
  return value ? String(value).slice(0, 10) : "";
}

export default function ApiTimeline() {
  const [items, setItems] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const loadTimeline = useCallback(async () => {
    try {
      const rows = await loadPublicContent("timeline", {
        cache: "no-store"
      });
      setLoadError(false);
      setItems(
        rows.map((row) => ({
          date: formatDate(row.date),
          title: row.event,
          location: row.location?.trim() ?? "",
          description: row.description?.trim() ?? ""
        }))
      );
    } catch {
      setLoadError(true);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadTimeline();

    function refreshWhenVisible() {
      if (!document.hidden) {
        void loadTimeline();
      }
    }

    window.addEventListener("focus", refreshWhenVisible);
    document.addEventListener("visibilitychange", refreshWhenVisible);

    return () => {
      window.removeEventListener("focus", refreshWhenVisible);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [loadTimeline]);

  return (
    <section className="timeline-section">
      {isLoading ? <p className="content-empty-state">Loading timeline...</p> : null}
      {loadError ? <p className="content-empty-state" role="alert">Timeline could not be refreshed. Please reload the page to try again.</p> : null}
      {!isLoading && !loadError && !items.length ? (
        <p className="content-empty-state">No timeline entries have been published yet.</p>
      ) : null}
      <div className="timeline">
        {items.map((item) => (
          <article className="timeline-item" key={`${item.date}-${item.title}`}>
            <div className="timeline-dot" />
            <div className="timeline-content">
              <div className="timeline-date">{item.date}</div>
              <div className="timeline-title">{item.title}</div>
              {item.location && <div className="timeline-location">Location: {item.location}</div>}
              {item.description && <div className="timeline-description">{item.description}</div>}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
