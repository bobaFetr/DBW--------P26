import Link from "next/link";
import { safeExternalUrl, safeImageUrl } from "./securityUrls";

function isExternalHref(href) {
  return /^(https?:|mailto:)/i.test(href);
}

export default function CardGrid({ cards }) {
  return (
    <section className="card-grid-section">
      <div className="card-grid">
        {cards.map((card) => {
          const cover = safeImageUrl(card.cover);
          const href = card.href?.startsWith("/") ? card.href : safeExternalUrl(card.href);

          return (
          <article className="card" key={card.title}>
            {cover ? (
              <div className="card-cover">
                <img src={cover} alt={card.coverAlt ?? card.title} />
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
              {card.body ? <p className="card-copy">{card.body}</p> : null}
              {href && isExternalHref(href) ? (
                <a className="action-link" href={href} target="_blank" rel="noreferrer">
                  <span>{card.linkLabel ?? "View"}</span>
                </a>
              ) : href ? (
                  <Link className="action-link" href={href}>
                    <span>{card.linkLabel ?? "View"}</span>
                  </Link>
                ) : null}
            </div>
          </article>
          );
        })}
      </div>
    </section>
  );
}
