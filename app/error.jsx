"use client";


export default function ErrorPage({ error, reset }) {
  return (
    <>
      <section className="page-intro">
        <h2 className="section-title">500 - Feedback Burst</h2>
        <p>
          Something on this page failed while the site was loading.
        </p>
      </section>

      <section className="content-panel" role="alert">
        <h2 className="section-title">Try The Page Again</h2>
        <p>
          This is usually temporary. You can reload this section, return home,
          or continue browsing another part of the site.
        </p>
        {error?.digest ? (
          <p className="meta">Error reference: {error.digest}</p>
        ) : null}
        <div className="cta-actions">
          <button className="action-link reset-action" type="button" onClick={reset}>
            <span>Try Again</span>
          </button>
          <a className="action-link primary" href="/">
            <span>Go Home</span>
          </a>
          <a className="action-link" href="/concerts/">
            <span>Concerts</span>
          </a>
        </div>
      </section>
    </>
  );
}
