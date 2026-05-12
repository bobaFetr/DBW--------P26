import CardGrid from "../../components/CardGrid";
import PageIntro from "../../components/PageIntro";

const cards = [
  {
    title: "Misery (demo)",
    badge: "Released",
    meta: "October 28, 2025",
    body: "The second official demo — showcasing the band's evolving sound and tighter direction.",
    href: "https://www.youtube.com/@deathbywish",
    linkLabel: "Listen on YouTube"
  },
  {
    title: "Guilt and Killer (demo)",
    badge: "Released",
    meta: "September 11, 2025",
    body: "The debut recording — the first official introduction of Paralyze to the world.",
    href: "https://www.youtube.com/@deathbywish",
    linkLabel: "Listen on YouTube"
  },
  {
    title: "Next Single",
    badge: "Coming Soon",
    urgent: true,
    meta: "2026",
    body: "New material is in progress. Expect a harder and more refined direction.",
    href: "/news",
    linkLabel: "Follow Updates"
  }
];

export const metadata = {
  title: "Singles",
  description: "Paralyze singles, featured tracks, and release highlights."
};

export default function SinglesPage() {
  return (
    <>
      <PageIntro title="Singles">
        Every release, from the earliest demos to upcoming tracks.
      </PageIntro>
      <CardGrid cards={cards} />
    </>
  );
}
