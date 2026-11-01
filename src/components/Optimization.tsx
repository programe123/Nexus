import { useState } from 'react'
import { BatteryCharging, Check, ChevronDown, CircleAlert, Fan, Gauge, Lightbulb, Monitor, MoreHorizontal, Plus, Power, Search, Sparkles, Utensils, Waves, X } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import { applianceCatalog, type TariffPlan } from '../data/staticData'
import { formatSchedule } from '../utils/optimizer'
import { Delta, Panel, Tag } from './Primitives'
import type { Appliance, OptimizationResult, OptimizerWeights, Recommendation } from '../types'

const icons = { battery: BatteryCharging, droplets: Waves, fan: Fan, monitor: Monitor, utensils: Utensils, lightbulb: Lightbulb }

export function RecommendationList({ recommendations, onStatus }: { recommendations: Recommendation[]; onStatus: (id: string, status: 'accepted' | 'rejected') => void }) {
  return <div className="recommendations"><AnimatePresence initial={false}>{recommendations.map((recommendation) => <motion.article key={recommendation.id} layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: 20 }} className={`recommendation ${recommendation.status}`}><div className="recommendation-icon"><Sparkles size={17} /></div><div className="recommendation-copy"><div className="recommendation-title"><h3>{recommendation.title}</h3><Tag tone={recommendation.confidence > 85 ? 'good' : 'info'}>{recommendation.confidence}% confidence</Tag></div><p>{recommendation.action} · {recommendation.reason}</p><div><span>{recommendation.savings}</span><span>{recommendation.carbon}</span></div></div>{recommendation.status === 'pending' ? <div className="rec-actions"><button className="accept" aria-label={`Accept ${recommendation.title}`} onClick={() => onStatus(recommendation.id, 'accepted')}><Check size={16} /></button><button className="reject" aria-label={`Reject ${recommendation.title}`} onClick={() => onStatus(recommendation.id, 'rejected')}><X size={16} /></button></div> : <Tag tone={recommendation.status === 'accepted' ? 'good' : 'risk'}>{recommendation.status === 'accepted' ? 'Accepted' : 'Rejected'}</Tag>}</motion.article>)}</AnimatePresence></div>
}

function ApplianceIcon({ appliance }: { appliance: Appliance }) { const Icon = icons[appliance.icon] ?? Monitor; return <div className="appliance-icon"><Icon size={17} /></div> }

export function ApplianceConfigurator({ appliances, onChange }: { appliances: Appliance[]; onChange: (appliances: Appliance[]) => void }) {
  const update = (id: string, patch: Partial<Appliance>) => onChange(appliances.map((item) => item.id === id ? { ...item, ...patch } : item))
  const remove = (id: string) => onChange(appliances.filter((item) => item.id !== id))
  return <div className="appliance-config">{appliances.map((item) => <article key={item.id} className={`appliance-row ${!item.active ? 'disabled' : ''}`}><div className="appliance-name"><ApplianceIcon appliance={item} /><div><b>{item.name}</b><span>{item.category}</span></div></div><label className="power-control"><span>Power</span><input aria-label={`${item.name} power`} type="number" min="0.1" max="8" step="0.1" value={item.power} onChange={(event) => update(item.id, { power: Number(event.target.value) })} /><small>kW</small></label><label className="duration-control"><span>Duration</span><select value={item.duration} onChange={(event) => update(item.id, { duration: Number(event.target.value) })}>{[1, 2, 3, 4].map((value) => <option key={value} value={value}>{value}h</option>)}</select></label><label className="priority-control"><span>Priority</span><select value={item.priority} onChange={(event) => update(item.id, { priority: event.target.value as Appliance['priority'] })}>{['Low', 'Medium', 'High', 'Critical'].map((value) => <option key={value} value={value}>{value}</option>)}</select></label><button className={`critical-toggle ${item.critical ? 'on' : ''}`} onClick={() => update(item.id, { critical: !item.critical })} title="Critical load"><Power size={14} /> Critical</button><label className="switch"><input aria-label={`Enable ${item.name}`} type="checkbox" checked={item.active} onChange={(event) => update(item.id, { active: event.target.checked })} /><span /></label><button className="remove-appliance" aria-label={`Remove ${item.name}`} onClick={() => remove(item.id)}><X size={14} /></button></article>)}</div>
}

/**
 * Static catalogue picker - adds a pre-configured load profile to the
 * appliance list without typing power/duration/priority by hand.
 */
