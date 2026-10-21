import HomeContent from "../components/HomeContent";

export default function HomePage() {
  return (
    <>
      <section className="hero">
        <div className="hero-inner">
          {/* <span className="eyebrow">Death By Wish is dead</span> */}
          <h2>Paralyze</h2>
          <p>
            {/*Post punk band Sofia from Bulgaria. */}
            We are sorry, but new information on this site will be delayed..
          </p>
          <div className="hero-actions">
            <a className="action-link primary" href="/singles/">
              <span>Listen Now</span>
            </a>
            {/* <Link className="action-link urgent" href="/concerts">
              <span>Book A Show</span>
            </Link> */}
          </div>
        </div>
      </section>

      <HomeContent />

      <section className="cta-strip">
        <h2 className="section-title">Explore The site</h2>
        <p>Music, live shows, the band story, and everything in between.</p>
        <div className="cta-actions">
          <a className="action-link" href="/albums/">
            <span>Browse Releases</span>
          </a>
          <a className="action-link" href="/members/">
            <span>Meet The Band</span>
          </a>
          <a className="action-link" href="/timeline/">
            <span>View Timeline</span>
          </a>
        </div>
      </section>
    </>
  );
}
