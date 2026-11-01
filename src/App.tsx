import { useEffect, useMemo, useState } from 'react'
import { Activity, BatteryCharging, BrainCircuit, CheckCircle2, CloudSun, Coins, Cpu, Gauge, Leaf, RefreshCw, Settings2, ShieldCheck, Sparkles, TrendingDown, Zap } from 'lucide-react'
import { ApplianceDonut, CarbonChart, DemandChart, ForecastChart, TariffChart, WeeklyUsageChart } from './components/Charts'
import { ConnectionBanner, ForecastHighlights, InputSourceCard, IntelligencePipeline } from './components/Intelligence'
import { ApplianceCatalog, ApplianceConfigurator, OptimizationStatus, RecommendationList, ScheduleComparison, TariffPlanPicker, WeightControls } from './components/Optimization'
import { MetricCard, Panel, Tag } from './components/Primitives'
import { PageHeader, Sidebar } from './components/Sidebar'
import { DataProvider, useData } from './data/DataContext'
import { history, initialRecommendations } from './data/mockData'
import { buildTimeline, carbonWindows, energyToday, emissionsToday, peakRateOf, spendToday } from './data/simulator'
import { tariffPlans, type TariffPlan } from './data/staticData'
import { generateOptimizedSchedule } from './utils/optimizer'
import type { Appliance, OptimizerWeights, PageKey, Recommendation } from './types'
import { HomeView, SmartScheduleView, AppliancesView } from './components/Residential'

const saved = <T,>(key: string, fallback: T): T => {
  try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) as T : fallback } catch { return fallback }
}

const defaultAppliances: Appliance[] = [
  { id: 'ev', name: 'EV Charger', category: 'Flexible load', icon: 'battery', power: 2.0, duration: 3, deadline: 7, priority: 'Medium', critical: false, interruptible: true, preferredWindow: [18, 7], originalStart: 18, active: true },
  { id: 'water', name: 'Water Heater', category: 'Comfort load', icon: 'droplets', power: 1.8, duration: 1, deadline: 8, priority: 'High', critical: false, interruptible: false, preferredWindow: [5, 8], originalStart: 6, active: true },
  { id: 'hvac', name: 'HVAC Zone A', category: 'Climate control', icon: 'fan', power: 1.4, duration: 2, deadline: 22, priority: 'Critical', critical: true, interruptible: false, preferredWindow: [12, 22], originalStart: 14, active: true },
  { id: 'dishwasher', name: 'Dishwasher', category: 'Flexible load', icon: 'utensils', power: 1.1, duration: 1, deadline: 6, priority: 'Low', critical: false, interruptible: true, preferredWindow: [20, 6], originalStart: 21, active: true },
  { id: 'workstation', name: 'Design Workstation', category: 'Productivity load', icon: 'monitor', power: 0.8, duration: 3, deadline: 19, priority: 'High', critical: false, interruptible: false, preferredWindow: [9, 19], originalStart: 10, active: true },
]

function App() {
  const [appliances, setAppliances] = useState<Appliance[]>(() => saved('nexus-appliances', defaultAppliances))
  return <DataProvider appliances={appliances}><Workspace appliances={appliances} onAppliances={setAppliances} /></DataProvider>
}

