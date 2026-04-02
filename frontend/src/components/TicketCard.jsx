import { useState } from 'react'

const API = import.meta.env.VITE_API_URL

function formatDate(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  const now = new Date()
  const diff = now - d
  const mins = Math.floor(diff / 60000)
  const hrs  = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)
  if (mins < 1)  return 'just now'
  if (mins < 60) return `${mins}m ago`
  if (hrs  < 24) return `${hrs}h ago`
  return `${days}d ago`
}

const statusConfig = {
  new:           { label: 'New',           cls: 'bg-sky-50 text-sky-600' },
  quoted:        { label: 'Quoted',        cls: 'bg-blue-50 text-blue-600' },
  po_received:   { label: 'PO Received',   cls: 'bg-amber-50 text-amber-600' },
  in_production: { label: 'In Production', cls: 'bg-purple-50 text-purple-600' },
  shipped:       { label: 'Shipped',       cls: 'bg-teal-50 text-teal-600' },
  invoiced:      { label: 'Invoiced',      cls: 'bg-orange-50 text-orange-600' },
  paid:          { label: 'Paid',          cls: 'bg-emerald-50 text-emerald-600' },
  closed:        { label: 'Closed',        cls: 'bg-slate-100 text-slate-400' },
}

function getAvatarColor(str) {
  const colors = [
    'from-sky-400 to-blue-500',
    'from-blue-400 to-sky-600',
    'from-indigo-400 to-blue-500',
    'from-cyan-400 to-sky-500',
    'from-violet-400 to-indigo-500',
  ]
  let hash = 0
  for (let i = 0; i < (str || '').length; i++)
    hash = str.charCodeAt(i) + ((hash << 5) - hash)
  return colors[Math.abs(hash) % colors.length]
}

export default function TicketCard({ ticket, onLinked }) {
  const [expanded, setExpanded]     = useState(false)
  const [oppInput, setOppInput]     = useState('')
  const [linking, setLinking]       = useState(false)
  const [linkError, setLinkError]   = useState('')
  const [linked, setLinked]         = useState(false)

  const cfg = statusConfig[ticket.status] || statusConfig.new

  async function handleLink() {
    if (!oppInput.trim()) return
    setLinking(true)
    setLinkError('')
    try {
      const res = await fetch(
        `${API}/api/tickets/${ticket.ticket_number}/link-opportunity`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ opportunity_id: oppInput.trim() }),
        }
      )
      const data = await res.json()
      if (data.status === 'linked') {
        setLinked(true)
        onLinked?.()
      } else {
        setLinkError('Failed to link. Check ticket number.')
      }
    } catch (e) {
      setLinkError('Network error. Please try again.')
    } finally {
      setLinking(false)
    }
  }

  const opportunityId = linked ? oppInput.trim() : ticket.opportunity_id

  return (
    <div
      className={`bg-white rounded-2xl border transition-all duration-200 overflow-hidden animate-slide-up ${
        expanded
          ? 'border-sky-200 shadow-card-hover'
          : 'border-sky-100 shadow-card hover:border-sky-200 hover:shadow-card-hover'
      }`}
    >
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left px-5 py-4 flex items-center gap-4"
      >
        {/* Avatar */}
        <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${getAvatarColor(ticket.company)} flex items-center justify-center shrink-0`}>
          <span className="text-white text-xs font-bold">
            {(ticket.company || '?').slice(0, 2).toUpperCase()}
          </span>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-0.5">
            <span className="text-xs font-mono font-semibold text-sky-600 bg-sky-50 border border-sky-100 px-2 py-0.5 rounded-lg shrink-0">
              {ticket.ticket_number}
            </span>
            <p className="text-slate-800 text-sm font-semibold truncate">
              {ticket.subject || 'No Subject'}
            </p>
          </div>
          <p className="text-slate-400 text-xs truncate">
            {ticket.company} · {ticket.sender}
          </p>
        </div>

        {/* Right */}
        <div className="flex items-center gap-3 shrink-0">
          <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${cfg.cls}`}>
            {cfg.label}
          </span>
          <span className="text-xs text-slate-300 font-mono whitespace-nowrap">
            {formatDate(ticket.created_at)}
          </span>
          <svg
            className={`w-4 h-4 text-slate-300 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
            fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {/* Expanded */}
      {expanded && (
        <div className="border-t border-sky-50 px-5 py-4 space-y-4 animate-slide-up">

          {/* Details grid */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">
                Sender
              </p>
              <p className="text-sm text-slate-600">{ticket.sender}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">
                Type
              </p>
              <p className="text-sm text-slate-600 capitalize">
                {(ticket.ticket_type || 'unknown').replace('_', ' ')}
              </p>
            </div>
          </div>

          {/* Salesforce Opportunity ID */}
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
              Salesforce Opportunity ID
            </p>
            {opportunityId ? (
              <div className="flex items-center gap-2">
                <span className="text-sm font-mono text-emerald-600 bg-emerald-50 border border-emerald-100 px-3 py-1.5 rounded-xl">
                  {opportunityId}
                </span>
                <span className="text-xs text-emerald-500">✓ Linked</span>
              </div>
            ) : (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={oppInput}
                  onChange={e => setOppInput(e.target.value)}
                  placeholder="e.g. OPP-371624"
                  className="flex-1 bg-sky-25 border border-sky-100 rounded-xl px-3 py-2 text-sm text-slate-700 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-sky-200 transition-all font-mono"
                  style={{ background: '#f0f8ff' }}
                />
                <button
                  onClick={handleLink}
                  disabled={linking || !oppInput.trim()}
                  className="text-sm font-medium px-4 py-2 rounded-xl bg-sky-500 text-white hover:bg-sky-600 transition-colors disabled:opacity-40"
                >
                  {linking ? 'Linking...' : 'Link'}
                </button>
              </div>
            )}
            {linkError && (
              <p className="text-xs text-red-500 mt-1">{linkError}</p>
            )}
            {!opportunityId && (
              <p className="text-xs text-slate-300 mt-1.5">
                Paste the Salesforce Opportunity ID to link this ticket
              </p>
            )}
          </div>

        </div>
      )}
    </div>
  )
}