import Link from "next/link";

export default function NowPlayingBar() {
  return (
    <div className="now-playing-bar" role="complementary" aria-label="Latest release">
      <span className="now-playing-dot" aria-hidden="true" />
      <span className="now-playing-label">Latest Release</span>
      <Link href="/singles" className="now-playing-link">
        Misery (demo)
      </Link>
      <span className="now-playing-sep" aria-hidden="true">—</span>
      <Link href="/singles" className="now-playing-cta">
        Listen Now →
      </Link>
    </div>
  );
}
