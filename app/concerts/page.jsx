import CardGrid from "../../components/CardGrid";
import PageIntro from "../../components/PageIntro";

const cards = [
  {
    title: "Upcoming Show Slot",
    meta: "Date TBA",
    body: "Add venue, city, and ticket or contact details here when the next show is confirmed."
  },
  {
    title: "Booking Information",
    meta: "For promoters",
    body: "Use this card for stage requirements, contact email, and links to your electronic press kit."
  },
  {
    title: "Past Performance",
    meta: "Archive slot",
    body: "Keep a record of completed gigs here so the page still feels active between announcements."
  }
];

export const metadata = {
  title: "Concerts",
  description: "Paralyze concerts, booking notes, and upcoming live plans."
};

export default function ConcertsPage() {
  return (
    <>
      <PageIntro title="Concerts">
        A dedicated live page makes it easier to publish show announcements instead
        of burying them on the homepage.
      </PageIntro>
      <CardGrid cards={cards} />
    </>
  );
}
