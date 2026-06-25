import { Suspense } from "react";
import PageIntro from "../../components/PageIntro";
import SingleBrowser from "../../components/SingleBrowser";

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
      <Suspense fallback={<p className="content-empty-state">Loading singles...</p>}>
        <SingleBrowser emptyMessage="No singles have been published yet." />
      </Suspense>
    </>
  );
}
