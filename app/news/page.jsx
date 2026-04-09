import CardGrid from "../../components/CardGrid";
import PageIntro from "../../components/PageIntro";

const cards = [
  {
    title: "Site Update",
    meta: "Now",
    body: "The site now uses one shared navigation shell, cleaner entry points, and stronger accessibility defaults."
  },
  {
    title: "Next Announcement Slot",
    meta: "Coming soon",
    body: "Perfect for upcoming singles, lineup changes, or teaser campaign notes."
  },
  {
    title: "Press Note",
    meta: "Media-ready section",
    body: "Add a short formal update here for promoters, blogs, or social reposts."
  }
];

export const metadata = {
  title: "News",
  description: "Paralyze news, updates, announcements, and release countdowns."
};

export default function NewsPage() {
  return (
    <>
      <PageIntro title="News">
        Use this page for updates, announcements, and release countdowns.
      </PageIntro>
      <CardGrid cards={cards} />
    </>
  );
}
