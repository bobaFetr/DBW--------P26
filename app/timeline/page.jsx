import PageIntro from "../../components/PageIntro";

const timelineItems = [
  {
    date: "December 27, 2024",
    title: "BAND FOUNDED",
    description:
      "The project was founded by Tonislav and Kris. The journey began with a shared vision to create powerful metal music."
  },
  {
    date: "September 11, 2025",
    title: "FIRST DEMO RELEASE",
    description:
      '"Guilt and killer (demo)" was released, marking the first official recording and introduction to the world.'
  },
  {
    date: "October 28, 2025",
    title: "SECOND DEMO RELEASE",
    description:
      '"Misery (demo)" was released, showcasing the band\'s evolving sound and musical direction.'
  },
  {
    date: "October 31, 2025",
    title: "OLD SKULLS PERFORMANCE",
    description:
      "A major live performance moment where the band showcased raw energy on stage and began defining its public presence."
  },
  {
    date: "February 1, 2026",
    title: "LIVE RECORDING RELEASE",
    description:
      "The live recording from Old Skulls captured the intensity of the performance and preserved an important moment in the project's growth."
  },
  {
    date: "2025 - Present",
    title: "ONGOING JOURNEY",
    description:
      "The band continues to write, perform, and evolve. New music, concerts, and future milestones are still ahead."
  }
];

export const metadata = {
  title: "Timeline",
  description:
    "Paralyze project timeline with major milestones, demo releases, and live moments."
};

export default function TimelinePage() {
  return (
    <>
      <PageIntro title="Timeline">
        This project archive tracks the milestones that shaped the path into the
        current Paralyze direction.
      </PageIntro>
      <section className="timeline-section">
        <div className="timeline">
          {timelineItems.map((item) => (
            <article className="timeline-item" key={`${item.date}-${item.title}`}>
              <div className="timeline-dot" />
              <div className="timeline-content">
                <div className="timeline-date">{item.date}</div>
                <div className="timeline-title">{item.title}</div>
                <div className="timeline-description">{item.description}</div>
              </div>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}
