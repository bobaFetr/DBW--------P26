"use client";

import { useState } from "react";

export default function ErrorTestPage() {
  const [shouldCrash, setShouldCrash] = useState(false);

  if (shouldCrash) {
    throw new Error("Manual test error for app/error.jsx");
  }

  return (
    <section className="content-panel">
      <h2 className="section-title">Error Page Test</h2>
      <p>
        Use this page to trigger the route error screen without changing any
        production content.
      </p>
      <div className="cta-actions">
        <button
          className="action-link reset-action"
          type="button"
          onClick={() => setShouldCrash(true)}
        >
          <span>Trigger Error</span>
        </button>
      </div>
    </section>
  );
}
