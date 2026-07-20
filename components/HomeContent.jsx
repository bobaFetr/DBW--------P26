import CardGrid from "./CardGrid";
import { loadPublicContent } from "./publicContent";
import { safeExternalUrl, safeImageUrl } from "./securityUrls";

const COLLECTIONS = [
  { key: "albums", label: "Albums" },
  { key: "singles", label: "Singles" },
  { key: "concerts", label: "Concerts" },
  { key: "news", label: "News" },
  { key: "members", label: "Members" },
  { key: "timeline", label: "Timeline Events" }
];

function dateOnly(value) {
  return value ? String(value).slice(0, 10) : "";
}

function byDateDesc(getDate) {
  return (left, right) => {
    const leftTime = Date.parse(getDate(left) ?? "") || 0;
    const rightTime = Date.parse(getDate(right) ?? "") || 0;
    return rightTime - leftTime;
  };
}

function firstSorted(rows, getDate) {
  return [...rows].sort(byDateDesc(getDate))[0];
}

function buildLatestCards(data) {
  const cards = [];
  const latestSingle = firstSorted(data.singles ?? [], (row) => row.releaseDate);
  const latestConcert = firstSorted(data.concerts ?? [], (row) => row.date);
  const latestNews = firstSorted(data.news ?? [], (row) => row.publicationDate);

  if (latestSingle) {
    cards.push({
      title: latestSingle.songName,
      badge: "Latest Single",
      urgent: true,
      meta: dateOnly(latestSingle.releaseDate) || "Release date TBA",
      body:
        [latestSingle.availableOnYoutube && "YouTube", latestSingle.availableOnSpotify && "Spotify"]
          .filter(Boolean)
          .join(" / ") || "Streaming links pending",
      cover: safeImageUrl(latestSingle.photoUrl),
      coverAlt: latestSingle.songName,
      href: safeExternalUrl(latestSingle.availableOnYoutube || latestSingle.availableOnSpotify),
      linkLabel: latestSingle.availableOnYoutube ? "Listen on YouTube" : "Listen"
    });
  }

  if (latestConcert) {
    cards.push({
      title: latestConcert.location,
      badge: "Concert",
      meta: [dateOnly(latestConcert.date), latestConcert.time].filter(Boolean).join(" at "),
      body: `${latestConcert.numberOfSongs || 0} songs planned`,
      href: "/concerts",
      linkLabel: "View Concerts"
    });
  }

  if (latestNews) {
    cards.push({
      title: latestNews.title,
      badge: "News",
      meta: [dateOnly(latestNews.publicationDate), latestNews.author].filter(Boolean).join(" / "),
      body: latestNews.content,
      href: "/news",
      linkLabel: "Read News"
    });
  }

  return cards;
}

export default function HomeContent() {
  const data = Object.fromEntries(
    COLLECTIONS.map((collection) => [collection.key, loadPublicContent(collection.key)])
  );
  const stats = COLLECTIONS.map((collection) => ({
    label: collection.label,
    value: data[collection.key].length
  }));
  const latestCards = buildLatestCards(data);

  return (
    <>
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

      {latestCards.length ? <CardGrid cards={latestCards} /> : null}
      {!latestCards.length ? (
        <p className="content-empty-state">No featured content has been published yet.</p>
      ) : null}
    </>
  );
}