function Workspace({ appliances, onAppliances }: { appliances: Appliance[]; onAppliances: (next: Appliance[]) => void }) {
  const [page, setPage] = useState<PageKey>('home')
  const [compact, setCompact] = useState(false)
  const [expandedSource, setExpandedSource] = useState('')
  const [weights, setWeights] = useState<OptimizerWeights>(() => saved('nexus-weights', { cost: 35, carbon: 30, peak: 20, comfort: 15 }))
  const [recommendations, setRecommendations] = useState<Recommendation[]>(() => saved('nexus-recommendations', initialRecommendations))
  const [hasChanges, setHasChanges] = useState(false)
  const [toast, setToast] = useState('')
  const [comfortMessage, setComfortMessage] = useState('Avoid HVAC setpoint changes above 1°C during 09:00–19:00.')

  const { timeline, sources, tariffPlan, setTariffPlan, now, refresh } = useData()
  const [tariffPeak, setTariffPeak] = useState(() => peakRateOf(tariffPlan))

  useEffect(() => { localStorage.setItem('nexus-appliances', JSON.stringify(appliances)) }, [appliances])
  useEffect(() => { localStorage.setItem('nexus-weights', JSON.stringify(weights)) }, [weights])
  useEffect(() => { localStorage.setItem('nexus-recommendations', JSON.stringify(recommendations)) }, [recommendations])
  useEffect(() => { if (!toast) return; const timer = window.setTimeout(() => setToast(''), 3000); return () => window.clearTimeout(timer) }, [toast])

  const currentDemand = timeline[0]?.demand ?? 0
  const energy = energyToday()
  const spend = spendToday(tariffPlan)
  const emissions = emissionsToday()
  const peakInWindow = Math.max(...timeline.slice(0, 4).map((point) => point.forecast ?? point.demand))
  const activeLoadCount = appliances.filter((item) => item.active).length
  const acceptedCount = recommendations.filter((item) => item.status === 'accepted').length
  const acceptance = Math.round((acceptedCount + 11) / (recommendations.filter((item) => item.status !== 'pending').length + 14) * 100)
  const windows = carbonWindows()

  const updateAppliances = (next: Appliance[]) => { onAppliances(next); setHasChanges(true) }
  const updateWeights = (next: OptimizerWeights) => { setWeights(next); setHasChanges(true) }
  const updateRecommendation = (id: string, status: 'accepted' | 'rejected') => { setRecommendations((all) => all.map((item) => item.id === id ? { ...item, status } : item)); setToast(status === 'accepted' ? 'Recommendation accepted and preference signal recorded.' : 'Feedback recorded. Future recommendations will adapt.') }
  const simulate = () => { refresh(); setToast('Live feeds refreshed from the connected APIs.') }
  const addAppliance = (appliance: Appliance) => { updateAppliances([...appliances, appliance]); setToast(`${appliance.name} added from the static catalogue.`) }
  const selectTariffPlan = (plan: TariffPlan) => { setTariffPlan(plan); setTariffPeak(peakRateOf(plan)); setToast(`Tariff switched to ${plan.name}.`) }

  const pageContent = useMemo(() => {
    if (page === 'home') return <HomeView />
    if (page === 'schedule') return <SmartScheduleView appliances={appliances} onAppliances={updateAppliances} />
    if (page === 'appliances') return <AppliancesView appliances={appliances} onAppliances={updateAppliances} />
    if (page === 'advanced') return <Overview currentDemand={currentDemand} energy={energy} spend={spend} emissions={emissions} peakInWindow={peakInWindow} activeLoadCount={activeLoadCount} recommendations={recommendations} onStatus={updateRecommendation} expandedSource={expandedSource} setExpandedSource={setExpandedSource} tariffPlan={tariffPlan} />
    if (page === 'inputs') return <InputMonitoring expandedSource={expandedSource} setExpandedSource={setExpandedSource} tariffPeak={tariffPeak} setTariffPeak={setTariffPeak} tariffPlan={tariffPlan} onTariffPlan={selectTariffPlan} />
    if (page === 'analytics') return <Analytics />
    if (page === 'forecasting') return <Forecasting />
    if (page === 'carbon') return <Carbon />
    if (page === 'optimization') return <Optimization appliances={appliances} weights={weights} hasChanges={hasChanges} onAppliances={updateAppliances} onWeights={updateWeights} onAddAppliance={addAppliance} />
    if (page === 'preferences') return <Preferences recommendations={recommendations} acceptance={acceptance} comfortMessage={comfortMessage} onComfortMessage={setComfortMessage} onStatus={updateRecommendation} />
    return <Overview currentDemand={currentDemand} energy={energy} spend={spend} emissions={emissions} peakInWindow={peakInWindow} activeLoadCount={activeLoadCount} recommendations={recommendations} onStatus={updateRecommendation} expandedSource={expandedSource} setExpandedSource={setExpandedSource} tariffPlan={tariffPlan} />
  }, [page, expandedSource, tariffPeak, tariffPlan, appliances, weights, hasChanges, currentDemand, energy, spend, emissions, peakInWindow, activeLoadCount, recommendations, acceptance, comfortMessage, timeline])

  const titles: Record<PageKey, [string, string]> = {
    home: ['Good afternoon, Ser', 'Your home energy'], schedule: ['Smart Schedule', 'Recommended appliance times'], appliances: ['My Appliances', 'Manage your household devices'], advanced: ['Advanced Details', 'Technical energy insights'],
    overview: ['Good afternoon, Ser', 'Operations overview'], inputs: ['Input Monitoring', 'Data foundation'], analytics: ['Energy Analytics', 'Performance insight'], forecasting: ['Demand Forecasting', 'Prediction layer'], carbon: ['Carbon Intelligence', 'Grid impact'], optimization: ['AI Optimization', 'Decision workspace'], preferences: ['User Preferences', 'Human-behaviour layer'],
  }
  const [title, eyebrow] = titles[page]

  return <div className="app-shell"><Sidebar page={page} onNavigate={setPage} compact={compact} onCompact={() => setCompact((value) => !value)} /><main className="main-content"><PageHeader title={title} eyebrow={eyebrow} onSimulate={simulate} liveCount={sources.filter((source) => source.status === 'live').length} now={now} />{pageContent}</main>{toast && <div className="toast"><CheckCircle2 size={17} />{toast}</div>}</div>
}

