import { loadPublicContent } from "./publicContent";

function formatDate(value) {
  return value ? String(value).slice(0, 10) : "";
}

export default function Timeline() {
  const items = loadPublicContent("timeline").map((row) => ({
    date: formatDate(row.date),
    title: row.event,
    description: row.description
  }));

  return (
    <section className="timeline-section">
      {!items.length ? (
        <p className="content-empty-state">No timeline entries have been published yet.</p>
      ) : null}
      <div className="timeline">
        {items.map((item) => (
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
  );
}
