import ContentCardGrid from "../../components/ContentCardGrid";
import PageIntro from "../../components/PageIntro";

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
      <ContentCardGrid contentType="concerts" emptyMessage="No concerts have been published yet." />
    </>
  );
}
