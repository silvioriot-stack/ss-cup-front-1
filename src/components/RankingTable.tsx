type RankingRow = {
  name: string
  points: number
  goalDifference: number
  goalsFor: number
}

type RankingTableProps = {
  rows: RankingRow[]
}

const medals = ['🥇', '🥈', '🥉']

export function RankingTable({ rows }: RankingTableProps) {
  return (
    <section className="ranking-panel fade-slide-up" id="ranking">
      <div className="section-header">
        <div>
          <p className="eyebrow">Ranking</p>
          <h2>Classificação geral</h2>
        </div>
        <span className="section-caption">Top times da Silvio Cup</span>
      </div>

      <div className="table-wrap">
        <table className="ranking-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Time</th>
              <th>Pts</th>
              <th>SG</th>
              <th>GF</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr
                key={row.name}
                className={index === 0 ? 'ranking-first' : index < 3 ? 'ranking-podium' : ''}
              >
                <td>{medals[index] ?? `${index + 1}º`}</td>
                <td>{row.name}</td>
                <td>{row.points}</td>
                <td>{row.goalDifference}</td>
                <td>{row.goalsFor}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
