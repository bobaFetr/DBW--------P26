import ApiCardGrid from "../../components/ApiCardGrid";
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
      <ApiCardGrid contentType="albums" emptyMessage="No albums have been published yet." />
    </>
  );
}
