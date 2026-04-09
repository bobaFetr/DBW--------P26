import CardGrid from "../../components/CardGrid";
import PageIntro from "../../components/PageIntro";

const cards = [
  {
    title: "Debut Release",
    meta: "Album placeholder",
    body: "Add the release title, year, cover image, and a short summary of the record here."
  },
  {
    title: "Tracklist Block",
    meta: "Expandable section",
    body: "Use this slot for song names, credits, and production notes once the material is finalized."
  },
  {
    title: "Streaming Links",
    meta: "Spotify, YouTube, Bandcamp",
    body: "Keep one clean area for platform buttons so fans can find releases immediately."
  }
];

export const metadata = {
  title: "Albums",
  description: "Paralyze albums, full releases, artwork, and tracklist space."
};

export default function AlbumsPage() {
  return (
    <>
      <PageIntro title="Albums">
        This page is ready for full releases, artwork, tracklists, and streaming links.
      </PageIntro>
      <CardGrid cards={cards} />
    </>
  );
}
