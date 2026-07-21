import PageIntro from "../components/PageIntro";

export const metadata = {
  title: "Page Not Found",
  description: "The requested Paralyze page could not be found."
};

export default function NotFoundPage() {
  return (
    <>
      <PageIntro title="404 - Lost Signal">
        The page you were trying to reach is not in the Paralyze archive.
      </PageIntro>

      <section className="content-panel">
        <h2 className="section-title">Find Your Way Back</h2>
        <p>
          The link may be old, moved, or mistyped. Head back to the main page or
          jump into the band sections that are currently available.
        </p>
        <div className="cta-actions">
          <a className="action-link primary" href="/">
            <span>Go Home</span>
          </a>
          <a className="action-link" href="/singles/">
            <span>Singles</span>
          </a>
          <a className="action-link" href="/news/">
            <span>News</span>
          </a>
        </div>
      </section>
    </>
  );
}
