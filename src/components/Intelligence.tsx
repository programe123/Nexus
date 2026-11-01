import { Activity, ArrowRight, Bot, BrainCircuit, CheckCircle2, CircleGauge, CloudSun, Cpu, Database, Droplets, Fan, Gauge, Leaf, Lightbulb, Radio, RefreshCw, SlidersHorizontal, Thermometer, TimerReset, UserRound, Wifi, WifiOff } from 'lucide-react'
import { motion } from 'framer-motion'
import { useData } from '../data/DataContext'
import { CarbonChart, DemandChart, TariffChart } from './Charts'
import { InfoHint, Panel, Tag } from './Primitives'
import type { InputSource } from '../types'

const sourceIcons: Record<string, typeof Activity> = { meter: Gauge, weather: CloudSun, tariff: TimerReset, carbon: Leaf, operator: UserRound }

export function InputSourceCard({ source, expanded, onToggle }: { source: InputSource; expanded?: boolean; onToggle?: () => void }) {
  const Icon = sourceIcons[source.id] ?? Database
  const visual = source.id === 'meter' ? <DemandChart /> : source.id === 'tariff' ? <TariffChart /> : source.id === 'carbon' ? <CarbonChart /> : source.id === 'weather' ? <WeatherVisual /> : <OperatorVisual />
  const tone = source.status === 'live' ? 'good' : source.status === 'simulated' ? 'info' : source.status === 'offline' ? 'risk' : 'muted'
  return <motion.article layout className={`source-card source-${source.accent} ${expanded ? 'expanded' : ''}`} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
    <div className="source-top"><div className="source-icon"><Icon size={20} /></div><div className="source-heading"><p>{source.shortName}</p><h3>{source.name}</h3></div><Tag tone={tone}>{source.status === 'live' && <span className="live-dot mini" />} {source.status}</Tag></div>
    <p className="source-description">{source.description}</p>
    <div className="source-metrics">{source.metrics.map((metric) => <div key={metric.label}><span>{metric.label}</span><b>{metric.value}</b></div>)}</div>
    {expanded && <div className="source-visual">{visual}</div>}
    <div className="source-foot"><span>{source.status === 'offline' ? <WifiOff size={13} /> : <Wifi size={13} />} {source.status === 'offline' ? 'Simulated fallback' : `Updated ${source.lastUpdated}`}{source.source ? ` · ${source.source}` : ''}</span><button onClick={onToggle}>{expanded ? 'Hide details' : 'View signal'} <ArrowRight size={14} /></button></div>
  </motion.article>
}

function WeatherVisual() {
  const { weather, weatherDay } = useData()
  const blocks = weatherDay?.blocks ?? []
  const max = Math.max(40, ...blocks.map((block) => block.temperature))
  return <div className="weather-visual">
    <div className="weather-now"><CloudSun size={31} /><div><b>{weather ? `${Math.round(weather.temperature)}°C` : '—'}</b><span>{weather ? weather.condition : 'Waiting for live feed'}</span></div></div>
    {weather && <div className="weather-meta"><span><Thermometer size={13} /> {Math.round(weather.humidity)}% humidity</span><span><Fan size={13} /> {Math.round(weather.windSpeed)} km/h</span><span><Droplets size={13} /> +{weather.coolingImpact}% cooling</span></div>}
    <div className="mini-bars">{(blocks.length ? blocks : [{ label: '--', temperature: 26, precipitation: 0 }]).map((block) => <div key={block.label}><i style={{ height: `${Math.max(8, block.temperature * 1.6)}px` }} /><span>{block.label.slice(0, 3)}</span></div>)}</div>
  </div>
}

function OperatorVisual() { return <div className="operator-visual"><div><span>Accepted</span><b>14</b></div><div><span>Rejected</span><b>3</b></div><div><span>Avg. confidence</span><b>84%</b></div><p>Comfort-sensitive during working hours. Avoid HVAC shifts above 1°C.</p></div> }

