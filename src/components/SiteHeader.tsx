import { useState } from 'react'

type SiteHeaderProps = {
  currentUserName: string
  currentUserRole: string
  onRefresh: () => void
  onLogout: () => void
  showConfrontos: boolean
  adminMode?: boolean
}

export function SiteHeader({
  currentUserName,
  currentUserRole,
  onRefresh,
  onLogout,
  showConfrontos,
  adminMode = false,
}: SiteHeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const navItems = adminMode
    ? [
        { href: '#partidas-admin', label: 'Partidas' },
        { href: '#mercados-admin', label: 'Mercados' },
        { href: '#grupos-admin', label: 'Grupos' },
      ]
    : [
        { href: '#home', label: 'Home' },
        { href: '#times', label: 'Times' },
        { href: '#ranking', label: 'Ranking' },
        ...(showConfrontos ? [{ href: '#confrontos', label: 'Confrontos' }] : []),
        { href: '#apostas', label: 'Apostas' },
      ]

  return (
    <header className={menuOpen ? 'site-header menu-open' : 'site-header'}>
      <a className="brand-mark" href={adminMode ? '#partidas-admin' : '#home'}>
        <span className="brand-badge">SC</span>
        <div>
          <strong>Silvio Cup</strong>
          <span>{adminMode ? 'Painel administrativo' : 'Campeonato entre amigos'}</span>
        </div>
        <span className="header-live-pill">2026</span>
      </a>

      <button
        className={menuOpen ? 'menu-toggle open' : 'menu-toggle'}
        type="button"
        aria-label={menuOpen ? 'Fechar menu' : 'Abrir menu'}
        aria-expanded={menuOpen}
        aria-controls="site-header-panel"
        onClick={() => setMenuOpen((value) => !value)}
      >
        <span />
        <span />
        <span />
      </button>

      <div className={menuOpen ? 'site-header-panel open' : 'site-header-panel'} id="site-header-panel">
        <nav className="site-nav">
          {navItems.map((item) => (
            <a key={item.href} href={item.href} onClick={() => setMenuOpen(false)}>
              {item.label}
            </a>
          ))}
        </nav>

        <div className="site-header-actions">
          <div className="user-badge user-badge-inline">
            <span>{currentUserRole === 'admin' ? 'Administrador' : 'Jogador'}</span>
            <strong>{currentUserName}</strong>
          </div>
          <button
            className="ghost-button header-button"
            type="button"
            onClick={() => {
              setMenuOpen(false)
              onRefresh()
            }}
          >
            Atualizar
          </button>
          <button
            className="ghost-button header-button"
            type="button"
            onClick={() => {
              setMenuOpen(false)
              onLogout()
            }}
          >
            Sair
          </button>
        </div>
      </div>
    </header>
  )
}
