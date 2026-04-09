import PageIntro from "../../components/PageIntro";

export const metadata = {
  title: "About",
  description:
    "About Paralyze, the project's identity, atmosphere, and artistic direction."
};

export default function AboutPage() {
  return (
    <>
      <PageIntro title="About Paralyze">
        This page gives the project a dedicated space for identity, influences, and
        the overall feeling behind the band.
      </PageIntro>
      <section className="split-panel">
        <div>
          <h2 className="section-title">Core Idea</h2>
          <p>
            Paralyze leans into a darker, stripped-back direction with a stronger
            logo focus and a colder monochrome palette.
          </p>
          <p>
            The page is ready for the real band story, influences, and mission once
            you want to move from structure into final content.
          </p>
        </div>
        <div
          className="image-panel image-panel-about"
          role="img"
          aria-label="Paralyze monochrome performance artwork placeholder"
        >
          <span>PARALYZE</span>
        </div>
      </section>
      <section className="content-panel">
        <h2 className="section-title">Suggested Topics For This Page</h2>
        <ul>
          <li>How the project started</li>
          <li>What genre and atmosphere define the sound</li>
          <li>What separates Paralyze from earlier site directions</li>
          <li>A short statement for listeners, promoters, and collaborators</li>
        </ul>
      </section>
    </>
  );
}
