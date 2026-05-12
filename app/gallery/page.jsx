import PageIntro from "../../components/PageIntro";
import GalleryGrid from "./GalleryGrid";

export const metadata = {
  title: "Gallery",
  description: "Paralyze gallery for live photos, promo shots, artwork, and logo variations."
};

export default function GalleryPage() {
  return (
    <>
      <PageIntro title="Gallery">
        Live shots, promo artwork, and behind-the-scenes moments. Click any image to expand.
      </PageIntro>
      <section className="gallery-section">
        <GalleryGrid />
      </section>
    </>
  );
}
