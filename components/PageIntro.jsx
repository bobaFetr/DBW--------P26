export default function PageIntro({ title, children }) {
  return (
    <section className="page-intro">
      <h2 className="section-title">{title}</h2>
      <p>{children}</p>
    </section>
  );
}
