"use client";

import { useState } from "react";

export default function SiteFooter() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);

  function handleSubmit(e) {
    e.preventDefault();
    if (email.trim()) {
      setSubmitted(true);
    }
  }

  return (
    <footer>
      <div className="footer-inner">
        <div className="footer-col">
          <h4>Paralyze</h4>
          <p>
            Post punk band  from Sofia, Bulgaria.<br/>
            Founded February 2026.
          </p>
          <div className="footer-streaming-links footer-streaming-links-spaced">
            <a
              href="https://www.youtube.com/@ParalyZeofficial"
              target="_blank"
              rel="noreferrer"
              className="footer-pill"
            >
              YouTube
            </a>
            {/* <a
              href="/singles/"
              className="footer-pill"
            >
              Spotify
            </a> */}
            {/* <a
              href="/albums/"
              className="footer-pill"
            >
              Bandcamp
            </a> */}
            <a
              href="https://www.tiktok.com/@paralyzeband?is_from_webapp=1&sender_device=pc"
              target="_blank"
              rel="noreferrer"
              className="footer-pill"
            >
              Tik Tok
            </a>
            <a
              href="https://www.instagram.com/paralyze___?utm_source=ig_web_button_share_sheet&stkn=ZDNlZDc0MzIxNw=="
              target="_blank"
              rel="noreferrer"
              className="footer-pill"
            >
              Instagram
            </a>
          </div>
        </div>

        {/* <div className="footer-col">
          <h4>Booking</h4>
          <address>
            <p>For show bookings, press inquiries, and collaborations:</p>
            <p style={{ marginTop: "10px" }}>
              <a href="mailto:booking@paralyze.band">booking@paralyze.band</a>
            </p>
          </address>
          <div style={{ marginTop: "16px" }}>
            <Link href="/concerts" className="footer-pill">
              Show Schedule
            </Link>
          </div>
        </div> */}

        {/* <div className="footer-col">
          <h4>Merch</h4>
          <p>Shirts, physical releases, and limited drops available now.</p>
          <div style={{ marginTop: "16px" }}>
            <Link href="/merch" className="footer-pill">
              Shop Merch →
            </Link>
          </div>
        </div> */}

        {/* <div className="footer-col footer-newsletter">
          <h4>Stay Updated</h4>
          <p>Get notified about new releases, shows, and drops.</p>
          {submitted ? (
            <p style={{ color: "var(--accent)", fontWeight: "bold", marginTop: "8px" }}>
              ✓ You&#39;re on the list.
            </p>
          ) : (
            <form className="footer-newsletter-form" onSubmit={handleSubmit}>
              <input
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                aria-label="Email address for updates"
              />
              <button type="submit">Join</button>
            </form>
          )}
        </div> */}
      </div>

      <div className="footer-bottom">
        <p>&copy; 2026 Paralyze. All rights reserved.</p>
        <div className="footer-bottom-links">
          <a href="/about/">About</a>
          <a href="/news/">News</a>
          <a href="/airbrush-board/">Airbrush Board</a>
          <a href="/timeline/">Timeline</a>
          <a href="/privacy-policy/">Privacy Policy</a>
        </div>
      </div>
    </footer>
  );
}
