import { Suspense } from "react";
import AlbumBrowser from "../../components/AlbumBrowser";
import PageIntro from "../../components/PageIntro";

export const metadata = {
  title: "Albums",
  description: "Paralyze albums, full releases, artwork, and tracklist space."
};

export default function AlbumsPage() {
  return (
    <>
      <PageIntro title="Albums">
        Full releases, collections, and recordings from the Paralyze catalog.
      </PageIntro>
      <Suspense fallback={<p className="content-empty-state">Loading albums...</p>}>
        <AlbumBrowser emptyMessage="No albums have been published yet." />
      </Suspense>
    </>
  );
}
