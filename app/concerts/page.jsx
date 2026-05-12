import CardGrid from "../../components/CardGrid";
import PageIntro from "../../components/PageIntro";

const cards = [
  {
    title: "Old Skulls",
    badge: "Performed",
    meta: "October 31, 2025 · Sofia",
    body: "The band's first major live appearance. Raw energy on stage and a defining public moment for Paralyze.",
    href: "/timeline",
    linkLabel: "View Timeline"
  },
  {
    title: "Next Show",
    badge: "TBA",
    urgent: true,
    meta: "Date To Be Announced",
    body: "A new show is being planned. Follow us for the announcement — venue and ticket details coming soon.",
    href: "/news",
    linkLabel: "Stay Updated"
  },
  {
    title: "Booking",
    meta: "For promoters & venues",
    body: "Reach out for stage requirements, EPK, and booking inquiries. We are available for local and touring shows.",
    href: "mailto:booking@paralyze.band",
    linkLabel: "Contact Us"
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
        Live performances, upcoming shows, and booking information.
      </PageIntro>
      <CardGrid cards={cards} />
    </>
  );
}
