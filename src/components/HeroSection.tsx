import heroPlayer from '../assets/hero-player.svg'
import pitchCard from '../assets/pitch-card.svg'
import trophyCard from '../assets/trophy-card.svg'

type HeroSectionProps = {
  playersCount: number
  openMarkets: number
  totalPotLabel: string
  eventDateLabel: string
}

export function HeroSection({
  playersCount,
  openMarkets,
  totalPotLabel,
  eventDateLabel,
}: HeroSectionProps) {
  return (
    <section className="hero-showcase fade-slide-up" id="home">
      <div className="hero-copy">
        <p className="eyebrow">Silvio Cup 2026</p>
        <div className="hero-pills" aria-hidden="true">
          <span className="hero-pill hero-pill-live">Edicao premium</span>
          <span className="hero-pill">Arena FIFA</span>
          <span className="hero-pill">Apostas em tempo real</span>
        </div>
        <h1>Silvio Cup</h1>
        <p className="hero-subtitle">O campeonato mais competitivo entre amigos</p>
        <p className="lead">
          Uma experiência completa para acompanhar elencos, ranking, confrontos e apostas com visual
          moderno, esportivo e cheio de energia.
        </p>

        <div className="hero-actions">
          <a className="primary-button" href="#times">
            Ver Times
          </a>
          <a className="ghost-button" href="#ranking">
            Ver Ranking
          </a>
        </div>
      </div>

      <div className="hero-side">
        <div className="hero-media-card">
          <img src={heroPlayer} alt="Arte esportiva da Silvio Cup" />
          <div className="hero-floating-card">
            <span>Visual inspirado em landing pages esportivas modernas</span>
            <strong>Glass + energia laranja + destaque para stats</strong>
          </div>
        </div>

        <div className="hero-stats-grid">
          <div className="hero-panel-card stat-orange">
            <span>Times na disputa</span>
            <strong>{playersCount}</strong>
          </div>
          <div className="hero-panel-card">
            <span>Mercados abertos</span>
            <strong>{openMarkets}</strong>
          </div>
          <div className="hero-panel-card">
            <span>Volume em apostas</span>
            <strong>{totalPotLabel}</strong>
          </div>
          <div className="hero-panel-card hero-panel-image">
            <img src={trophyCard} alt="Trofeu estilizado da Silvio Cup" />
          </div>
          <div className="hero-panel-card hero-panel-image">
            <img src={pitchCard} alt="Campo de futebol estilizado" />
          </div>
          <div className="hero-panel-card">
            <span>Proximo encontro</span>
            <strong>{eventDateLabel}</strong>
          </div>
        </div>
      </div>

      <div className="hero-marquee" aria-hidden="true">
        <div className="hero-marquee-track">
          <span>RIVALIDADE</span>
          <span>COMPETITIVIDADE</span>
          <span>RESENHA ENTRE AMIGOS</span>
          <span>DECISAO</span>
          <span>PRESSAO</span>
          <span>GOLACO</span>
          <span>RAIXA</span>
          <span>CLIMA DE FINAL</span>
          <span>SS CUP</span>
          <span>RIVALIDADE</span>
          <span>COMPETITIVIDADE</span>
          <span>RESENHA ENTRE AMIGOS</span>
          <span>DECISAO</span>
          <span>PRESSAO</span>
          <span>GOLACO</span>
          <span>RAIXA</span>
          <span>CLIMA DE FINAL</span>
          <span>SS CUP</span>
        </div>
      </div>
    </section>
  )
}