export function ApplianceCatalog({ appliances, onAdd }: { appliances: Appliance[]; onAdd: (appliance: Appliance) => void }) {
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('All')
  const categories = ['All', ...Array.from(new Set(applianceCatalog.map((item) => item.category)))]

  const existing = new Set(appliances.map((item) => item.name))
  const filtered = applianceCatalog.filter((item) => {
    const matchesCategory = category === 'All' || item.category === category
    const matchesQuery = !query || `${item.name} ${item.category}`.toLowerCase().includes(query.toLowerCase())
    return matchesCategory && matchesQuery
  })

  const add = (template: (typeof applianceCatalog)[number]) => {
    onAdd({
      id: `${template.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now().toString(36)}`,
      name: template.name,
      category: template.category,
      icon: template.icon,
      power: template.power,
      duration: template.duration,
      deadline: template.deadline,
      priority: template.priority,
      critical: template.critical,
      interruptible: template.interruptible,
      preferredWindow: template.preferredWindow,
      originalStart: template.originalStart,
      active: true,
    })
  }

  return <div className="appliance-catalog">
    <div className="catalog-toolbar">
      <label className="catalog-search"><Search size={14} /><input placeholder="Search catalogue…" value={query} onChange={(event) => setQuery(event.target.value)} /></label>
      <select value={category} onChange={(event) => setCategory(event.target.value)}>{categories.map((value) => <option key={value} value={value}>{value}</option>)}</select>
    </div>
    <p className="catalog-note">Static catalogue of common load profiles. Pick one to add it to your schedule with sensible defaults.</p>
    <div className="catalog-grid">{filtered.map((template) => {
      const already = existing.has(template.name)
      return <button key={template.name} className={`catalog-chip ${already ? 'added' : ''}`} disabled={already} onClick={() => add(template)}>
        <span className="chip-head"><Gauge size={13} /><b>{template.name}</b></span>
        <span className="chip-meta">{template.category} · {template.power} kW · {template.duration}h</span>
        <span className="chip-action">{already ? 'Added' : <><Plus size={13} /> Add</>}</span>
      </button>
    })}</div>
    {!filtered.length && <p className="catalog-empty">No catalogue entries match that search.</p>}
  </div>
}

/** Tariff plan selector backed by the static tariff catalogue. */
export function TariffPlanPicker({ plans, active, onSelect }: { plans: TariffPlan[]; active: TariffPlan; onSelect: (plan: TariffPlan) => void }) {
  return <div className="tariff-plans">{plans.map((plan) => {
    const peak = Math.max(...plan.windows.map((entry) => entry.rate))
    const offPeak = Math.min(...plan.windows.map((entry) => entry.rate))
    const selected = plan.id === active.id
    return <button key={plan.id} className={`tariff-plan ${selected ? 'selected' : ''}`} onClick={() => onSelect(plan)}>
      <span className="plan-radio">{selected && <Check size={12} />}</span>
      <span className="plan-copy"><b>{plan.name}</b><small>{plan.utility}</small></span>
      <span className="plan-rates"><b>{plan.currency}{peak.toFixed(2)}</b><small>peak · {plan.currency}{offPeak.toFixed(2)} off-peak</small></span>
    </button>
  })}</div>
}

export function WeightControls({ weights, onChange }: { weights: OptimizerWeights; onChange: (weights: OptimizerWeights) => void }) {
  const items: Array<{ key: keyof OptimizerWeights; label: string; caption: string; color: string }> = [{ key: 'cost', label: 'Electricity cost', caption: 'Use lower-rate intervals', color: '#55e4a3' }, { key: 'carbon', label: 'Carbon reduction', caption: 'Prefer cleaner grid periods', color: '#a78bfa' }, { key: 'peak', label: 'Peak demand', caption: 'Flatten simultaneous loads', color: '#4fb3ff' }, { key: 'comfort', label: 'User comfort', caption: 'Limit schedule disruption', color: '#f4a261' }]
  return <div className="weights">{items.map((item) => <label key={item.key} className="weight-row"><div><i style={{ background: item.color }} /><span><b>{item.label}</b><small>{item.caption}</small></span><em>{weights[item.key]}%</em></div><input type="range" min="0" max="100" value={weights[item.key]} onChange={(event) => onChange({ ...weights, [item.key]: Number(event.target.value) })} style={{ accentColor: item.color }} /></label>)}</div>
}

export function ScheduleComparison({ result }: { result: OptimizationResult }) {
  const costChange = result.originalCost - result.optimizedCost
  const carbonChange = result.originalCarbon - result.optimizedCarbon
  const peakChange = result.originalPeak - result.optimizedPeak
  return <div className="schedule-comparison"><div className="improvement-grid"><div><span>Estimated cost</span><b>₹{result.optimizedCost.toFixed(1)}</b><small>Save ₹{Math.max(0, costChange).toFixed(1)}</small></div><div><span>Carbon impact</span><b>{result.optimizedCarbon.toFixed(1)} kg</b><small>{Math.max(0, carbonChange).toFixed(1)} kgCO₂ less</small></div><div><span>Flexible peak</span><b>{result.optimizedPeak.toFixed(1)} kW</b><small>{Math.max(0, peakChange).toFixed(1)} kW lower</small></div><div className="confidence"><span>Schedule confidence</span><b>{result.confidence}%</b><small>Strongly supported</small></div></div><div className="schedule-list">{result.schedule.map((item) => { const original = result.originalSchedule.find((entry) => entry.applianceId === item.applianceId) ?? item; return <div key={item.applianceId} className="schedule-row"><span className="schedule-name"><i className={item.moved ? 'moved-dot' : 'fixed-dot'} />{item.name}</span><span className="schedule-original">Original {formatSchedule(original)}</span><span className={item.moved ? 'schedule-new' : 'schedule-fixed'}>{item.moved ? formatSchedule(item) : 'Protected'}</span><p>{item.reason}</p></div> })}</div></div>
}

export function OptimizationStatus({ hasChanges }: { hasChanges: boolean }) { return <div className={`optimization-status ${hasChanges ? 'ready' : ''}`}><CircleAlert size={16} /><span>{hasChanges ? 'Settings changed. Generate a new schedule to compare impact.' : 'Schedule reflects the active appliance and priority settings.'}</span></div> }