function Overview({ currentDemand, energy, spend, emissions, peakInWindow, activeLoadCount, recommendations, onStatus, expandedSource, setExpandedSource, tariffPlan }: { currentDemand: number; energy: number; spend: number; emissions: number; peakInWindow: number; activeLoadCount: number; recommendations: Recommendation[]; onStatus: (id: string, status: 'accepted' | 'rejected') => void; expandedSource: string; setExpandedSource: (id: string) => void; tariffPlan: TariffPlan }) {
  const { carbonPeriods, carbonStatus, windows, sources } = useData()
  return <div className="page-stack"><section className="hero-strip"><div><span className="hero-kicker"><Sparkles size={14} /> AI signal summary</span><h2>Flexible loads can avoid the <em>{windows.dirtiest.from} peak</em> today.</h2><p>Shift EV charging into the {windows.cleanest.from}–{windows.cleanest.to} window to reduce cost and carbon while protecting your comfort constraints.</p></div><button onClick={() => document.getElementById('rec-section')?.scrollIntoView({ behavior: 'smooth' })}>Review recommendations <span>→</span></button></section><section className="metric-grid"><MetricCard label="Current power" value={`${currentDemand.toFixed(1)} kW`} detail="live demand signal" icon={<Zap size={20} />} /><MetricCard label="Energy today" value={`${energy} kWh`} detail="vs. daily baseline" trend={-4.1} tone="blue" icon={<Gauge size={20} />} /><MetricCard label="Estimated spend" value={`${tariffPlan.currency}${spend}`} detail="at current tariff plan" trend={-6.8} tone="amber" icon={<Coins size={20} />} /><MetricCard label="Carbon emissions" value={`${emissions} kg`} detail="today so far" trend={-12.4} tone="violet" icon={<Leaf size={20} />} /><MetricCard label="Predicted peak" value={`${peakInWindow.toFixed(1)} kW`} detail="in the next 60 min" trend={3.2} tone="rose" icon={<TrendingDown size={20} />} /></section><section className="overview-grid"><Panel title="Live electricity demand" subtitle="Actual load with the AI forecast interval" action={<div className="chart-legend"><span><i className="legend-dot green" /> Actual</span><span><i className="legend-dot blue" /> Forecast</span></div>} className="large-panel"><DemandChart forecast /></Panel><Panel title="Appliance energy share" subtitle={`${activeLoadCount} active loads`} className="donut-panel"><ApplianceDonut /></Panel></section><section className="overview-grid split"><Panel title="Grid carbon intensity" subtitle="Cleaner periods improve schedule quality" action={<Tag tone={carbonStatus === 'live' ? 'good' : 'info'}>{carbonStatus === 'live' ? 'Live grid feed' : 'Simulated feed'}</Tag>}><CarbonChart /></Panel><Panel title="Low-carbon windows" subtitle="Signals recommended to the scheduler"><div className="carbon-periods">{carbonPeriods.map((period) => <div key={period.label}><Tag tone={period.tone}>{period.label}</Tag><b>{period.value}</b><small>{period.detail}</small></div>)}</div></Panel></section><section id="rec-section"><Panel title="AI recommendations" subtitle="Explainable actions from the scheduler" action={<Tag tone="info">{recommendations.filter((item) => item.status === 'pending').length} pending</Tag>}><RecommendationList recommendations={recommendations} onStatus={onStatus} /></Panel></section><section className="source-grid">{sources.map((source) => <InputSourceCard key={source.id} source={source} expanded={expandedSource === source.id} onToggle={() => setExpandedSource(expandedSource === source.id ? '' : source.id)} />)}</section></div>
}

