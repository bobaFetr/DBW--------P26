import Link from "next/link";
import { loadPublicContent } from "./publicContent";
import { safeExternalUrl } from "./securityUrls";

export default function NowPlayingBar() {
  const latestSingle = loadPublicContent("singles")[0];
  const latestAlbum = loadPublicContent("albums")[0];
  const releases = [
    latestSingle
      ? {
        title: latestSingle.songName,
        releaseDate: latestSingle.releaseDate,
        href: safeExternalUrl(latestSingle.availableOnYoutube || latestSingle.availableOnSpotify) || "/singles",
        linkLabel: "Listen Now"
      }
      : null,
    latestAlbum
      ? {
          title: latestAlbum.title,
          releaseDate: latestAlbum.releaseDate,
          href: `/albums/?albumId=${latestAlbum.albumId}`,
          linkLabel: "View Album"
        }
      : null
  ].filter(Boolean);
  const release = releases.sort((left, right) => {
    const leftTime = Date.parse(left.releaseDate ?? "") || 0;
    const rightTime = Date.parse(right.releaseDate ?? "") || 0;
    return rightTime - leftTime;
  })[0];

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
        {release.linkLabel} →
      </ReleaseLink>
    </div>
  );
}
