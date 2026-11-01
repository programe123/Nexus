import type { ReactNode } from 'react'
import { ArrowDownRight, ArrowUpRight, Ellipsis, HelpCircle } from 'lucide-react'

export function Panel({ title, subtitle, action, children, className = '' }: { title?: string; subtitle?: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return <section className={`panel ${className}`}><div className="panel-head">{title && <div><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div>}{action ?? <button className="ghost-icon" aria-label="More options"><Ellipsis size={19} /></button>}</div>{children}</section>
}

export function MetricCard({ label, value, detail, trend, tone = 'emerald', icon }: { label: string; value: string; detail: string; trend?: number; tone?: 'emerald' | 'blue' | 'violet' | 'amber' | 'rose'; icon: ReactNode }) {
  const positive = (trend ?? 0) >= 0
  return <article className={`metric-card tone-${tone}`}><div className="metric-icon">{icon}</div><div className="metric-copy"><p>{label}</p><strong>{value}</strong><span className={trend === undefined ? 'neutral' : positive ? 'up' : 'down'}>{trend !== undefined && (positive ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />)} {detail}</span></div></article>
}

export function Tag({ children, tone = 'default' }: { children: ReactNode; tone?: 'default' | 'good' | 'risk' | 'info' | 'muted' }) { return <span className={`tag tag-${tone}`}>{children}</span> }

export function InfoHint({ text }: { text: string }) { return <span className="info-hint" title={text}><HelpCircle size={14} /></span> }

export function Delta({ before, after, unit = '', inverse = false }: { before: number; after: number; unit?: string; inverse?: boolean }) {
  const amount = before - after
  const percentage = Math.abs(before) ? (amount / before) * 100 : 0
  const good = inverse ? amount < 0 : amount > 0
  return <div className={good ? 'delta good' : 'delta neutral'}>{good ? '↓' : '↑'} {Math.abs(percentage).toFixed(0)}%{unit}</div>
}
