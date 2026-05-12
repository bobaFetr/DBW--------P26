import CardGrid from "../../components/CardGrid";
import PageIntro from "../../components/PageIntro";

const cards = [
  {
    title: "Debut Album",
    badge: "In Progress",
    urgent: true,
    meta: "2026 — TBA",
    body: "The first full-length record is being written. Expect the complete Paralyze sound — heavier, darker, more focused.",
    href: "/news",
    linkLabel: "Follow Updates"
  },
  {
    title: "Demo Collection",
    badge: "Available",
    meta: "2025",
    body: "Two demo recordings — Guilt and Killer and Misery — that mark the beginning of the Paralyze catalog.",
    href: "/singles",
    linkLabel: "Hear The Demos"
  },
  {
    title: "Live Recording",
    badge: "Released",
    meta: "February 1, 2026",
    body: "The live recording from Old Skulls captures the intensity of the first performance.",
    href: "https://www.youtube.com/@deathbywish",
    linkLabel: "Watch on YouTube"
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
        Full releases, collections, and recordings from the Paralyze catalog.
      </PageIntro>
      <CardGrid cards={cards} />
    </>
  );
}