function InputMonitoring({ expandedSource, setExpandedSource, tariffPeak, setTariffPeak, tariffPlan, onTariffPlan }: { expandedSource: string; setExpandedSource: (id: string) => void; tariffPeak: number; setTariffPeak: (value: number) => void; tariffPlan: TariffPlan; onTariffPlan: (plan: TariffPlan) => void }) {
  const { sources, carbonProvider, setCarbonProvider, refresh, loading } = useData()
  return <div className="page-stack"><ConnectionBanner /><section className="source-grid">{sources.map((source) => <InputSourceCard key={source.id} source={source} expanded={expandedSource === source.id} onToggle={() => setExpandedSource(expandedSource === source.id ? '' : source.id)} />)}</section><section className="settings-grid"><Panel title="Tariff configuration" subtitle="Static tariff plans used by the scheduler" action={<Settings2 size={18} />}><TariffPlanPicker plans={tariffPlans} active={tariffPlan} onSelect={onTariffPlan} /><div className="tariff-settings"><label><span>Peak rate (manual override)</span><div className="input-with-affix"><b>{tariffPlan.currency}</b><input type="number" step="0.1" value={tariffPeak} onChange={(event) => setTariffPeak(Number(event.target.value))} /><small>/kWh</small></div></label><label><span>Plan</span><div className="input-with-affix"><input readOnly value={tariffPlan.name} /><small>static</small></div></label></div></Panel><Panel title="Data mode" subtitle="Live API adapters and the simulator share one interface" action={<Tag tone="info">{carbonProvider === 'simulated' ? 'Simulator' : 'Live APIs'}</Tag>}><div className="data-mode"><div><span className="live-dot" /><p><b>Open-Meteo weather</b><small>Live conditions for the configured location.</small></p></div><div><span className="mode-square blue" /><p><b>Carbon intensity</b><small>Provider selectable below. Falls back to the simulator if unreachable.</small></p></div><div><span className="mode-square amber" /><p><b>Local operator store</b><small>Preferences and feedback persist in this browser.</small></p></div></div><label className="carbon-provider-row"><span>Carbon provider</span><select value={carbonProvider} onChange={(event) => setCarbonProvider(event.target.value as typeof carbonProvider)}><option value="uk">National Grid ESO (UK, live)</option><option value="electricitymaps">Electricity Maps (needs token)</option><option value="auto">Auto (token → UK)</option><option value="simulated">Simulator only</option></select><button onClick={refresh} disabled={loading}>{loading ? <RefreshCw size={13} className="spin" /> : 'Refresh feeds'}</button></label></Panel></section><IntelligencePipeline /></div>
}

function Analytics() {
  const { tariffPlan, shares } = useData()
  return <div className="page-stack"><section className="metric-grid four"><MetricCard label="This week" value="403 kWh" detail="vs. previous week" trend={-5.6} icon={<Zap size={20} />} /><MetricCard label="Peak window" value="18:00–20:00" detail="7.1 kW observed" trend={3.2} tone="rose" icon={<TrendingDown size={20} />} /><MetricCard label="Flexible load" value={`${shares.filter((item) => item.name !== 'Other').length} loads`} detail="shiftable capacity" trend={8.2} tone="blue" icon={<BatteryCharging size={20} />} /><MetricCard label="Load factor" value="0.64" detail="healthy utilization" trend={3.4} tone="violet" icon={<Activity size={20} />} /></section><section className="overview-grid"><Panel title="Weekly energy consumption" subtitle="Green = actual · Grey = historical baseline" className="large-panel"><WeeklyUsageChart /></Panel><Panel title="Appliance-wise usage" subtitle="Largest loads today"><ApplianceDonut /></Panel></section><section className="overview-grid split"><Panel title="Hourly demand profile" subtitle="Use peak periods to target flexible loads"><DemandChart forecast /></Panel><Panel title="Tariff profile" subtitle={`${tariffPlan.name} · ${tariffPlan.utility}`}><TariffChart /></Panel></section></div>
}

