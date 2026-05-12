import Link from "next/link";

export default function CardGrid({ cards }) {
  return (
    <section className="card-grid-section">
      <div className="card-grid">
        {cards.map((card) => (
          <article className="card" key={card.title}>
            {card.cover ? (
              <div className="card-cover">
                <img src={card.cover} alt={card.coverAlt ?? card.title} />
              </div>
            ) : (
              <div className="card-cover" aria-hidden="true">
                PARALYZE
              </div>
            )}
            <div className="card-body">
              <div className="card-topline">
                <h3>{card.title}</h3>
                {card.badge ? (
                  <span className={`card-badge${card.urgent ? " urgent" : ""}`}>
                    {card.badge}
                  </span>
                ) : null}
              </div>
              {card.meta ? <p className="meta">{card.meta}</p> : null}
              <p>{card.body}</p>
              {card.href ? (
                <Link className="action-link" href={card.href}>
                  <span>{card.linkLabel ?? "View"}</span>
                </Link>
              ) : null}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