const stages = [
  { step: '01', label: 'Acquire & prepare', detail: 'Collect, clean, time-sync and engineer features', icon: Database, color: 'emerald' },
  { step: '02', label: 'Forecast demand', detail: '15 / 30 / 60 min load intervals', icon: BrainCircuit, color: 'blue' },
  { step: '03', label: 'Estimate carbon', detail: 'Time-dependent grid impact', icon: Leaf, color: 'violet' },
  { step: '04', label: 'Model behaviour', detail: 'Acceptance likelihood and constraints', icon: UserRound, color: 'rose' },
  { step: '05', label: 'Optimize schedule', detail: 'Cost, carbon, peak and comfort', icon: Cpu, color: 'amber' },
  { step: '06', label: 'Recommend action', detail: 'Explainable schedule with confidence', icon: Lightbulb, color: 'emerald' },
]

export function IntelligencePipeline({ compact = false }: { compact?: boolean }) {
  const { sources } = useData()
  return <Panel title="System Intelligence Pipeline" subtitle="How NEXUS turns five input streams into practical energy decisions" action={<Tag tone="good"><Radio size={12} /> Data flow active</Tag>} className="pipeline-panel">
    <div className="pipeline-intro"><div className="input-badges">{sources.map((source) => <span key={source.id} className={source.status === 'live' ? 'is-live' : ''}>{source.shortName}</span>)}</div><p>Five source layers flow through a shared feature store. Three intelligence layers then help the scheduler make a recommendation that respects operational control.</p></div>
    <div className={`pipeline ${compact ? 'compact' : ''}`}>{stages.map((stage, index) => { const Icon = stage.icon; return <div className="pipeline-step-wrap" key={stage.step}><motion.div className={`pipeline-step step-${stage.color}`} initial={{ opacity: 0, scale: 0.96 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} transition={{ delay: index * 0.05 }}><div className="step-number">{stage.step}</div><Icon size={20} /><h3>{stage.label}</h3><p>{stage.detail}</p></motion.div>{index < stages.length - 1 && <ArrowRight className="pipeline-arrow" size={18} />}</div>})}</div>
    {!compact && <div className="intelligence-layers"><div><BrainCircuit size={16} /><span><b>Uncertainty-aware</b> Uses confidence intervals and safeguards.</span></div><div><Leaf size={16} /><span><b>Carbon-aware</b> Favors lower-impact energy windows.</span></div><div><UserRound size={16} /><span><b>Human-behaviour-aware</b> Learns practical acceptance patterns.</span></div></div>}
  </Panel>
}

export function ForecastHighlights() {
  const { timeline } = useData()
  const horizon = timeline.slice(0, 3)
  return <div className="forecast-highlights">{horizon.map((point, index) => {
    const labels = ['15 min', '30 min', '60 min']
    const spread = point.upper && point.lower ? ((point.upper - point.lower) / 2).toFixed(1) : '0.0'
    return <div key={labels[index]} className={index === 2 ? 'highlight' : ''}><span>{labels[index]}</span><b>{point.forecast?.toFixed(1) ?? point.demand.toFixed(1)} kW</b><small>{index === 2 ? 'High confidence' : `± ${spread} kW`}</small></div>
  })}</div>
}

export function ConnectionBanner() {
  const { sources, liveCount, loading, refresh } = useData()
  const offline = sources.filter((source) => source.status === 'offline')
  return <div className={`connection-banner ${offline.length ? 'degraded' : ''}`}>
    <div className="pulse-orb"><Activity size={16} /></div>
    <div>
      <b>{loading ? 'Contacting live data services…' : offline.length ? `${offline.length} source${offline.length > 1 ? 's' : ''} on simulator fallback` : `${liveCount} live feeds · ${sources.length - liveCount} configured locally`}</b>
      <span>{offline.length ? `${offline.map((source) => source.shortName).join(', ')} unreachable — simulated values keep the dashboard running.` : 'Live API adapters are attached to the same interfaces as the simulator.'}</span>
    </div>
    <button className="banner-refresh" onClick={refresh} aria-label="Refresh live feeds"><RefreshCw size={15} className={loading ? 'spin' : ''} /></button>
  </div>
}
