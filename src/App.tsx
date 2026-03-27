import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { apiRequest, ApiError } from './api'
import { BracketSection } from './components/BracketSection'
import { HeroSection } from './components/HeroSection'
import { HighlightsSection } from './components/HighlightsSection'
import { RankingTable } from './components/RankingTable'
import { SiteHeader } from './components/SiteHeader'
import { TeamCard } from './components/TeamCard'

type UserRole = 'player' | 'admin'
type MarketStatus = 'aberta' | 'travada' | 'encerrada'
type MatchStage = 'groups' | 'playoff' | 'semifinal' | 'final' | 'third-place'

type AuthUser = {
  id: string
  name: string
  role: UserRole
  squad: string[]
}

type Session = {
  token: string
  user: AuthUser
}

type TournamentBlock = {
  title: string
  items: string[]
}

type TournamentEdition = {
  year: number
  champion: string
  subtitle?: string
  notes: string[]
}

type TournamentConfig = {
  title: string
  eventDate: string
  address: string
  editions?: TournamentEdition[]
  podiumPrizes: TournamentBlock[]
  specialPrizes: TournamentBlock[]
  rules: TournamentBlock[]
  matchSettings?: {
    minutesPerHalf: number
    speed: string
    injuries: boolean
    competitiveMode: boolean
    lineupsUpdated: boolean
    camera: string
  }
}

type UserSummary = {
  _id: string
  name: string
  role: UserRole
  squad: string[]
  active: boolean
}

type Group = {
  _id: string
  name: 'A' | 'B'
  players: UserSummary[]
}

type GroupTableRow = {
  playerId: string
  name: string
  points: number
  goalsFor: number
  goalsAgainst: number
  goalDifference: number
  wins: number
  draws: number
  losses: number
  games: number
}

type GroupTable = {
  group: 'A' | 'B'
  table: GroupTableRow[]
}

type Match = {
  _id: string
  stage: MatchStage
  roundName: string
  groupName?: 'A' | 'B'
  homePlayer: UserSummary
  awayPlayer: UserSummary
  kickoffAt?: string
  location?: string
  leg: number
  status: 'scheduled' | 'live' | 'finished' | 'cancelled'
  homeScore: number
  awayScore: number
  goalEntries: {
    ownerPlayer: string
    athleteName: string
    goals: number
  }[]
  notes?: string
}

type MarketOption = {
  label: string
  odd: number
}

type MarketBet = {
  _id: string
  choiceLabel: string
  odd: number
  amount: number
  potentialReturn: number
  createdAt: string
  bettor: {
    _id: string
    name: string
    role: UserRole
  }
}

type Market = {
  _id: string
  title: string
  description: string
  fixture: string
  closeAt: string
  options: MarketOption[]
  minStake: number
  maxStake: number
  status: MarketStatus
  match?: Match | null
  pot: number
  totalBets: number
  bets: MarketBet[]
}

type HighlightCard = {
  title: string
  value: string
  description: string
}

type ScorerRow = {
  athleteName: string
  ownerPlayerId: string
  ownerPlayerName: string
  goals: number
}

type LoginFormState = {
  role: UserRole
  name: string
  password: string
}

type MarketFormState = {
  title: string
  description: string
  fixture: string
  closeAt: string
  optionsText: string
  minStake: string
  maxStake: string
  status: MarketStatus
  matchId: string
}

type MatchFormState = {
  stage: MatchStage
  roundName: string
  groupName: '' | 'A' | 'B'
  homePlayer: string
  awayPlayer: string
  kickoffAt: string
  location: string
  leg: string
}

type NoticeTone = 'info' | 'success' | 'error'

type NotificationState = {
  text: string
  tone: NoticeTone
}

const sessionKey = 'sscup-session'

const emptyMarketForm = (): MarketFormState => ({
  title: '',
  description: '',
  fixture: '',
  closeAt: '',
  optionsText: 'Sim|9.00\nNao|2.00',
  minStake: '10',
  maxStake: '100',
  status: 'aberta',
  matchId: '',
})

const emptyMatchForm = (): MatchFormState => ({
  stage: 'playoff',
  roundName: '',
  groupName: '',
  homePlayer: '',
  awayPlayer: '',
  kickoffAt: '',
  location: '',
  leg: '1',
})

function readStorage<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback

  try {
    const value = window.localStorage.getItem(key)
    return value ? (JSON.parse(value) as T) : fallback
  } catch {
    return fallback
  }
}

function saveStorage<T>(key: string, value: T) {
  window.localStorage.setItem(key, JSON.stringify(value))
}

function removeStorage(key: string) {
  window.localStorage.removeItem(key)
}

function formatMoney(value: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
  }).format(value)
}

function formatDate(dateValue?: string) {
  if (!dateValue) return 'Não definido'

  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(dateValue))
}

function getStatusLabel(status: MarketStatus) {
  if (status === 'aberta') return 'Aberta'
  if (status === 'travada') return 'Travada'
  return 'Encerrada'
}

function getStageLabel(stage: MatchStage) {
  const labels: Record<MatchStage, string> = {
    groups: 'Fase de grupos',
    playoff: 'Playoff',
    semifinal: 'Semifinal',
    final: 'Final',
    'third-place': '3º lugar',
  }

  return labels[stage]
}

function buildFixtureFromMatch(match: Match) {
  return `${match.homePlayer.name} x ${match.awayPlayer.name}`
}

function parseMarketOptions(input: string) {
  return input
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [label, oddText] = line.split('|').map((part) => part.trim())
      const odd = Number(oddText)

      return {
        label,
        odd,
      }
    })
}

function getAvailableOptions(
  users: UserSummary[],
  groupAssignments: { A: string[]; B: string[] },
  groupName: 'A' | 'B',
  index: number,
) {
  const current = groupAssignments[groupName][index]
  const taken = new Set(
    [...groupAssignments.A, ...groupAssignments.B].filter(
      (playerId) => playerId && playerId !== current,
    ),
  )

  return users.filter((user) => !taken.has(user._id) || user._id === current)
}

function getGoalFilterKey(matchId: string, ownerPlayerId: string) {
  return `${matchId}:${ownerPlayerId}`
}

