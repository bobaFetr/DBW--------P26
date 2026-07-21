"use client";

import "./globals.css";

export default function GlobalErrorPage({ error, reset }) {
  return (
    <html lang="en">
      <body>
        <main id="main-content">
          <section className="page-intro">
            <h2 className="section-title">Critical Site Error</h2>
            <p>
              The site shell hit a problem before the full Paralyze experience
              could load.
            </p>
          </section>

          <section className="content-panel" role="alert">
            <h2 className="section-title">Restart The Signal</h2>
            <p>
              Refreshing the site usually clears this kind of issue. If it
              keeps happening, return to the main page and try again later.
            </p>
            {error?.digest ? (
              <p className="meta">Error reference: {error.digest}</p>
            ) : null}
            <div className="cta-actions">
              <button className="action-link reset-action" type="button" onClick={reset}>
                <span>Reload Site</span>
              </button>
              <a className="action-link primary" href="/">
                <span>Go Home</span>
              </a>
            </div>
          </section>
        </main>
      </body>
    </html>
  );
}
