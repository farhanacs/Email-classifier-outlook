import { useState, useEffect, useCallback } from 'react'
import StatsBar from './components/StatsBar'
import EmailCard from './components/EmailCard'
import SettingsPanel from './components/SettingsPanel'

const API = import.meta.env.VITE_API_URL

export default function App() {
  const [emails, setEmails]               = useState([])
  const [stats, setStats]                 = useState(null)
  const [loadingEmails, setLoadingEmails] = useState(true)
  const [loadingStats, setLoadingStats]   = useState(true)
  const [search, setSearch]               = useState('')
  const [filter, setFilter]               = useState('all')
  const [lastRefresh, setLastRefresh]     = useState(null)
  const [refreshing, setRefreshing]       = useState(false)

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
    await Promise.all([fetchEmails(), fetchStats()])
    setRefreshing(false)
  }

  useEffect(() => {
    fetchEmails()
    fetchStats()
    const interval = setInterval(() => {
      fetchEmails()
      fetchStats()
    }, 30000)
    return () => clearInterval(interval)
  }, [fetchEmails, fetchStats])

  const filters = [
    { key: 'all',         label: 'All' },
    { key: 'draft_saved', label: 'Drafted' },
    { key: 'skipped',     label: 'Skipped' },
  ]

  const filtered = emails.filter(e => {
    const q = search.toLowerCase()
    const matchesSearch =
      (e.subject || '').toLowerCase().includes(q) ||
      (e.sender  || '').toLowerCase().includes(q)
    const matchesFilter =
      filter === 'all' || e.status === filter
    return matchesSearch && matchesFilter
  })

  function formatRefreshTime(date) {
    if (!date) return ''
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return (
    <div
      className="min-h-screen"
      style={{ background: 'linear-gradient(160deg, #e6f3ff 0%, #f0f8ff 40%, #ffffff 100%)' }}
    >
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-md border-b border-sky-100 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-sky-400 to-blue-600 flex items-center justify-center shadow-sm">
              <svg
                className="w-4 h-4 text-white"
                fill="none"
                stroke="currentColor"
                strokeWidth={2.5}
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75"
                />
              </svg>
            </div>
            <div>
              <h1 className="text-sm font-bold text-slate-800 tracking-tight">
                IET Labs
              </h1>
              <p className="text-xs text-slate-400">Email Drafting Agent</p>
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
              <svg
                className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`}
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99"
                />
              </svg>
              Refresh
            </button>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="max-w-3xl mx-auto px-4 py-8">

        {/* Stats */}
        <StatsBar stats={stats} loading={loadingStats} />

        {/* Settings */}
        <SettingsPanel />

        {/* Search + Filter */}
        <div className="flex gap-3 mb-5">
          <div className="relative flex-1">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
              />
            </svg>
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by sender or subject..."
              className="w-full bg-white border border-sky-100 rounded-xl pl-9 pr-4 py-2.5 text-sm text-slate-700 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-sky-200 focus:border-sky-300 transition-all shadow-card"
            />
          </div>

          <div className="flex bg-white border border-sky-100 rounded-xl overflow-hidden shadow-card">
            {filters.map(f => (
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

        {/* Count */}
        <p className="text-xs text-slate-300 font-mono mb-3">
          {filtered.length} email{filtered.length !== 1 ? 's' : ''}
        </p>

        {/* Email list */}
        {loadingEmails ? (
          <div className="space-y-3">
            {[...Array(6)].map((_, i) => (
              <div
                key={i}
                className="skeleton bg-white rounded-2xl h-16 border border-sky-50"
              />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-300">
            <svg
              className="w-12 h-12 mb-3"
              fill="none"
              stroke="currentColor"
              strokeWidth={1}
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75"
              />
            </svg>
            <p className="text-sm">No emails found</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((email, i) => (
              <div
                key={email.message_id}
                style={{ animationDelay: `${i * 40}ms` }}
              >
                <EmailCard email={email} />
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