function App() {
  const [session, setSession] = useState<Session | null>(() =>
    readStorage<Session | null>(sessionKey, null),
  )
  const [tournament, setTournament] = useState<TournamentConfig | null>(null)
  const [users, setUsers] = useState<UserSummary[]>([])
  const [groups, setGroups] = useState<Group[]>([])
  const [groupTables, setGroupTables] = useState<GroupTable[]>([])
  const [matches, setMatches] = useState<Match[]>([])
  const [markets, setMarkets] = useState<Market[]>([])
  const [highlightCards, setHighlightCards] = useState<HighlightCard[]>([])
  const [scorerRanking, setScorerRanking] = useState<ScorerRow[]>([])
  const [loginForm, setLoginForm] = useState<LoginFormState>({
    role: 'player',
    name: '',
    password: '',
  })
  const [marketForm, setMarketForm] = useState<MarketFormState>(emptyMarketForm)
  const [matchForm, setMatchForm] = useState<MatchFormState>(emptyMatchForm)
  const [editingMarketId, setEditingMarketId] = useState<string | null>(null)
  const [groupAssignments, setGroupAssignments] = useState<{ A: string[]; B: string[] }>({
    A: ['', '', '', ''],
    B: ['', '', '', ''],
  })
  const [betAmounts, setBetAmounts] = useState<Record<string, string>>({})
  const [betChoices, setBetChoices] = useState<Record<string, string>>({})
  const [scoreDrafts, setScoreDrafts] = useState<
    Record<string, { homeScore: string; awayScore: string }>
  >({})
  const [goalFilters, setGoalFilters] = useState<Record<string, string>>({})
  const [message, setMessage] = useState<NotificationState>({
    text: 'Carregando informacoes da SS CUP.',
    tone: 'info',
  })
  const [loginError, setLoginError] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isBusy, setIsBusy] = useState(false)

  const currentUser = session?.user ?? null
  const token = session?.token
  const isAdminView = currentUser?.role === 'admin'
  const playerUsers = useMemo(
    () => users.filter((user) => user.role === 'player'),
    [users],
  )

  const allBets = useMemo(
    () =>
      markets.flatMap((market) =>
        market.bets.map((bet) => ({
          ...bet,
          marketId: market._id,
          marketTitle: market.title,
        })),
      ),
    [markets],
  )

  const totalPot = useMemo(
    () => markets.reduce((total, market) => total + market.pot, 0),
    [markets],
  )

  const currentUserBets = useMemo(
    () =>
      allBets
        .filter((bet) => bet.bettor._id === currentUser?.id)
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt)),
    [allBets, currentUser],
  )

  const recentBets = useMemo(
    () => [...allBets].sort((left, right) => right.createdAt.localeCompare(left.createdAt)).slice(0, 8),
    [allBets],
  )

  const marketSummaries = useMemo(
    () =>
      markets.map((market) => {
        const grouped = market.options.map((option) => ({
          label: option.label,
          count: market.bets.filter((bet) => bet.choiceLabel === option.label).length,
        }))

        return {
          ...market,
          leadingOption:
            grouped.sort((left, right) => right.count - left.count)[0]?.label ??
            market.options[0]?.label ??
            '-',
        }
      }),
    [markets],
  )

  const overallRanking = useMemo(
    () =>
      groupTables
        .flatMap((groupTable) => groupTable.table)
        .sort((left, right) => {
          if (right.points !== left.points) return right.points - left.points
          if (right.goalDifference !== left.goalDifference) {
            return right.goalDifference - left.goalDifference
          }
          return right.goalsFor - left.goalsFor
        }),
    [groupTables],
  )

  const hasRealBracket = useMemo(
    () => matches.some((match) => match.stage !== 'groups'),
    [matches],
  )

  const bracketRounds = useMemo(() => {
    const knockoutMatches = matches.filter((match) => match.stage !== 'groups')

    if (knockoutMatches.length) {
      const roundOrder: MatchStage[] = ['playoff', 'semifinal', 'final', 'third-place']
      return roundOrder
        .map((stage) => ({
          title: getStageLabel(stage),
          matches: knockoutMatches
            .filter((match) => match.stage === stage)
            .map((match, index) => ({
              label: `${match.roundName} ${index + 1}`,
              home: match.homePlayer.name,
              away: match.awayPlayer.name,
              score:
                match.status === 'finished' || match.status === 'live'
                  ? `${match.homeScore} x ${match.awayScore}`
                  : undefined,
            })),
        }))
        .filter((round) => round.matches.length > 0)
    }

    const groupA = groupTables.find((table) => table.group === 'A')?.table ?? []
    const groupB = groupTables.find((table) => table.group === 'B')?.table ?? []
    const safe = (entries: GroupTableRow[], index: number, fallback: string) =>
      entries[index]?.name ?? fallback

    return [
      {
        title: 'Playoff',
        matches: [
          {
            label: 'Playoff 1',
            home: safe(groupA, 1, 'A2'),
            away: safe(groupB, 2, 'B3'),
          },
          {
            label: 'Playoff 2',
            home: safe(groupB, 1, 'B2'),
            away: safe(groupA, 2, 'A3'),
          },
        ],
      },
      {
        title: 'Semifinal',
        matches: [
          {
            label: 'Semi 1',
            home: safe(groupA, 0, 'A1'),
            away: 'Vencedor Playoff 2',
          },
          {
            label: 'Semi 2',
            home: safe(groupB, 0, 'B1'),
            away: 'Vencedor Playoff 1',
          },
        ],
      },
      {
        title: 'Final',
        matches: [
          {
            label: 'Grande final',
            home: 'Vencedor Semi 1',
            away: 'Vencedor Semi 2',
          },
        ],
      },
    ]
  }, [groupTables, matches])

  useEffect(() => {
    if (session) {
      saveStorage(sessionKey, session)
    } else {
      removeStorage(sessionKey)
    }
  }, [session])

  useEffect(() => {
    if (!loginForm.name && playerUsers[0]) {
      setLoginForm((current) => ({ ...current, name: playerUsers[0].name }))
    }
  }, [loginForm.name, playerUsers])

  useEffect(() => {
    setBetChoices((current) => {
      const next = { ...current }

      for (const market of markets) {
        const labels = market.options.map((option) => option.label)
        if (!next[market._id] || !labels.includes(next[market._id])) {
          next[market._id] = labels[0] ?? ''
        }
      }

      return next
    })
  }, [markets])

  useEffect(() => {
    setScoreDrafts((current) => {
      const next = { ...current }

      for (const match of matches) {
        next[match._id] = {
          homeScore: current[match._id]?.homeScore ?? String(match.homeScore),
          awayScore: current[match._id]?.awayScore ?? String(match.awayScore),
        }
      }

      return next
    })
  }, [matches])

  useEffect(() => {
    if (groups.length === 2) {
      const groupA = groups.find((group) => group.name === 'A')?.players.map((player) => player._id) ?? []
      const groupB = groups.find((group) => group.name === 'B')?.players.map((player) => player._id) ?? []

      setGroupAssignments({
        A: [...groupA, ...Array(Math.max(0, 4 - groupA.length)).fill('')].slice(0, 4),
        B: [...groupB, ...Array(Math.max(0, 4 - groupB.length)).fill('')].slice(0, 4),
      })
      return
    }

    if (playerUsers.length >= 8) {
      setGroupAssignments({
        A: playerUsers.slice(0, 4).map((player) => player._id),
        B: playerUsers.slice(4, 8).map((player) => player._id),
      })
    }
  }, [groups, playerUsers])

  useEffect(() => {
    void bootstrap()
  }, [])

  useEffect(() => {
    if (!message.text) return

    const timeoutId = window.setTimeout(() => {
      setMessage((current) => (current.text === message.text ? { ...current, text: '' } : current))
    }, message.tone === 'error' ? 6200 : 4200)

    return () => window.clearTimeout(timeoutId)
  }, [message])

  function showMessage(text: string, tone: NoticeTone = 'info') {
    setMessage({ text, tone })
  }

  function showSuccess(text: string) {
    showMessage(text, 'success')
  }

  function showError(text: string) {
    showMessage(text, 'error')
  }

  function showInfo(text: string) {
    showMessage(text, 'info')
  }

  async function bootstrap() {
    setIsLoading(true)

    try {
      await refreshData()

      if (token) {
        try {
          const me = await apiRequest<{ user: AuthUser }>('/api/auth/me', { token })
          setSession({ token, user: me.user })
        } catch {
          setSession(null)
          showInfo('Sessao antiga removida. Faça login novamente.')
        }
      } else {
        showInfo('Tudo pronto para acompanhar o campeonato e registrar apostas.')
      }
    } catch (error) {
      showError(getErrorMessage(error))
    } finally {
      setIsLoading(false)
    }
  }

  async function refreshData() {
    const [
      tournamentData,
      usersData,
      groupsData,
      tableData,
      matchesData,
      marketsData,
      highlightsData,
      scorersData,
    ] =
      await Promise.all([
        apiRequest<TournamentConfig>('/api/tournament'),
        apiRequest<UserSummary[]>('/api/users'),
        apiRequest<Group[]>('/api/groups'),
        apiRequest<GroupTable[]>('/api/groups/table'),
        apiRequest<Match[]>('/api/matches'),
        apiRequest<Market[]>('/api/markets'),
        apiRequest<HighlightCard[]>('/api/insights/highlights'),
        apiRequest<ScorerRow[]>('/api/insights/scorers'),
      ])

    setTournament(tournamentData)
    setUsers(usersData)
    setGroups(groupsData)
    setGroupTables(tableData)
    setMatches(matchesData)
    setMarkets(marketsData)
    setHighlightCards(highlightsData)
    setScorerRanking(scorersData)
  }

  function getErrorMessage(error: unknown) {
    if (error instanceof ApiError) return error.message
    if (error instanceof Error) return error.message
    return 'Erro inesperado ao carregar as informacoes.'
  }

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoginError('')
    setIsBusy(true)

    try {
      const response = await apiRequest<{ token: string; user: AuthUser }>('/api/auth/login', {
        method: 'POST',
        body: loginForm,
      })

      setSession(response)
      showSuccess(`${response.user.name} entrou na SS CUP.`)
      setLoginForm((current) => ({ ...current, password: '' }))
      await refreshData()
    } catch (error) {
      setLoginError(getErrorMessage(error))
    } finally {
      setIsBusy(false)
    }
  }

  function logout() {
    setSession(null)
    showInfo('Sessao encerrada. Faça login para continuar.')
  }

  async function handleRefresh() {
    setIsBusy(true)

    try {
      await refreshData()
      showSuccess('Dados atualizados com sucesso.')
    } catch (error) {
      showError(getErrorMessage(error))
    } finally {
      setIsBusy(false)
    }
  }

  async function handleBetSubmit(market: Market) {
    if (!currentUser || currentUser.role !== 'player' || !token) return

    const amount = Number(betAmounts[market._id])
    const choiceLabel = betChoices[market._id] ?? market.options[0]?.label ?? ''

    if (!choiceLabel) {
      showError('Selecione uma opcao antes de apostar.')
      return
    }

    setIsBusy(true)

    try {
      await apiRequest(`/api/markets/${market._id}/bets`, {
        method: 'POST',
        token,
        body: { choiceLabel, amount },
      })

      setBetAmounts((current) => ({ ...current, [market._id]: '' }))
      showSuccess(`Aposta registrada em ${market.title}.`)
      await refreshData()
    } catch (error) {
      showError(getErrorMessage(error))
    } finally {
      setIsBusy(false)
    }
  }

  function resetMarketForm() {
    setEditingMarketId(null)
    setMarketForm(emptyMarketForm())
  }

  async function handleMarketSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!token) return

    const options = parseMarketOptions(marketForm.optionsText)
    const minStake = Number(marketForm.minStake)
    const maxStake = Number(marketForm.maxStake)
    const selectedMatch = matches.find((match) => match._id === marketForm.matchId)
    const fixture = selectedMatch ? buildFixtureFromMatch(selectedMatch) : marketForm.fixture.trim()

    if (
      !marketForm.title.trim() ||
      !marketForm.description.trim() ||
      !fixture ||
      !marketForm.closeAt
    ) {
      showError('Preencha todas as informacoes do mercado.')
      return
    }

    if (
      options.length < 2 ||
      options.some((option) => !option.label || Number.isNaN(option.odd) || option.odd < 1.01)
    ) {
      showError('Use uma opcao por linha no formato "Nome da opcao|1.85".')
      return
    }

    if (Number.isNaN(minStake) || Number.isNaN(maxStake) || minStake <= 0 || maxStake < minStake) {
      showError('Defina corretamente os valores minimo e maximo da aposta.')
      return
    }

    setIsBusy(true)

    try {
      await apiRequest(editingMarketId ? `/api/markets/${editingMarketId}` : '/api/markets', {
        method: editingMarketId ? 'PATCH' : 'POST',
        token,
        body: {
          title: marketForm.title.trim(),
          description: marketForm.description.trim(),
          fixture,
          match: marketForm.matchId || null,
          closeAt: marketForm.closeAt,
          options,
          minStake,
          maxStake,
          status: marketForm.status,
        },
      })

      showSuccess(
        editingMarketId
          ? 'Mercado atualizado com odd e limites configurados.'
          : 'Mercado criado com odd e valor máximo configurados.',
      )
      resetMarketForm()
      await refreshData()
    } catch (error) {
      showError(getErrorMessage(error))
    } finally {
      setIsBusy(false)
    }
  }

  function handleEditMarket(market: Market) {
    setEditingMarketId(market._id)
    setMarketForm({
      title: market.title,
      description: market.description,
      fixture: market.fixture,
      closeAt: market.closeAt.slice(0, 16),
      optionsText: market.options.map((option) => `${option.label}|${option.odd}`).join('\n'),
      minStake: String(market.minStake),
      maxStake: String(market.maxStake),
      status: market.status,
      matchId: market.match?._id ?? '',
    })
  }

  async function handleRemoveMarket(marketId: string) {
    if (!token) return

    setIsBusy(true)

    try {
      await apiRequest(`/api/markets/${marketId}`, {
        method: 'DELETE',
        token,
      })
      showSuccess('Mercado removido com sucesso.')
      if (editingMarketId === marketId) resetMarketForm()
      await refreshData()
    } catch (error) {
      showError(getErrorMessage(error))
    } finally {
      setIsBusy(false)
    }
  }

  async function updateMarketStatus(marketId: string, status: MarketStatus) {
    if (!token) return

    setIsBusy(true)

    try {
      await apiRequest(`/api/markets/${marketId}`, {
        method: 'PATCH',
        token,
        body: { status },
      })
      showSuccess(`Mercado atualizado para ${getStatusLabel(status)}.`)
      await refreshData()
    } catch (error) {
      showError(getErrorMessage(error))
    } finally {
      setIsBusy(false)
    }
  }

  async function handleDrawGroups() {
    if (!token) return
    setIsBusy(true)

    try {
      await apiRequest('/api/groups/draw', {
        method: 'POST',
        token,
      })
      showSuccess('Grupos sorteados automaticamente.')
      await refreshData()
    } catch (error) {
      showError(getErrorMessage(error))
    } finally {
      setIsBusy(false)
    }
  }

  async function handleManualGroupsSubmit() {
    if (!token) return

    const groupA = groupAssignments.A.filter(Boolean)
    const groupB = groupAssignments.B.filter(Boolean)
    const unique = new Set([...groupA, ...groupB])

    if (groupA.length !== 4 || groupB.length !== 4 || unique.size !== 8) {
      showError('Preencha os 8 slots dos grupos sem repetir jogadores.')
      return
    }

    setIsBusy(true)

    try {
      await apiRequest('/api/groups/manual', {
        method: 'POST',
        token,
        body: {
          groups: [
            { name: 'A', playerIds: groupA },
            { name: 'B', playerIds: groupB },
          ],
        },
      })
      showSuccess('Grupos salvos manualmente.')
      await refreshData()
    } catch (error) {
      showError(getErrorMessage(error))
    } finally {
      setIsBusy(false)
    }
  }

  async function handleGenerateGroupMatches() {
    if (!token) return
    setIsBusy(true)

    try {
      await apiRequest('/api/matches/generate-group-stage', {
        method: 'POST',
        token,
      })
      showSuccess('Jogos da fase de grupos gerados com sucesso.')
      await refreshData()
    } catch (error) {
      showError(getErrorMessage(error))
    } finally {
      setIsBusy(false)
    }
  }

  async function handleCreateMatch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!token) return

    if (!matchForm.roundName.trim() || !matchForm.homePlayer || !matchForm.awayPlayer) {
      showError('Preencha rodada, mandante e visitante.')
      return
    }

    if (matchForm.homePlayer === matchForm.awayPlayer) {
      showError('Mandante e visitante nao podem ser o mesmo jogador.')
      return
    }

    setIsBusy(true)

    try {
      await apiRequest('/api/matches', {
        method: 'POST',
        token,
        body: {
          stage: matchForm.stage,
          roundName: matchForm.roundName.trim(),
          groupName: matchForm.stage === 'groups' ? matchForm.groupName || undefined : undefined,
          homePlayer: matchForm.homePlayer,
          awayPlayer: matchForm.awayPlayer,
          kickoffAt: matchForm.kickoffAt || undefined,
          location: matchForm.location.trim() || undefined,
          leg: Number(matchForm.leg) || 1,
        },
      })

      showSuccess('Partida criada com sucesso.')
      setMatchForm(emptyMatchForm())
      await refreshData()
    } catch (error) {
      showError(getErrorMessage(error))
    } finally {
      setIsBusy(false)
    }
  }

  function getRegisteredGoals(match: Match, ownerPlayerId: string) {
    return match.goalEntries
      .filter((entry) => entry.ownerPlayer === ownerPlayerId)
      .reduce((total, entry) => total + entry.goals, 0)
  }

  function getFilteredAthletes(match: Match, player: UserSummary) {
    const filterKey = getGoalFilterKey(match._id, player._id)
    const query = (goalFilters[filterKey] ?? '').trim().toLowerCase()

    return player.squad.filter((athlete) => athlete.toLowerCase().includes(query))
  }

  function getAthleteGoals(match: Match, ownerPlayerId: string, athleteName: string) {
    return (
      match.goalEntries.find(
        (entry) => entry.ownerPlayer === ownerPlayerId && entry.athleteName === athleteName,
      )?.goals ?? 0
    )
  }

  async function handleAddGoal(matchId: string, ownerPlayerId: string, athleteName: string) {
    if (!token) return

    setIsBusy(true)

    try {
      await apiRequest(`/api/matches/${matchId}/goals`, {
        method: 'PATCH',
        token,
        body: { ownerPlayerId, athleteName },
      })
      showSuccess(`Gol registrado para ${athleteName}.`)
      await refreshData()
    } catch (error) {
      showError(getErrorMessage(error))
    } finally {
      setIsBusy(false)
    }
  }

  async function handleSaveScore(matchId: string) {
    if (!token) return

    const draft = scoreDrafts[matchId]
    const homeScore = Number(draft?.homeScore)
    const awayScore = Number(draft?.awayScore)

    if (Number.isNaN(homeScore) || Number.isNaN(awayScore)) {
      showError('Preencha placares validos.')
      return
    }

    setIsBusy(true)

    try {
      await apiRequest(`/api/matches/${matchId}/score`, {
        method: 'PATCH',
        token,
        body: { homeScore, awayScore },
      })
      showSuccess('Placar salvo com sucesso.')
      await refreshData()
    } catch (error) {
      showError(getErrorMessage(error))
    } finally {
      setIsBusy(false)
    }
  }

  async function handleStartMatch(matchId: string) {
    if (!token) return

    setIsBusy(true)

    try {
      const response = await apiRequest<{
        lockedMarkets: number
        message: string
      }>(`/api/matches/${matchId}/play`, {
        method: 'PATCH',
        token,
      })

      showSuccess(
        response.lockedMarkets > 0
          ? `Partida iniciada. ${response.lockedMarkets} mercado(s) vinculado(s) foram travados.`
          : 'Partida iniciada. Nao havia mercados abertos vinculados a este jogo.',
      )
      await refreshData()
    } catch (error) {
      showError(getErrorMessage(error))
    } finally {
      setIsBusy(false)
    }
  }

  async function handleDeleteMatch(matchId: string) {
    if (!token) return
    setIsBusy(true)

    try {
      await apiRequest(`/api/matches/${matchId}`, {
        method: 'DELETE',
        token,
      })
      showSuccess('Partida removida com sucesso.')
      await refreshData()
    } catch (error) {
      showError(getErrorMessage(error))
    } finally {
      setIsBusy(false)
    }
  }

  if (isLoading) {
    return (
      <main className="login-shell">
        <section className="login-card">
          <div className="eyebrow">Silvio Cup</div>
          <h1>Silvio Cup</h1>
          <p className="hero-subtitle">O campeonato mais competitivo entre amigos</p>
          <p className="lead">
            Carregando torneio, grupos, jogos, placares e apostas.
          </p>
        </section>
      </main>
    )
  }

  if (!currentUser) {
    return (
      <main className="login-shell">
        <section className="login-card">
          <div className="eyebrow">Silvio Cup</div>
          <h1>Silvio Cup</h1>
          <p className="hero-subtitle">O campeonato mais competitivo entre amigos</p>
          <p className="lead">
            Entre para acompanhar os times, o ranking, os confrontos e as apostas da competição.
          </p>

          <form className="login-form" onSubmit={handleLogin}>
            <div className="role-switch">
              <button
                className={loginForm.role === 'player' ? 'active' : ''}
                type="button"
                onClick={() => setLoginForm((current) => ({ ...current, role: 'player' }))}
              >
                Jogador
              </button>
              <button
                className={loginForm.role === 'admin' ? 'active' : ''}
                type="button"
                onClick={() =>
                  setLoginForm((current) => ({ ...current, role: 'admin', name: 'Silvio' }))
                }
              >
                Administrador
              </button>
            </div>

            <label>
              Nome
              {loginForm.role === 'player' ? (
                <select
                  value={loginForm.name}
                  onChange={(event) =>
                    setLoginForm((current) => ({ ...current, name: event.target.value }))
                  }
                >
                  {playerUsers.map((player) => (
                    <option key={player._id} value={player.name}>
                      {player.name}
                    </option>
                  ))}
                </select>
              ) : (
                <input value="Silvio" disabled />
              )}
            </label>

            <label>
              Senha
              <input
                type="password"
                value={loginForm.password}
                onChange={(event) =>
                  setLoginForm((current) => ({ ...current, password: event.target.value }))
                }
              />
            </label>

            {loginError ? <p className="form-error">{loginError}</p> : null}

            <button className="primary-button" disabled={isBusy} type="submit">
              Entrar na SS CUP
            </button>
          </form>
        </section>
      </main>
    )
  }

  return (
    <div className="app-shell">
      <SiteHeader
        currentUserName={currentUser.name}
        currentUserRole={currentUser.role}
        onRefresh={() => void handleRefresh()}
        onLogout={logout}
        showConfrontos={hasRealBracket}
        adminMode={isAdminView}
      />

      <main className="dashboard">
        {isAdminView ? null : (
          <HeroSection
            playersCount={playerUsers.length}
            openMarkets={markets.filter((market) => market.status === 'aberta').length}
            totalPotLabel={formatMoney(totalPot)}
            eventDateLabel={formatDate(tournament?.eventDate)}
          />
        )}

        {message.text ? (
          <section
            className={`announcement announcement-${message.tone}`}
            aria-live="polite"
            aria-atomic="true"
          >
            <div className="announcement-copy">
              <strong>
                {message.tone === 'error'
                  ? 'Nao concluido'
                  : message.tone === 'success'
                    ? 'Sucesso'
                    : 'Aviso'}
              </strong>
              <p>{message.text}</p>
            </div>
            <button
              className="announcement-close"
              type="button"
              aria-label="Fechar aviso"
              onClick={() => setMessage((current) => ({ ...current, text: '' }))}
            >
              Fechar
            </button>
          </section>
        ) : null}

        {isAdminView ? null : (
          <>
            <section className="teams-showcase" id="times">
              <div className="section-header">
                <div>
                  <p className="eyebrow">Times</p>
                  <h2>Elencos oficiais da Silvio Cup</h2>
                </div>
                <span className="section-caption">Grid responsivo com os 15 jogadores de cada time</span>
              </div>

              <div className="teams-grid">
                {playerUsers.map((player) => (
                  <TeamCard key={player._id} name={player.name} squad={player.squad} />
                ))}
              </div>
            </section>

            <section className="showcase-grid">
              <RankingTable rows={overallRanking} />
              <HighlightsSection cards={highlightCards} />
            </section>

            <section className="card scorers-panel fade-slide-up">
              <div className="section-header">
                <div>
                  <p className="eyebrow">Artilharia</p>
                  <h2>Quem mais balançou a rede</h2>
                </div>
                <span className="section-caption">Ranking dos jogadores da lista com mais gols</span>
              </div>

              <div className="scorers-list">
                {scorerRanking.length ? (
                  scorerRanking.map((scorer, index) => (
                    <article key={`${scorer.ownerPlayerId}-${scorer.athleteName}`} className="scorer-row-card">
                      <div className="scorer-rank-badge">{index + 1}</div>
                      <div className="scorer-copy">
                        <strong>{scorer.athleteName}</strong>
                        <p>Time de {scorer.ownerPlayerName}</p>
                      </div>
                      <div className="scorer-goals">
                        <strong>{scorer.goals}</strong>
                        <span>gol(s)</span>
                      </div>
                    </article>
                  ))
                ) : (
                  <article className="scorer-row-card scorer-row-empty">
                    <strong>A artilharia vai aparecer aqui</strong>
                    <p>Registre gols dos atletas nas partidas para montar o ranking inicial.</p>
                  </article>
                )}
              </div>
            </section>

            {hasRealBracket ? <BracketSection rounds={bracketRounds} /> : null}
          </>
        )}

        <section className="matches-panel fade-slide-up" id={isAdminView ? 'partidas-admin' : undefined}>
          <div className="section-header">
            <div>
              <p className="eyebrow">Partidas</p>
              <h2>Agenda e resultados</h2>
            </div>
            <span className="section-caption">{matches.length} confronto(s) cadastrados</span>
          </div>

          <div className="match-showcase-grid">
            {matches.length ? (
              matches.map((match) => (
                <article key={match._id} className="match-item match-item-column">
                  <div className="match-item-top">
                    <div>
                      <strong>{buildFixtureFromMatch(match)}</strong>
                      <p>
                        {match.roundName} · {getStageLabel(match.stage)}
                        {match.groupName ? ` · Grupo ${match.groupName}` : ''}
                      </p>
                    </div>
                    <span>{formatDate(match.kickoffAt)}</span>
                  </div>

                  <div className="score-line">
                    <strong>
                      {match.homeScore} x {match.awayScore}
                    </strong>
                    <span
                      className={`status-pill ${
                        match.status === 'finished'
                          ? 'aberta'
                          : match.status === 'live'
                            ? 'travada'
                            : 'encerrada'
                      }`}
                    >
                      {match.status}
                    </span>
                  </div>

                  {currentUser.role === 'admin' ? (
                    <>
                      <div className="score-editor">
                        {match.status === 'scheduled' ? (
                          <button
                            className="primary-button"
                            type="button"
                            onClick={() => void handleStartMatch(match._id)}
                          >
                            Play
                          </button>
                        ) : null}
                        <input
                          type="number"
                          value={scoreDrafts[match._id]?.homeScore ?? ''}
                          onChange={(event) =>
                            setScoreDrafts((current) => ({
                              ...current,
                              [match._id]: {
                                homeScore: event.target.value,
                                awayScore: current[match._id]?.awayScore ?? '',
                              },
                            }))
                          }
                        />
                        <input
                          type="number"
                          value={scoreDrafts[match._id]?.awayScore ?? ''}
                          onChange={(event) =>
                            setScoreDrafts((current) => ({
                              ...current,
                              [match._id]: {
                                homeScore: current[match._id]?.homeScore ?? '',
                                awayScore: event.target.value,
                              },
                            }))
                          }
                        />
                        <button
                          className="ghost-button"
                          type="button"
                          onClick={() => void handleSaveScore(match._id)}
                        >
                          Salvar placar
                        </button>
                        <button
                          className="ghost-button danger"
                          type="button"
                          onClick={() => void handleDeleteMatch(match._id)}
                        >
                          Excluir
                        </button>
                      </div>

                      <div className="goal-manager">
                        {[match.homePlayer, match.awayPlayer].map((teamPlayer) => {
                          const filterKey = getGoalFilterKey(match._id, teamPlayer._id)
                          const filteredAthletes = getFilteredAthletes(match, teamPlayer)

                          return (
                            <div key={teamPlayer._id} className="goal-team-column">
                              <div className="goal-team-header">
                                <div>
                                  <strong>{teamPlayer.name}</strong>
                                  <p>
                                    Gols registrados: {getRegisteredGoals(match, teamPlayer._id)} /{' '}
                                    {teamPlayer._id === match.homePlayer._id
                                      ? match.homeScore
                                      : match.awayScore}
                                  </p>
                                </div>
                                <input
                                  className="goal-filter-input"
                                  placeholder="Filtrar atleta"
                                  value={goalFilters[filterKey] ?? ''}
                                  onChange={(event) =>
                                    setGoalFilters((current) => ({
                                      ...current,
                                      [filterKey]: event.target.value,
                                    }))
                                  }
                                />
                              </div>

                              <div className="goal-player-list">
                                {filteredAthletes.map((athlete) => (
                                  <div key={`${teamPlayer._id}-${athlete}`} className="goal-player-row">
                                    <span>{athlete}</span>
                                    <div className="goal-player-actions">
                                      <strong>{getAthleteGoals(match, teamPlayer._id, athlete)}</strong>
                                      <button
                                        className="primary-button goal-add-button"
                                        type="button"
                                        onClick={() => void handleAddGoal(match._id, teamPlayer._id, athlete)}
                                      >
                                        +1
                                      </button>
                                    </div>
                                  </div>
                                ))}

                                {filteredAthletes.length ? null : (
                                  <p className="muted">Nenhum atleta encontrado com esse filtro.</p>
                                )}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </>
                  ) : null}
                </article>
              ))
            ) : (
              <article className="card">
                <p className="muted">Nenhuma partida cadastrada ainda.</p>
              </article>
            )}
          </div>
        </section>

        {isAdminView ? null : (
          <>
            <section className="event-grid">
              <article className="card">
                <div className="section-title">
                  <h3>📍 Informações do evento</h3>
                  <span>🔥 {tournament?.title ?? 'SS CUP'}</span>
                </div>

                <div className="event-highlights">
                  <div className="info-tile">
                    <span>📅 Data</span>
                    <strong>{formatDate(tournament?.eventDate)}</strong>
                  </div>
                  <div className="info-tile">
                    <span>📍 Endereço</span>
                    <strong>{tournament?.address ?? 'Não definido'}</strong>
                  </div>
                  <div className="info-tile">
                    <span>⏱️ Tempo</span>
                    <strong>{tournament?.matchSettings?.minutesPerHalf ?? '-'} min por tempo</strong>
                  </div>
                  <div className="info-tile">
                    <span>🎥 Câmera</span>
                    <strong>{tournament?.matchSettings?.camera ?? '-'}</strong>
                  </div>
                </div>
              </article>

              <article className="card">
                <div className="section-title">
                  <h3>🏆 Premiação principal</h3>
                  <span>✨ Pódio oficial</span>
                </div>

                <div className="prize-grid">
                  {tournament?.podiumPrizes.map((prize) => (
                    <article key={prize.title} className="prize-card">
                      <div className="prize-title">
                        <strong>{prize.title}</strong>
                      </div>
                      <ul className="bullet-list compact">
                        {prize.items.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    </article>
                  ))}
                </div>
              </article>
            </section>

            <section className="card">
              <div className="section-title">
                <h3>🏆 Edições da SS CUP</h3>
                <span>📚 Histórico do campeonato</span>
              </div>

              <div className="editions-grid">
                {(tournament?.editions ?? []).map((edition) => (
                  <article
                    key={edition.year}
                    className={`edition-card ${edition.champion === 'Silvio' ? 'edition-card-champion' : ''}`}
                  >
                    <div className="edition-card-top">
                      <span className="edition-year">{edition.year}</span>
                      <span className="status-pill aberta">Edicao</span>
                    </div>

                    <strong>{edition.champion}</strong>
                    <p>{edition.subtitle ?? 'Resumo da edição'}</p>

                    <ul className="bullet-list compact">
                      {edition.notes.map((note) => (
                        <li key={`${edition.year}-${note}`}>{note}</li>
                      ))}
                    </ul>
                  </article>
                ))}
              </div>
            </section>

            <section className="card">
              <div className="section-title">
                <h3>🎖️ Premiações especiais</h3>
                  <span>✨ Destaques da competicao</span>
              </div>

              <div className="prize-grid special">
                {tournament?.specialPrizes.map((prize) => (
                  <article key={prize.title} className="prize-card">
                    <div className="prize-title">
                      <strong>{prize.title}</strong>
                    </div>
                    <ul className="bullet-list compact">
                      {prize.items.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </article>
                ))}
              </div>
            </section>

            <section className="card">
              <div className="section-title">
                <h3>📘 Regulamento oficial</h3>
                  <span>📋 Formato e regras</span>
              </div>

              <div className="rules-grid">
                {tournament?.rules.map((rule) => (
                  <article key={rule.title} className="rule-card">
                    <strong>{rule.title}</strong>
                    <ul className="bullet-list compact">
                      {rule.items.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </article>
                ))}
              </div>
            </section>
          </>
        )}

        <section className="betting-layout" id={isAdminView ? 'mercados-admin' : 'apostas'}>
          <div className="betting-column">
            <div className="section-heading">
              <div>
                <p className="eyebrow">{isAdminView ? 'Administração' : 'Apostas'}</p>
                <h2>{isAdminView ? 'Gestão dos mercados' : 'Mercados com odd e valor máximo'}</h2>
              </div>
            </div>

            <div className="market-grid">
              {marketSummaries.length ? (
                marketSummaries.map((market) => (
                  <article key={market._id} className="market-card">
                    <div className="market-header">
                      <div>
                        <span className={`status-pill ${market.status}`}>
                          {getStatusLabel(market.status)}
                        </span>
                        <h3>{market.title}</h3>
                      </div>
                      <strong>{formatMoney(market.pot)}</strong>
                    </div>

                    <p className="market-description">{market.description}</p>

                    <div className="market-meta">
                      <span>{market.fixture}</span>
                      <span>Fecha em {formatDate(market.closeAt)}</span>
                      <span>
                        Limite {formatMoney(market.minStake)} a {formatMoney(market.maxStake)}
                      </span>
                      <span>{market.match ? 'Mercado vinculado a partida' : 'Mercado livre'}</span>
                    </div>

                    <div className="option-list">
                      {market.options.map((option) => {
                        const isSelected = betChoices[market._id] === option.label

                        return (
                          <button
                            key={option.label}
                            className={isSelected ? 'option active option-card' : 'option option-card'}
                            type="button"
                            onClick={() =>
                              setBetChoices((current) => ({
                                ...current,
                                [market._id]: option.label,
                              }))
                            }
                          >
                            <span>{option.label}</span>
                            <strong>odd {option.odd.toFixed(2)}</strong>
                          </button>
                        )
                      })}
                    </div>

                    {isAdminView ? null : (
                      <div className="market-footer">
                        <label>
                          Valor
                          <input
                            type="number"
                            min={market.minStake}
                            max={market.maxStake}
                            value={betAmounts[market._id] ?? ''}
                            onChange={(event) =>
                              setBetAmounts((current) => ({
                                ...current,
                                [market._id]: event.target.value,
                              }))
                            }
                          />
                        </label>

                        <button
                          className="primary-button"
                          type="button"
                          disabled={market.status !== 'aberta' || currentUser.role !== 'player' || isBusy}
                          onClick={() => void handleBetSubmit(market)}
                        >
                          Apostar agora
                        </button>
                      </div>
                    )}

                    <div className="market-summary">
                      <span>{market.totalBets} aposta(s)</span>
                      <span>Mais escolhido: {market.leadingOption}</span>
                    </div>

                    {currentUser.role === 'admin' ? (
                      <div className="admin-inline-actions">
                        <select
                          value={market.status}
                          onChange={(event) =>
                            void updateMarketStatus(market._id, event.target.value as MarketStatus)
                          }
                        >
                          <option value="aberta">Aberta</option>
                          <option value="travada">Travada</option>
                          <option value="encerrada">Encerrada</option>
                        </select>
                        <button className="ghost-button" type="button" onClick={() => handleEditMarket(market)}>
                          Editar
                        </button>
                        <button
                          className="ghost-button danger"
                          type="button"
                          onClick={() => void handleRemoveMarket(market._id)}
                        >
                          Remover
                        </button>
                      </div>
                    ) : null}
                  </article>
                ))
              ) : (
                <article className="market-card">
                  <p className="muted">Nao ha nenhum mercado disponivel no momento.</p>
                </article>
              )}
            </div>
          </div>

          {isAdminView ? null : <aside className="sidebar-column">
            <article className="card">
              <div className="section-title">
                <h3>{currentUser.role === 'admin' ? 'Minhas ações' : 'Minhas apostas'}</h3>
                <span>{currentUserBets.length} registro(s)</span>
              </div>

              <div className="stack-list">
                {currentUserBets.length ? (
                  currentUserBets.slice(0, 6).map((bet) => (
                    <div key={bet._id} className="log-card">
                      <strong>{bet.marketTitle}</strong>
                      <p>
                        {bet.choiceLabel} · {formatMoney(bet.amount)} · odd {bet.odd.toFixed(2)}
                      </p>
                      <span>Retorno potencial: {formatMoney(bet.potentialReturn)}</span>
                    </div>
                  ))
                ) : (
                  <p className="muted">Nenhuma aposta registrada para este perfil.</p>
                )}
              </div>
            </article>

            <article className="card">
              <div className="section-title">
                <h3>Feed da mesa</h3>
                <span>Últimas apostas</span>
              </div>

              <div className="stack-list">
                {recentBets.length ? (
                  recentBets.map((bet) => (
                    <div key={bet._id} className="row-card">
                      <strong>{bet.bettor.name}</strong>
                      <p>
                        apostou {formatMoney(bet.amount)} em {bet.choiceLabel} com odd {bet.odd.toFixed(2)}
                      </p>
                    </div>
                  ))
                ) : (
                  <p className="muted">As apostas vão aparecer aqui conforme forem registradas.</p>
                )}
              </div>
            </article>
          </aside>}
        </section>

        {currentUser.role === 'admin' ? (
          <>
            <section className="admin-panel card">
              <div className="section-title">
                <h3>{editingMarketId ? 'Editar mercado' : 'Criar mercado'}</h3>
                <span>Odd, valor máximo e vínculo com jogo</span>
              </div>

              <p className="muted form-hint">
                Voce pode criar mercados vinculados a uma partida ou mercados livres, como "Vini ganha
                a primeira partida" com opcoes "Sim|9.00" e "Nao|2.00".
              </p>

              <form className="admin-form" onSubmit={handleMarketSubmit}>
                <label>
                  Título do mercado
                  <input
                    value={marketForm.title}
                    onChange={(event) =>
                      setMarketForm((current) => ({ ...current, title: event.target.value }))
                    }
                  />
                </label>

                <label>
                  Descrição
                  <textarea
                    rows={3}
                    value={marketForm.description}
                    onChange={(event) =>
                      setMarketForm((current) => ({ ...current, description: event.target.value }))
                    }
                  />
                </label>

                <label>
                  Partida vinculada
                  <select
                    value={marketForm.matchId}
                    onChange={(event) =>
                      setMarketForm((current) => {
                        const selectedMatch = matches.find(
                          (match) => match._id === event.target.value,
                        )

                        return {
                          ...current,
                          matchId: event.target.value,
                          fixture: selectedMatch ? buildFixtureFromMatch(selectedMatch) : current.fixture,
                        }
                      })
                    }
                  >
                    <option value="">Sem vínculo</option>
                    {matches.map((match) => (
                      <option key={match._id} value={match._id}>
                        {buildFixtureFromMatch(match)} · {match.roundName}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  Confronto / rotulo
                  <input
                    value={marketForm.fixture}
                    onChange={(event) =>
                      setMarketForm((current) => ({ ...current, fixture: event.target.value }))
                    }
                    placeholder="Ex: Vini ganha a primeira partida"
                  />
                </label>

                <label>
                  Fechamento
                  <input
                    type="datetime-local"
                    value={marketForm.closeAt}
                    onChange={(event) =>
                      setMarketForm((current) => ({ ...current, closeAt: event.target.value }))
                    }
                  />
                </label>

                <label>
                  Opções com odd
                  <textarea
                    rows={5}
                    value={marketForm.optionsText}
                    onChange={(event) =>
                      setMarketForm((current) => ({ ...current, optionsText: event.target.value }))
                    }
                    placeholder={'Ex: Sim|9.00\nNao|2.00'}
                  />
                </label>

                <label>
                  Valor mínimo
                  <input
                    type="number"
                    min="1"
                    value={marketForm.minStake}
                    onChange={(event) =>
                      setMarketForm((current) => ({ ...current, minStake: event.target.value }))
                    }
                  />
                </label>

                <label>
                  Valor máximo
                  <input
                    type="number"
                    min="1"
                    value={marketForm.maxStake}
                    onChange={(event) =>
                      setMarketForm((current) => ({ ...current, maxStake: event.target.value }))
                    }
                  />
                </label>

                <label>
                  Status
                  <select
                    value={marketForm.status}
                    onChange={(event) =>
                      setMarketForm((current) => ({
                        ...current,
                        status: event.target.value as MarketStatus,
                      }))
                    }
                  >
                    <option value="aberta">Aberta</option>
                    <option value="travada">Travada</option>
                    <option value="encerrada">Encerrada</option>
                  </select>
                </label>

                <div className="form-actions">
                  <button className="primary-button" disabled={isBusy} type="submit">
                    {editingMarketId ? 'Salvar alterações' : 'Criar mercado'}
                  </button>
                  <button className="ghost-button" type="button" onClick={resetMarketForm}>
                    Limpar formulário
                  </button>
                </div>
              </form>
            </section>

            <section className="content-grid" id="grupos-admin">
              <article className="card">
                <div className="section-title">
                  <h3>Montagem dos grupos</h3>
                  <span>Administração</span>
                </div>

                <div className="form-actions left">
                  <button className="primary-button" type="button" onClick={() => void handleDrawGroups()}>
                    Sortear grupos
                  </button>
                  <button
                    className="ghost-button"
                    type="button"
                    onClick={() => void handleGenerateGroupMatches()}
                  >
                    Gerar jogos da fase de grupos
                  </button>
                </div>

                <div className="group-builder-grid">
                  {(['A', 'B'] as const).map((groupName) => (
                    <article key={groupName} className="rule-card">
                      <strong>Grupo {groupName}</strong>
                      <div className="slot-grid">
                        {groupAssignments[groupName].map((playerId, index) => (
                          <label key={`${groupName}-${index}`}>
                            Slot {index + 1}
                            <select
                              value={playerId}
                              onChange={(event) =>
                                setGroupAssignments((current) => ({
                                  ...current,
                                  [groupName]: current[groupName].map((value, slotIndex) =>
                                    slotIndex === index ? event.target.value : value,
                                  ),
                                }))
                              }
                            >
                              <option value="">Selecione</option>
                              {getAvailableOptions(playerUsers, groupAssignments, groupName, index).map(
                                (player) => (
                                  <option key={player._id} value={player._id}>
                                    {player.name}
                                  </option>
                                ),
                              )}
                            </select>
                          </label>
                        ))}
                      </div>
                    </article>
                  ))}
                </div>

                <div className="form-actions left">
                  <button
                    className="primary-button"
                    type="button"
                    onClick={() => void handleManualGroupsSubmit()}
                  >
                    Salvar grupos manualmente
                  </button>
                </div>
              </article>

              <article className="card">
                <div className="section-title">
                  <h3>Criar partida manual</h3>
                  <span>Playoff, semi, final ou extra</span>
                </div>

                <form className="admin-form" onSubmit={handleCreateMatch}>
                  <label>
                    Fase
                    <select
                      value={matchForm.stage}
                      onChange={(event) =>
                        setMatchForm((current) => ({
                          ...current,
                          stage: event.target.value as MatchStage,
                        }))
                      }
                    >
                      <option value="groups">Fase de grupos</option>
                      <option value="playoff">Playoff</option>
                      <option value="semifinal">Semifinal</option>
                      <option value="final">Final</option>
                      <option value="third-place">3º lugar</option>
                    </select>
                  </label>

                  <label>
                    Rodada
                    <input
                      value={matchForm.roundName}
                      onChange={(event) =>
                        setMatchForm((current) => ({ ...current, roundName: event.target.value }))
                      }
                    />
                  </label>

                  <label>
                    Mandante
                    <select
                      value={matchForm.homePlayer}
                      onChange={(event) =>
                        setMatchForm((current) => ({ ...current, homePlayer: event.target.value }))
                      }
                    >
                      <option value="">Selecione</option>
                      {playerUsers.map((player) => (
                        <option key={player._id} value={player._id}>
                          {player.name}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label>
                    Visitante
                    <select
                      value={matchForm.awayPlayer}
                      onChange={(event) =>
                        setMatchForm((current) => ({ ...current, awayPlayer: event.target.value }))
                      }
                    >
                      <option value="">Selecione</option>
                      {playerUsers.map((player) => (
                        <option key={player._id} value={player._id}>
                          {player.name}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label>
                    Grupo
                    <select
                      value={matchForm.groupName}
                      onChange={(event) =>
                        setMatchForm((current) => ({
                          ...current,
                          groupName: event.target.value as '' | 'A' | 'B',
                        }))
                      }
                    >
                      <option value="">Sem grupo</option>
                      <option value="A">Grupo A</option>
                      <option value="B">Grupo B</option>
                    </select>
                  </label>

                  <label>
                    Data e hora
                    <input
                      type="datetime-local"
                      value={matchForm.kickoffAt}
                      onChange={(event) =>
                        setMatchForm((current) => ({ ...current, kickoffAt: event.target.value }))
                      }
                    />
                  </label>

                  <label>
                    Local
                    <input
                      value={matchForm.location}
                      onChange={(event) =>
                        setMatchForm((current) => ({ ...current, location: event.target.value }))
                      }
                    />
                  </label>

                  <label>
                    Perna
                    <input
                      type="number"
                      min="1"
                      value={matchForm.leg}
                      onChange={(event) =>
                        setMatchForm((current) => ({ ...current, leg: event.target.value }))
                      }
                    />
                  </label>

                  <div className="form-actions">
                    <button className="primary-button" disabled={isBusy} type="submit">
                      Criar partida
                    </button>
                  </div>
                </form>
              </article>
            </section>
          </>
        ) : null}
      </main>
    </div>
  )
}

export default App
