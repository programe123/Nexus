import { CalendarClock, ChevronLeft, CloudSun, Home, Settings2, SlidersHorizontal, Zap } from 'lucide-react'
import type { PageKey } from '../types'

const links: Array<{ id: PageKey; label: string; icon: typeof Home }> = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'schedule', label: 'Smart Schedule', icon: CalendarClock },
  { id: 'appliances', label: 'My Appliances', icon: Zap },
  { id: 'advanced', label: 'Advanced Details', icon: SlidersHorizontal },
]

export function Sidebar({ page, onNavigate, compact, onCompact }: { page: PageKey; onNavigate: (page: PageKey) => void; compact: boolean; onCompact: () => void }) {
  return (
    <aside className={`sidebar ${compact ? 'is-compact' : ''}`}>
      <div className="brand-row">
        <div className="brand-mark"><Zap size={18} fill="currentColor" /></div>
        {!compact && <div><strong>NEXUS</strong><span>ENERGY AI</span></div>}
        <button className="icon-button sidebar-toggle" aria-label="Toggle sidebar" onClick={onCompact}><ChevronLeft size={17} /></button>
      </div>
      <nav className="nav-list" aria-label="Main navigation">
        <p className="nav-label">Workspace</p>
        {links.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => onNavigate(id)} className={`nav-item ${page === id ? 'active' : ''}`} title={compact ? label : undefined}>
            <Icon size={18} /><span>{label}</span>{id === 'optimization' && !compact && <i className="nav-spark" />}
          </button>
        ))}
      </nav>
      <div className="sidebar-bottom">
        <div className="system-tile">
          <span className="live-dot" />
          {!compact && <div><b>System online</b><small>API + simulator feeds</small></div>}
        </div>
        <button className="nav-item plain" title={compact ? 'Settings' : undefined}><Settings2 size={18} /><span>Settings</span></button>
        <div className="user-card"><div className="avatar">SH</div>{!compact && <div><b>Ser Harsh</b><small>Operator</small></div>}</div>
      </div>
    </aside>
  )
}

export function PageHeader({ title, eyebrow, onSimulate, liveCount = 0, now }: { title: string; eyebrow: string; onSimulate: () => void; liveCount?: number; now?: Date }) {
  return <header className="page-header"><div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1></div><div className="header-actions"><button className="sim-button" onClick={onSimulate}><CloudSun size={16} /> Refresh feeds</button><div className="live-status"><span className="live-dot" /> {liveCount} live · {now ? now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '--:--'}</div></div></header>
}
