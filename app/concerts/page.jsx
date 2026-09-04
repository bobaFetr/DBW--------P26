import ApiCardGrid from "../../components/ApiCardGrid";
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
      <ApiCardGrid contentType="concerts" emptyMessage="No concerts have been published yet." />
    </>
  );
}
