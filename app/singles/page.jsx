import CardGrid from "../../components/CardGrid";
import PageIntro from "../../components/PageIntro";

const cards = [
  {
    title: "Lead Single",
    meta: "Release placeholder",
    body: "Add artwork, a short description, and direct links to the premiere or streaming platforms."
  },
  {
    title: "Lyric Video",
    meta: "Video slot",
    body: "This is a good place for a featured video embed or a still image linked to the release."
  },
  {
    title: "Behind the Song",
    meta: "Extra context",
    body: "Use this block for meaning, writing credits, recording notes, or production shout-outs."
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
        Separate singles deserve their own page, especially when you want faster
        updates between larger releases.
      </PageIntro>
      <CardGrid cards={cards} />
    </>
  );
}
