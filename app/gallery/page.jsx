import PageIntro from "../../components/PageIntro";

export const metadata = {
  title: "Gallery",
  description: "Paralyze gallery for live photos, promo shots, artwork, and logo variations."
};

export default function GalleryPage() {
  return (
    <>
      <PageIntro title="Gallery">
        A standalone gallery page gives you room for live photos, promo shots, and
        logo variations.
      </PageIntro>
      <section className="gallery-section">
        <div className="gallery-layout">
          <div className="gallery-copy">
            <h2 className="section-title">Visual Archive</h2>
            <p>
              This page stays image-ready even before the media folder is complete,
              so it can grow naturally as you add real assets.
            </p>
          </div>
          <div className="gallery-grid">
            <div className="gallery-item">
              <div className="gallery-caption">Live Mood</div>
            </div>
            <div className="gallery-item photo">
              <div className="gallery-caption">Promo Shot</div>
            </div>
            <div className="gallery-item alt-logo">
              <div className="gallery-caption">Logo Focus</div>
            </div>
            <div className="gallery-item">
              <div className="gallery-caption">Future Artwork</div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
