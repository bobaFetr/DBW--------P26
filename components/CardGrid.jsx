import Link from "next/link";

export default function CardGrid({ cards }) {
  return (
    <section className="card-grid-section">
      <div className="card-grid">
        {cards.map((card) => (
          <article className="card" key={card.title}>
            <h3>{card.title}</h3>
            {card.meta ? <p className="meta">{card.meta}</p> : null}
            <p>{card.body}</p>
            {card.href ? (
              <Link className="action-link" href={card.href}>
                <span>{card.linkLabel}</span>
              </Link>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  );
}