function Forecasting() {
  const { timeline } = useData()
  const rows = [
    { label: 'Next 15 minutes', index: 0 },
    { label: 'Next 30 minutes', index: 1 },
    { label: 'Next 60 minutes', index: 2 },
  ].map((row) => {
    const point = timeline[row.index] ?? timeline[0]
    return {
      time: row.label,
      value: `${(point.forecast ?? point.demand).toFixed(1)} kW`,
      range: `${point.lower?.toFixed(1) ?? '—'}–${point.upper?.toFixed(1) ?? '—'} kW`,
      confidence: [89, 84, 82][row.index],
    }
  })

  return <div className="page-stack"><section className="forecast-hero"><div><span className="hero-kicker"><BrainCircuit size={14} /> Uncertainty-aware forecast</span><h2>Load could reach <em>{rows[2].value}</em> within the next hour.</h2><p>The prediction interval protects scheduling from overconfident single-value forecasts.</p></div><div className="confidence-pill"><span>Model confidence</span><b>82%</b><i><span style={{ width: '82%' }} /></i></div></section><ForecastHighlights /><Panel title="Demand forecast and confidence interval" subtitle="Green = observed · Blue = forecast · Dotted bounds = uncertainty interval" action={<Tag tone="good">Low risk</Tag>} className="forecast-panel"><ForecastChart /></Panel><section className="overview-grid split"><Panel title="Prediction windows" subtitle="Model output available to the optimizer"><div className="prediction-table">{rows.map((row) => <div key={row.time}><span>{row.time}</span><b>{row.value}</b><small>{row.range}</small><Tag tone={row.confidence > 85 ? 'good' : 'info'}>{row.confidence}%</Tag></div>)}</div></Panel><Panel title="Safeguard policy" subtitle="How uncertainty changes scheduling behaviour"><div className="policy-list"><div><ShieldCheck size={18} /><p><b>High confidence</b><small>Eligible flexible loads can receive a recommended schedule.</small></p></div><div><Cpu size={18} /><p><b>Medium confidence</b><small>Show user approval before suggesting a large change.</small></p></div><div><Activity size={18} /><p><b>Low confidence</b><small>Remain recommendation-only and retain the current plan.</small></p></div></div></Panel></section></div>
}

function Carbon() {
  const { carbonPeriods, carbonStatus, carbon, timeline, emissions, windows } = useData()
  const now = timeline[0]
  return <div className="page-stack"><section className="metric-grid four"><MetricCard label="Current intensity" value={`${now?.carbon ?? 0} gCO₂`} detail="per kWh" trend={-7.2} tone="violet" icon={<Leaf size={20} />} /><MetricCard label="Estimated emissions" value={`${emissions} kg`} detail="today so far" trend={-10.4} tone="emerald" icon={<CloudSun size={20} />} /><MetricCard label="Cleanest window" value={`${windows.cleanest.from}–${windows.cleanest.to}`} detail={`${windows.cleanest.value} gCO₂/kWh`} trend={-18} tone="blue" icon={<Sparkles size={20} />} /><MetricCard label="Reduction potential" value={`${windows.reduction}%`} detail="with flexible shifts" trend={18} tone="amber" icon={<TrendingDown size={20} />} /></section><section className="overview-grid"><Panel title="Grid carbon intensity" subtitle={carbonStatus === 'live' ? `Live feed · ${carbon?.provider ?? ''}` : 'Simulated emissions signal from the carbon adapter'} action={<Tag tone={carbonStatus === 'live' ? 'good' : 'info'}>{carbonStatus === 'live' ? 'Live grid feed' : 'Simulated grid feed'}</Tag>} className="large-panel"><CarbonChart /></Panel><Panel title="Low-carbon windows" subtitle="Signals recommended to the scheduler"><div className="carbon-periods">{carbonPeriods.map((period) => <div key={period.label}><Tag tone={period.tone}>{period.label}</Tag><b>{period.value}</b><small>{period.detail}</small></div>)}</div></Panel></section><section className="overview-grid split"><Panel title="Carbon-aware action" subtitle="Current best opportunity"><div className="carbon-action"><div className="leaf-orb"><Leaf size={25} /></div><div><span>Recommended shift</span><h3>Move EV charge to {windows.cleanest.from}</h3><p>Concentrate flexible loads in the cleanest window to cut emissions while avoiding the daily peak.</p><div><Tag tone="good">{windows.reduction}% potential</Tag><Tag tone="info">88% confidence</Tag></div></div></div></Panel><Panel title="Grid context" subtitle="Environmental impact changes throughout the day"><div className="grid-context"><span><i className="renewable" /> 41% renewable contribution</span><span><i className="thermal" /> 52% thermal contribution</span><span><i className="other" /> 7% other generation</span><p>Generation mix display is a placeholder until a generation-mix feed is attached.</p></div></Panel></section></div>
}

