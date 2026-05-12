import Link from "next/link";
import CardGrid from "../components/CardGrid";

const homeCards = [
  {
    title: "Latest Single",
    badge: "New",
    urgent: true,
    meta: "October 2025",
    body: "Misery (demo) — the latest track from Paralyze, showcasing the band's evolving sound.",
    href: "/singles",
    linkLabel: "Stream Now"
  },
  {
    title: "Old Skulls Show",
    badge: "Performed",
    meta: "October 31, 2025",
    body: "The band's first major live appearance — raw energy on stage and a defining public moment.",
    href: "/concerts",
    linkLabel: "Concert Archive"
  },
  {
    title: "Band Story",
    meta: "Founded Dec 2024",
    body: "Two members, one vision: powerful death metal with a colder, monochrome identity.",
    href: "/about",
    linkLabel: "Read More"
  }
];

const pressQuotes = [
  {
    quote: "Raw, unfiltered intensity. Paralyze hit the stage with a force that left the crowd speechless.",
    source: "Old Skulls Night, Oct 2025"
  },
  {
    quote: "The demo recordings prove there's serious songwriting ability behind the noise.",
    source: "Underground Metal Blog"
  },
  {
    quote: "A project worth watching — every release feels like a step forward.",
    source: "Local Scene Report"
  }
];

const stats = [
  { value: "2", label: "Demo Releases" },
  { value: "1", label: "Live Show" },
  { value: "2024", label: "Founded" },
  { value: "∞", label: "In Progress" }
];

export default function HomePage() {
  return (
    <>
      <section className="hero">
        <div className="hero-inner">
          <span className="eyebrow">Death By Wish</span>
          <h2>Paralyze</h2>
          <p>
            Death metal from Bulgaria — raw, cold, and uncompromising.
          </p>
          <div className="hero-actions">
            <Link className="action-link primary" href="/singles">
              <span>Listen Now</span>
            </Link>
            <Link className="action-link urgent" href="/concerts">
              <span>Book A Show</span>
            </Link>
          </div>
        </div>
      </section>

      <div className="release-stats">
        {stats.map((stat) => (
          <div key={stat.label} className="release-stat">
            <strong>{stat.value}</strong>
            <span>{stat.label}</span>
          </div>
        ))}
      </div>

      <section className="page-intro">
        <h2 className="section-title">Latest From Paralyze</h2>
      </section>

      <CardGrid cards={homeCards} />

      <section className="page-intro" style={{ marginTop: "16px" }}>
        <h2 className="section-title">What People Are Saying</h2>
      </section>

      <div className="press-strip">
        {pressQuotes.map((q) => (
          <div key={q.source} className="press-quote">
            <blockquote>&ldquo;{q.quote}&rdquo;</blockquote>
            <cite>{q.source}</cite>
          </div>
        ))}
      </div>

      <section className="cta-strip">
        <h2 className="section-title">Explore The World</h2>
        <p>Music, live shows, the band story, and everything in between.</p>
        <div className="cta-actions">
          <Link className="action-link" href="/albums">
            <span>Browse Releases</span>
          </Link>
          <Link className="action-link" href="/members">
            <span>Meet The Band</span>
          </Link>
          <Link className="action-link" href="/timeline">
            <span>View Timeline</span>
          </Link>
        </div>
      </section>
    </>
  );
}
