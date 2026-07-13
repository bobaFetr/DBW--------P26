"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { loadPublicContent } from "./publicContent";
import { safeExternalUrl } from "./securityUrls";

export default function NowPlayingBar() {
  const [release, setRelease] = useState(null);

  useEffect(() => {
    let ignore = false;

    async function loadLatestRelease() {
      try {
        const rows = await loadPublicContent("singles");
        const latestSingle = rows[0];
        if (!latestSingle || ignore) return;

        setRelease({
          title: latestSingle.songName,
          href:
            safeExternalUrl(latestSingle.availableOnYoutube || latestSingle.availableOnSpotify) ||
            "/singles"
        });
      } catch {
        // Hide the latest release bar when the API is offline.
      }
    }

    void loadLatestRelease();
    return () => {
      ignore = true;
    };
  }, []);

  if (!release) {
    return null;
  }

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
