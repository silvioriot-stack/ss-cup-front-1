type TeamCardProps = {
  name: string
  squad: string[]
}

export function TeamCard({ name, squad }: TeamCardProps) {
  return (
    <article className="team-card fade-slide-up">
      <div className="team-card-top">
        <div>
          <span className="team-tag">Time oficial</span>
          <h3>{name}</h3>
        </div>
        <strong>{squad.length}</strong>
      </div>

      <ol className="team-player-list">
        {squad.map((player) => (
          <li key={`${name}-${player}`}>{player}</li>
        ))}
      </ol>
    </article>
  )
}