function Optimization({ appliances, weights, hasChanges, onAppliances, onWeights, onAddAppliance }: { appliances: Appliance[]; weights: OptimizerWeights; hasChanges: boolean; onAppliances: (items: Appliance[]) => void; onWeights: (items: OptimizerWeights) => void; onAddAppliance: (appliance: Appliance) => void }) {
  const { timeline } = useData()
  const [result, setResult] = useState(() => generateOptimizedSchedule(appliances, weights, timeline))

  useEffect(() => { setResult(generateOptimizedSchedule(appliances, weights, timeline)) }, [appliances, weights, timeline])

  return <div className="page-stack"><section className="optimization-head"><div><span className="hero-kicker"><Cpu size={14} /> Multi-objective scheduling</span><h2>Balance cost, carbon, demand and comfort.</h2><p>Change the weights or load constraints, then generate an explainable schedule from the live signal.</p></div><button className="generate-button" onClick={() => { setResult(generateOptimizedSchedule(appliances, weights, timeline)) }}><Sparkles size={17} /> Generate optimized schedule</button></section><OptimizationStatus hasChanges={hasChanges} /><section className="optimization-grid"><Panel title="Connected appliances" subtitle="Set power, duration, priority and critical-load protection" action={<Tag tone="good">{appliances.filter((item) => item.active).length} active</Tag>} className="config-panel"><ApplianceConfigurator appliances={appliances} onChange={onAppliances} /><ApplianceCatalog appliances={appliances} onAdd={onAddAppliance} /></Panel><Panel title="Optimization priorities" subtitle="Adjust how the scheduler evaluates candidate slots" action={<Tag tone="info">Live weights</Tag>}><WeightControls weights={weights} onChange={onWeights} /><div className="constraints-note"><ShieldCheck size={16} /><span>Critical and non-interruptible loads remain protected. Preferred windows and load priorities constrain movable appliances.</span></div></Panel></section><Panel title="Original vs optimized schedule" subtitle="Estimated outcomes respond to the active inputs above" action={<Tag tone="good">{result.confidence}% confidence</Tag>}><ScheduleComparison result={result} /></Panel></div>
}

function Preferences({ recommendations, acceptance, comfortMessage, onComfortMessage, onStatus }: { recommendations: Recommendation[]; acceptance: number; comfortMessage: string; onComfortMessage: (value: string) => void; onStatus: (id: string, status: 'accepted' | 'rejected') => void }) {
  return <div className="page-stack"><section className="metric-grid four"><MetricCard label="Acceptance rate" value={`${acceptance}%`} detail="over recent feedback" trend={5.6} icon={<CheckCircle2 size={20} />} /><MetricCard label="Accepted actions" value="14" detail="preference signals stored" trend={16} tone="emerald" icon={<Sparkles size={20} />} /><MetricCard label="Rejected actions" value="3" detail="comfort-first feedback" trend={-14} tone="rose" icon={<TrendingDown size={20} />} /><MetricCard label="Learned profile" value="High" detail="confidence in preferences" trend={8} tone="violet" icon={<BrainCircuit size={20} />} /></section><section className="overview-grid split"><Panel title="Learned user preferences" subtitle="Update the human-behaviour model inputs"><div className="preference-form"><label>Comfort rule<textarea value={comfortMessage} onChange={(event) => onComfortMessage(event.target.value)} /></label><div className="preference-options"><label><input type="checkbox" defaultChecked /> Avoid weekday changes after 22:00</label><label><input type="checkbox" defaultChecked /> Keep critical appliances untouched</label><label><input type="checkbox" /> Prioritize carbon over cost overnight</label></div><button onClick={() => localStorage.setItem('nexus-comfort-rule', comfortMessage)}>Save preference changes</button></div></Panel><Panel title="Decision history" subtitle="Feedback that trains acceptance prediction"><div className="history-list">{history.map((item) => <div key={item.date + item.action}><span>{item.date}</span><p><b>{item.action}</b><small>{item.impact}</small></p><Tag tone={item.outcome === 'Accepted' ? 'good' : 'risk'}>{item.outcome}</Tag></div>)}</div></Panel></section><section><Panel title="Pending recommendations" subtitle="Accept or reject to train the behaviour model"><RecommendationList recommendations={recommendations} onStatus={onStatus} /></Panel></section></div>
}

export default App
