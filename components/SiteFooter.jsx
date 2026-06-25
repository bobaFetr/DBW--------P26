"use client";

import Link from "next/link";
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
            Goth metal band  from Sofia, Bulgaria.<br/>
            Founded February 2026.
          </p>
          <div className="footer-streaming-links" style={{ marginTop: "16px" }}>
            <a
              href="https://www.youtube.com/@deathbywish"
              target="_blank"
              rel="noreferrer"
              className="footer-pill"
            >
              YouTube
            </a>
            <a
              href="/singles"
              className="footer-pill"
            >
              Spotify
            </a>
            <a
              href="/albums"
              className="footer-pill"
            >
              Bandcamp
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

        <div className="footer-col">
          <h4>Merch</h4>
          <p>Shirts, physical releases, and limited drops available now.</p>
          <div style={{ marginTop: "16px" }}>
            <Link href="/merch" className="footer-pill">
              Shop Merch →
            </Link>
          </div>
        </div>

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
        <div style={{ display: "flex", gap: "18px", flexWrap: "wrap", justifyContent: "center" }}>
          <Link href="/about">About</Link>
          <Link href="/news">News</Link>
          <Link href="/airbrush-board">Airbrush Board</Link>
          <Link href="/timeline">Timeline</Link>
          <Link href="/privacy-policy">Privacy Policy</Link>
          <a href="/admin" style={{ opacity: 0.4 }}>Admin</a>
        </div>
      </div>
    </footer>
  );
}
