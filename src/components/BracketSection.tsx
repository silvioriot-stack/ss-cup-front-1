type BracketMatch = {
  label: string
  home: string
  away: string
  score?: string
}

type BracketRound = {
  title: string
  matches: BracketMatch[]
}

type BracketSectionProps = {
  rounds: BracketRound[]
}

export function BracketSection({ rounds }: BracketSectionProps) {
  return (
    <section className="bracket-panel fade-slide-up" id="confrontos">
      <div className="section-header">
        <div>
          <p className="eyebrow">Confrontos</p>
          <h2>Chaveamento do torneio</h2>
        </div>
        <span className="section-caption">Visual estilo eliminatória</span>
      </div>

      <div className="bracket-grid">
        {rounds.map((round) => (
          <div key={round.title} className="bracket-column">
            <div className="bracket-title">{round.title}</div>
            <div className="bracket-match-list">
              {round.matches.map((match) => (
                <article key={`${round.title}-${match.label}`} className="bracket-match">
                  <span className="bracket-label">{match.label}</span>
                  <strong>{match.home}</strong>
                  <strong>{match.away}</strong>
                  <small>{match.score ?? 'A definir'}</small>
                </article>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
