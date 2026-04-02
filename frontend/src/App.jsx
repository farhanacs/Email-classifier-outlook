import { useState, useEffect, useCallback } from 'react'
import StatsBar from './components/StatsBar'
import EmailCard from './components/EmailCard'
import SettingsPanel from './components/SettingsPanel'
import TicketCard from './components/TicketCard'

const API = import.meta.env.VITE_API_URL

export default function App() {
  const [emails, setEmails]               = useState([])
  const [tickets, setTickets]             = useState([])
  const [stats, setStats]                 = useState(null)
  const [loadingEmails, setLoadingEmails] = useState(true)
  const [loadingTickets, setLoadingTickets] = useState(true)
  const [loadingStats, setLoadingStats]   = useState(true)
  const [search, setSearch]               = useState('')
  const [filter, setFilter]               = useState('all')
  const [ticketSearch, setTicketSearch]   = useState('')
  const [ticketFilter, setTicketFilter]   = useState('all')
  const [lastRefresh, setLastRefresh]     = useState(null)
  const [refreshing, setRefreshing]       = useState(false)
  const [activeTab, setActiveTab]         = useState('emails')

  const fetchEmails = useCallback(async () => {
    try {
      const res  = await fetch(`${API}/api/emails`)
      const data = await res.json()
      setEmails(Array.isArray(data) ? data : [])
      setLastRefresh(new Date())
    } catch (e) {
      console.error('Failed to fetch emails:', e)
    } finally {
      setLoadingEmails(false)
    }
  }, [])

  const fetchTickets = useCallback(async () => {
    try {
      const res  = await fetch(`${API}/api/tickets`)
      const data = await res.json()
      setTickets(Array.isArray(data) ? data : [])
    } catch (e) {
      console.error('Failed to fetch tickets:', e)
    } finally {
      setLoadingTickets(false)
    }
  }, [])

  const fetchStats = useCallback(async () => {
    try {
      const res  = await fetch(`${API}/api/stats`)
      const data = await res.json()
      setStats(data)
    } catch (e) {
      console.error('Failed to fetch stats:', e)
    } finally {
      setLoadingStats(false)
    }
  }, [])

  async function handleRefresh() {
    setRefreshing(true)
    await Promise.all([fetchEmails(), fetchTickets(), fetchStats()])
    setRefreshing(false)
  }

  useEffect(() => {
    fetchEmails()
    fetchTickets()
    fetchStats()
    const interval = setInterval(() => {
      fetchEmails()
      fetchTickets()
      fetchStats()
    }, 30000)
    return () => clearInterval(interval)
  }, [fetchEmails, fetchTickets, fetchStats])

  const emailFilters = [
    { key: 'all',         label: 'All' },
    { key: 'draft_saved', label: 'Drafted' },
    { key: 'skipped',     label: 'Skipped' },
  ]

  const ticketStatuses = [
    'all', 'new', 'quoted', 'po_received', 'in_production', 'shipped', 'invoiced', 'paid', 'closed'
  ]

  const filteredEmails = emails.filter(e => {
    const q = search.toLowerCase()
    const matchesSearch =
      (e.subject || '').toLowerCase().includes(q) ||
      (e.sender  || '').toLowerCase().includes(q)
    const matchesFilter = filter === 'all' || e.status === filter
    return matchesSearch && matchesFilter
  })

  const filteredTickets = tickets.filter(t => {
    const q = ticketSearch.toLowerCase()
    const matchesSearch =
      (t.subject        || '').toLowerCase().includes(q) ||
      (t.sender         || '').toLowerCase().includes(q) ||
      (t.company        || '').toLowerCase().includes(q) ||
      (t.ticket_number  || '').toLowerCase().includes(q)
    const matchesFilter = ticketFilter === 'all' || t.status === ticketFilter
    return matchesSearch && matchesFilter
  })

  function formatRefreshTime(date) {
    if (!date) return ''
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
  }

  const tabs = [
    {
      key: 'emails',
      label: 'Email Inbox',
      count: emails.length,
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
        </svg>
      ),
    },
    {
      key: 'tickets',
      label: 'Tickets',
      count: tickets.length,
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 6v.75m0 3v.75m0 3v.75m0 3V18m-9-5.25h5.25M7.5 15h3M3.375 5.25c-.621 0-1.125.504-1.125 1.125v3.026a2.999 2.999 0 010 5.198v3.026c0 .621.504 1.125 1.125 1.125h17.25c.621 0 1.125-.504 1.125-1.125v-3.026a2.999 2.999 0 010-5.198V6.375c0-.621-.504-1.125-1.125-1.125H3.375z" />
        </svg>
      ),
    },
    {
      key: 'pricebook',
      label: 'Price Book',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
        </svg>
      ),
      comingSoon: true,
    },
  ]

  return (
    <div
      className="min-h-screen"
      style={{ background: 'linear-gradient(160deg, #e6f3ff 0%, #f0f8ff 40%, #ffffff 100%)' }}
    >
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-md border-b border-sky-100 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-sky-400 to-blue-600 flex items-center justify-center shadow-sm">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
              </svg>
            </div>
            <div>
              <h1 className="text-sm font-bold text-slate-800 tracking-tight">IET Labs</h1>
              <p className="text-xs text-slate-400">Sales Operations Dashboard</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {lastRefresh && (
              <span className="text-xs text-slate-300 font-mono hidden sm:block">
                {formatRefreshTime(lastRefresh)}
              </span>
            )}
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="flex items-center gap-2 text-xs font-medium px-3 py-1.5 rounded-xl border border-sky-200 text-sky-600 hover:bg-sky-50 transition-colors disabled:opacity-50"
            >
              <svg className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
              </svg>
              Refresh
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="max-w-4xl mx-auto px-4">
          <div className="flex gap-1">
            {tabs.map(tab => (
              <button
                key={tab.key}
                onClick={() => !tab.comingSoon && setActiveTab(tab.key)}
                className={`relative flex items-center gap-2 px-4 py-2.5 text-xs font-medium rounded-t-xl transition-colors ${
                  activeTab === tab.key
                    ? 'bg-white border border-b-0 border-sky-100 text-sky-600'
                    : tab.comingSoon
                    ? 'text-slate-300 cursor-not-allowed'
                    : 'text-slate-400 hover:text-sky-500'
                }`}
              >
                {tab.icon}
                {tab.label}
                {tab.count !== undefined && tab.count > 0 && (
                  <span className={`text-xs px-1.5 py-0.5 rounded-full font-mono ${
                    activeTab === tab.key ? 'bg-sky-100 text-sky-600' : 'bg-slate-100 text-slate-400'
                  }`}>
                    {tab.count}
                  </span>
                )}
                {tab.comingSoon && (
                  <span className="text-xs bg-slate-100 text-slate-400 px-1.5 py-0.5 rounded-full font-mono">
                    soon
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="max-w-4xl mx-auto px-4 py-8">

        <StatsBar stats={stats} loading={loadingStats} />

        {/* EMAIL TAB */}
        {activeTab === 'emails' && (
          <>
            <SettingsPanel />

            <div className="flex gap-3 mb-5">
              <div className="relative flex-1">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                </svg>
                <input
                  type="text"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search by sender or subject..."
                  className="w-full bg-white border border-sky-100 rounded-xl pl-9 pr-4 py-2.5 text-sm text-slate-700 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-sky-200 transition-all shadow-card"
                />
              </div>
              <div className="flex bg-white border border-sky-100 rounded-xl overflow-hidden shadow-card">
                {emailFilters.map(f => (
                  <button
                    key={f.key}
                    onClick={() => setFilter(f.key)}
                    className={`text-xs font-medium px-3 py-2.5 transition-colors ${
                      filter === f.key
                        ? 'bg-sky-500 text-white'
                        : 'text-slate-400 hover:text-sky-600 hover:bg-sky-50'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            <p className="text-xs text-slate-300 font-mono mb-3">
              {filteredEmails.length} email{filteredEmails.length !== 1 ? 's' : ''}
            </p>

            {loadingEmails ? (
              <div className="space-y-3">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="skeleton bg-white rounded-2xl h-16 border border-sky-50" />
                ))}
              </div>
            ) : filteredEmails.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-slate-300">
                <svg className="w-12 h-12 mb-3" fill="none" stroke="currentColor" strokeWidth={1} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                </svg>
                <p className="text-sm">No emails found</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredEmails.map((email, i) => (
                  <div key={email.message_id} style={{ animationDelay: `${i * 40}ms` }}>
                    <EmailCard email={email} />
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* TICKETS TAB */}
        {activeTab === 'tickets' && (
          <div className="animate-slide-up">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-base font-semibold text-slate-700">Tickets</h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Each ticket tracks a transaction from email through to payment
                </p>
              </div>
            </div>

            {/* Pipeline summary */}
            {tickets.length > 0 && (
              <div className="grid grid-cols-4 gap-3 mb-6">
                {['new', 'quoted', 'po_received', 'in_production'].map((s, i) => {
                  const count = tickets.filter(t => t.status === s).length
                  const labels = ['New', 'Quoted', 'PO Received', 'In Production']
                  const colors = ['text-sky-500', 'text-blue-500', 'text-amber-500', 'text-purple-500']
                  return (
                    <div key={s} className="bg-white rounded-xl border border-sky-100 p-3 shadow-card text-center">
                      <p className={`text-lg font-bold ${colors[i]}`}>{count}</p>
                      <p className="text-xs text-slate-400 mt-0.5">{labels[i]}</p>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Search + filter */}
            <div className="flex gap-3 mb-5">
              <div className="relative flex-1">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                </svg>
                <input
                  type="text"
                  value={ticketSearch}
                  onChange={e => setTicketSearch(e.target.value)}
                  placeholder="Search by ticket, company or subject..."
                  className="w-full bg-white border border-sky-100 rounded-xl pl-9 pr-4 py-2.5 text-sm text-slate-700 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-sky-200 transition-all shadow-card"
                />
              </div>
              <select
                value={ticketFilter}
                onChange={e => setTicketFilter(e.target.value)}
                className="bg-white border border-sky-100 rounded-xl px-3 py-2.5 text-xs text-slate-500 shadow-card focus:outline-none focus:ring-2 focus:ring-sky-200"
              >
                {ticketStatuses.map(s => (
                  <option key={s} value={s}>
                    {s === 'all' ? 'All Statuses' : s.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}
                  </option>
                ))}
              </select>
            </div>

            <p className="text-xs text-slate-300 font-mono mb-3">
              {filteredTickets.length} ticket{filteredTickets.length !== 1 ? 's' : ''}
            </p>

            {loadingTickets ? (
              <div className="space-y-3">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="skeleton bg-white rounded-2xl h-16 border border-sky-50" />
                ))}
              </div>
            ) : filteredTickets.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-slate-300">
                <svg className="w-12 h-12 mb-3" fill="none" stroke="currentColor" strokeWidth={1} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 6v.75m0 3v.75m0 3v.75m0 3V18m-9-5.25h5.25M7.5 15h3M3.375 5.25c-.621 0-1.125.504-1.125 1.125v3.026a2.999 2.999 0 010 5.198v3.026c0 .621.504 1.125 1.125 1.125h17.25c.621 0 1.125-.504 1.125-1.125v-3.026a2.999 2.999 0 010-5.198V6.375c0-.621-.504-1.125-1.125-1.125H3.375z" />
                </svg>
                <p className="text-sm">No tickets yet</p>
                <p className="text-xs mt-1">Tickets are created automatically when emails need a response</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredTickets.map((ticket, i) => (
                  <div key={ticket.ticket_number} style={{ animationDelay: `${i * 40}ms` }}>
                    <TicketCard
                      ticket={ticket}
                      onLinked={fetchTickets}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

      </main>
    </div>
  )
}