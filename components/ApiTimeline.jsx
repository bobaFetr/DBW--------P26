"use client";

import { useCallback, useEffect, useState } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:5001";

function formatDate(value) {
  return value ? String(value).slice(0, 10) : "";
}

export default function ApiTimeline({ fallbackItems }) {
  const [items, setItems] = useState(fallbackItems);

  const loadTimeline = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/api/content/timeline`, {
        cache: "no-store"
      });
      if (!response.ok) return;

      const rows = await response.json();
      if (rows.length) {
        setItems(
          rows.map((row) => ({
            date: formatDate(row.date),
            title: row.event,
            description: row.description
          }))
        );
      }
    } catch {
      // Keep static fallback.
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
      <div className="timeline">
        {items.map((item) => (
          <article className="timeline-item" key={`${item.date}-${item.title}`}>
            <div className="timeline-dot" />
            <div className="timeline-content">
              <div className="timeline-date">{item.date}</div>
              <div className="timeline-title">{item.title}</div>
              <div className="timeline-description">{item.description}</div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
