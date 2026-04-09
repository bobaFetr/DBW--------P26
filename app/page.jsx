import Link from "next/link";
import CardGrid from "../components/CardGrid";

const homeCards = [
  {
    title: "About",
    body: "The identity, atmosphere, and project direction behind Paralyze.",
    href: "/about",
    linkLabel: "Read More"
  },
  {
    title: "News",
    body: "Announcements, release notes, and updates you want visitors to see first.",
    href: "/news",
    linkLabel: "View Updates"
  },
  {
    title: "Timeline",
    body: "A quick archive of the project milestones that shaped the band so far.",
    href: "/timeline",
    linkLabel: "Open Timeline"
  }
];

export default function HomePage() {
  return (
    <>
      <section className="hero">
        <div className="hero-inner">
          <span className="eyebrow">Death By Wish</span>
          <h2>Paralyze</h2>
          <p>
            A focused monochrome home page for the band, now ready to deploy as a
            standalone static site.
          </p>
          <div className="hero-actions">
            <Link className="action-link" href="/about">
              <span>Enter The World</span>
            </Link>
            <Link className="action-link" href="/concerts">
              <span>See Concerts</span>
            </Link>
            <Link className="action-link" href="/gallery">
              <span>Open Gallery</span>
            </Link>
          </div>
        </div>
      </section>

      <section className="page-intro">
        <h2 className="section-title">Inside The Site</h2>
        <p>
          Everything public now lives inside the deployed site folder, so Render will
          only expose the actual website pages and assets.
        </p>
      </section>

      <CardGrid cards={homeCards} />

      <section className="cta-strip">
        <h2 className="section-title">Ready For Render</h2>
        <p>
          The site can now be published directly from this folder without exposing
          prototypes or repo-root files.
        </p>
        <div className="cta-actions">
          <Link className="action-link" href="/members">
            <span>Meet The Members</span>
          </Link>
          <Link className="action-link" href="/albums">
            <span>Browse Releases</span>
          </Link>
        </div>
      </section>
    </>
  );
}
