import CardGrid from "../../components/CardGrid";
import PageIntro from "../../components/PageIntro";

const cards = [
  {
    title: "Vocals",
    meta: "Member profile",
    body: "Use this card for a photo, stage role, and one short line about style or influence."
  },
  {
    title: "Guitar",
    meta: "Member profile",
    body: "Add gear highlights, songwriting input, or a favorite track reference."
  },
  {
    title: "Bass",
    meta: "Member profile",
    body: "This slot works well for rhythm-section details and live energy notes."
  },
  {
    title: "Drums",
    meta: "Member profile",
    body: "Use this card for performance style, setup, or studio contribution."
  }
];

export const metadata = {
  title: "Members",
  description: "Paralyze members page for lineup roles, profiles, and band introductions."
};

export default function MembersPage() {
  return (
    <>
      <PageIntro title="Members">
        This page is ready for the full lineup, roles, and short individual
        introductions.
      </PageIntro>
      <CardGrid cards={cards} />
    </>
  );
}
