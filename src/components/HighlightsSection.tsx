type HighlightCard = {
  title: string
  value: string
  description: string
}

type HighlightsSectionProps = {
  cards: HighlightCard[]
}

export function HighlightsSection({ cards }: HighlightsSectionProps) {
  return (
    <section className="highlights-panel fade-slide-up">
      <div className="section-header">
        <div>
          <p className="eyebrow">Destaques</p>
          <h2>Os mais fortes do campeonato</h2>
        </div>
        <span className="section-caption">Estatísticas e favoritos</span>
      </div>

      <div className="highlights-grid">
        {cards.map((card) => (
          <article key={card.title} className="highlight-card">
            <span>{card.title}</span>
            <strong>{card.value}</strong>
            <p>{card.description}</p>
          </article>
        ))}
      </div>
    </section>
  )
}
