export default function StatsBar({ stats, loading }) {
  const items = [
    {
      label: 'Total Processed',
      value: stats?.total_processed ?? 0,
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      accent: 'text-sky-600',
      bg: 'bg-sky-100',
    },
    {
      label: 'Processed Today',
      value: stats?.processed_today ?? 0,
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      accent: 'text-sky-500',
      bg: 'bg-sky-50',
    },
    {
      label: 'Webhook Status',
      value: stats?.webhook_active ? 'Active' : 'Inactive',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
        </svg>
      ),
      accent: stats?.webhook_active ? 'text-emerald-600' : 'text-red-500',
      bg: stats?.webhook_active ? 'bg-emerald-50' : 'bg-red-50',
      isStatus: true,
      active: stats?.webhook_active,
    },
  ]

  return (
    <div className="grid grid-cols-3 gap-4 mb-8">
      {items.map((item, i) => (
        <div
          key={item.label}
          className="bg-white rounded-2xl p-5 shadow-card border border-sky-100 animate-slide-up"
          style={{ animationDelay: `${i * 60}ms` }}
        >
          <div className="flex items-start justify-between mb-3">
            <div className={`${item.bg} ${item.accent} p-2 rounded-xl`}>
              {item.icon}
            </div>
            {item.isStatus && (
              <span className={`relative flex h-2.5 w-2.5 mt-1`}>
                {item.active && (
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                )}
                <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${item.active ? 'bg-emerald-500' : 'bg-red-400'}`} />
              </span>
            )}
          </div>
          <p className="text-slate-400 text-xs font-medium tracking-wide uppercase mb-1">
            {item.label}
          </p>
          {loading ? (
            <div className="skeleton h-7 w-16 rounded-lg" />
          ) : (
            <p className={`text-2xl font-bold ${item.accent}`}>
              {item.value}
            </p>
          )}
        </div>
      ))}
    </div>
  )
}
