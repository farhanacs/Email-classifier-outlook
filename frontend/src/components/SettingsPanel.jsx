import { useState, useEffect } from 'react'

const API = import.meta.env.VITE_API_URL

export default function SettingsPanel() {
  const [open, setOpen] = useState(false)
  const [instructions, setInstructions] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (!open) return
    fetch(`${API}/api/settings`)
      .then(r => r.json())
      .then(d => setInstructions(d.custom_instructions || ''))
      .catch(console.error)
  }, [open])

  async function handleSave() {
    setSaving(true)
    setSaved(false)
    try {
      await fetch(`${API}/api/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ custom_instructions: instructions }),
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch (e) {
      console.error(e)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mb-6">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-sky-600 transition-colors group"
      >
        <div className={`w-6 h-6 rounded-lg flex items-center justify-center transition-colors ${open ? 'bg-sky-100 text-sky-600' : 'bg-slate-100 text-slate-400 group-hover:bg-sky-50 group-hover:text-sky-500'}`}>
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </div>
        Custom Instructions
        <svg
          className={`w-3.5 h-3.5 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="mt-3 bg-white rounded-2xl border border-sky-100 shadow-card p-5 animate-slide-up">
          <p className="text-slate-400 text-xs leading-relaxed mb-4">
            These instructions are injected into every AI draft. Use them to tune tone, add rules, or adjust behavior.
          </p>
          <textarea
            value={instructions}
            onChange={e => setInstructions(e.target.value)}
            rows={5}
            placeholder="e.g. Always address the customer by first name. Never offer discounts without manager approval. Sign off as Benjamin Sheena."
            className="w-full bg-sky-25 border border-sky-100 rounded-xl px-4 py-3 text-sm text-slate-700 placeholder:text-slate-300 resize-none focus:outline-none focus:ring-2 focus:ring-sky-200 focus:border-sky-300 transition-all font-mono leading-relaxed"
          />
          <div className="flex items-center justify-end gap-3 mt-3">
            {saved && (
              <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-600">
                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                Saved
              </span>
            )}
            <button
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-xl bg-sky-500 text-white hover:bg-sky-600 transition-colors disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Instructions'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
