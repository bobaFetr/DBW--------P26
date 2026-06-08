"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:5001";
const FALLBACK_RELEASE = {
  title: "Misery (demo)",
  href: "/singles"
};

function externalUrl(value) {
  if (!value) return undefined;

  const trimmed = String(value).trim();
  if (!trimmed) return undefined;

  if (/^(https?:|mailto:)/i.test(trimmed)) {
    return trimmed;
  }

  return `https://${trimmed}`;
}

export default function NowPlayingBar() {
  const [release, setRelease] = useState(FALLBACK_RELEASE);

  useEffect(() => {
    let ignore = false;

    async function loadLatestRelease() {
      try {
        const response = await fetch(`${API_BASE}/api/content/singles`);
        if (!response.ok) return;

        const rows = await response.json();
        const latestSingle = rows[0];
        if (!latestSingle || ignore) return;

        setRelease({
          title: latestSingle.songName || FALLBACK_RELEASE.title,
          href:
            externalUrl(latestSingle.availableOnYoutube || latestSingle.availableOnSpotify) ||
            FALLBACK_RELEASE.href
        });
      } catch {
        // Keep the fallback release when the API is offline.
      }
    }

    void loadLatestRelease();
    return () => {
      ignore = true;
    };
  }, []);

  const isExternalRelease = /^(https?:|mailto:)/i.test(release.href);
  const ReleaseLink = isExternalRelease ? "a" : Link;
  const releaseLinkProps = isExternalRelease
    ? { href: release.href, target: "_blank", rel: "noreferrer" }
    : { href: release.href };

  return (
    <div className="now-playing-bar" role="complementary" aria-label="Latest release">
      <span className="now-playing-dot" aria-hidden="true" />
      <span className="now-playing-label">Latest Release</span>
      <ReleaseLink {...releaseLinkProps} className="now-playing-link">
        {release.title}
      </ReleaseLink>
      <span className="now-playing-sep" aria-hidden="true">—</span>
      <ReleaseLink {...releaseLinkProps} className="now-playing-cta">
        Listen Now →
      </ReleaseLink>
    </div>
  );
}
