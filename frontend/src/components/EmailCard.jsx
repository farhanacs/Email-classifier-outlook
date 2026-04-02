import { useState } from 'react'

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

function getInitials(email) {
  if (!email) return '?'
  return email.split('@')[0].slice(0, 2).toUpperCase()
}

function getAvatarColor(email) {
  const colors = [
    'from-sky-400 to-blue-500',
    'from-blue-400 to-sky-600',
    'from-sky-300 to-sky-500',
    'from-indigo-400 to-blue-500',
    'from-cyan-400 to-sky-500',
  ]
  let hash = 0
  for (let i = 0; i < (email || '').length; i++)
    hash = email.charCodeAt(i) + ((hash << 5) - hash)
  return colors[Math.abs(hash) % colors.length]
}

function StatusBadge({ status }) {
  const map = {
    draft_saved:  { label: 'Draft Created',     cls: 'bg-emerald-50 text-emerald-600' },
    draft_failed: { label: 'Draft Failed',       cls: 'bg-red-50 text-red-500' },
    skipped:      { label: 'No Response Needed', cls: 'bg-slate-100 text-slate-400' },
    internal:     { label: 'Internal',           cls: 'bg-slate-100 text-slate-400' },
    pending:      { label: 'Pending',            cls: 'bg-sky-50 text-sky-500' },
  }
  const { label, cls } = map[status] || map.pending
  return (
    <span className={`inline-flex items-center text-xs font-medium px-2.5 py-1 rounded-full ${cls}`}>
      {label}
    </span>
  )
}

export default function EmailCard({ email }) {
  const [expanded, setExpanded] = useState(false)

  const showDetails =
    email.status === 'draft_saved' ||
    email.status === 'draft_failed' ||
    email.status === 'skipped'

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
        onClick={() => showDetails && setExpanded(!expanded)}
        className={`w-full text-left px-5 py-4 flex items-center gap-4 ${showDetails ? 'cursor-pointer' : 'cursor-default'}`}
      >
        {/* Avatar */}
        <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${getAvatarColor(email.sender)} flex items-center justify-center shrink-0`}>
          <span className="text-white text-xs font-bold">
            {getInitials(email.sender)}
          </span>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-slate-800 text-sm font-semibold truncate">
              {email.subject || 'No Subject'}
            </p>
            {email.ticket_number && (
              <span className="inline-flex items-center text-xs font-mono font-medium text-sky-600 bg-sky-50 border border-sky-100 px-2 py-0.5 rounded-lg shrink-0">
                {email.ticket_number}
              </span>
            )}
          </div>
          <p className="text-slate-400 text-xs truncate mt-0.5">
            {email.sender}
          </p>
        </div>

        {/* Right */}
        <div className="flex items-center gap-3 shrink-0">
          <StatusBadge status={email.status} />
          <span className="text-xs text-slate-300 font-mono whitespace-nowrap">
            {formatDate(email.processed_at)}
          </span>
          {showDetails && (
            <svg
              className={`w-4 h-4 text-slate-300 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
              fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          )}
        </div>
      </button>

      {/* Expanded details */}
      {expanded && showDetails && (
        <div className="border-t border-sky-50 px-5 py-4 space-y-4 animate-slide-up">

          {/* Triage reason */}
          {email.triage_reason && (
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5">
                Triage Decision
              </p>
              <p className="text-sm text-slate-500 leading-relaxed">
                {email.triage_reason}
              </p>
            </div>
          )}

          {/* Action required */}
          {email.action_required && (
            <div className="bg-amber-50 border border-amber-100 rounded-xl px-4 py-3">
              <p className="text-xs font-semibold text-amber-600 uppercase tracking-wide mb-1.5">
                Action Required Before Sending
              </p>
              <p className="text-sm text-amber-700 leading-relaxed">
                {email.action_required}
              </p>
            </div>
          )}

          {/* Draft body */}
          {email.draft_body && (
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5">
                Draft Response
              </p>
              <div className="border border-sky-100 rounded-xl px-4 py-3" style={{ background: '#f0f8ff' }}>
                <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">
                  {email.draft_body}
                </p>
              </div>
            </div>
          )}

        </div>
      )}
    </div>
  )
}