import ApiCardGrid from "../../components/ApiCardGrid";
import PageIntro from "../../components/PageIntro";

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
      <ApiCardGrid contentType="singles" emptyMessage="No singles have been published yet." />
    </>
  );
}
