import { type FormEvent, useEffect, useMemo, useState } from 'react'
import { BatteryCharging, Check, Clock3, Droplets, Fan, Lightbulb, Monitor, Pencil, Plus, Trash2, Utensils, Zap } from 'lucide-react'
import { useData } from '../data/DataContext'
import { energyToday, spendToday } from '../data/simulator'
import { generateOptimizedSchedule, formatSchedule } from '../utils/optimizer'
import type { Appliance, BackendSchedule, ScheduleExecution } from '../types'
import {
  cancelBackendSchedule,
  createBackendSchedule,
  fetchBackendSchedules,
  fetchScheduleExecutions,
  registerSimulatedAppliance,
} from '../services/schedules'

const iconFor = (icon: Appliance['icon'], size = 22) => {
  const props = { size }
  if (icon === 'fan') return <Fan {...props} />
  if (icon === 'droplets') return <Droplets {...props} />
  if (icon === 'monitor') return <Monitor {...props} />
  if (icon === 'utensils') return <Utensils {...props} />
  if (icon === 'lightbulb') return <Lightbulb {...props} />
  return <BatteryCharging {...props} />
}

const clock = (hour: number) => {
  const normalized = ((hour % 24) + 24) % 24
  const whole = Math.floor(normalized)
  const minutes = Math.round((normalized - whole) * 60)
  return `${String(whole).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
}

const formatSavedTime = (value: string) => new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium',
  timeStyle: 'short',
}).format(new Date(value))

const savedScheduleStatus = (
  schedule: BackendSchedule,
  scheduleExecutions: ScheduleExecution[],
): 'Pending' | 'Running' | 'Completed' | 'Cancelled' | 'Failed' => {
  if (schedule.status === 'cancelled') return 'Cancelled'
  if (scheduleExecutions.some((execution) => execution.status === 'failed')) return 'Failed'
  const now = Date.now()
  const start = new Date(schedule.startAt).getTime()
  const end = new Date(schedule.endAt).getTime()
  if (schedule.status === 'completed' || schedule.status === 'expired' || now >= end) return 'Completed'
  if (now >= start) return 'Running'
  return 'Pending'
}

export function HomeView() {
  const { meterReading, meterConnected, meterStats, tariffPlan, timeline } = useData()
  const energy = energyToday()
  const estimatedBill = spendToday(tariffPlan)
  const current = meterConnected && meterReading ? meterReading.powerKw : timeline[0]?.demand ?? 0
  const nextUsage = timeline.slice(0, 12).map((point) => point.demand)
  const high = current > Math.max(5, ...nextUsage.map((value) => value * 0.9))

  return (
    <div className="residential-stack">
      <section className="home-status">
        <div>
          <span className="status-label">Using electricity now</span>
          <strong>{current.toFixed(2)} <small>units of power</small></strong>
        </div>
        <div className={`connection-pill ${meterConnected ? 'connected' : 'fallback'}`}>
          <span className="live-dot" />
          {meterConnected ? 'Meter connected · simulated readings' : 'Local estimate · meter offline'}
        </div>
      </section>

      <section className="home-summary">
        <article><span>Today's estimated use</span><strong>{energy.toFixed(1)} <small>units</small></strong><p>{meterConnected ? 'Estimated from the local household model' : 'Based on the local fallback model'}</p></article>
        <article><span>Estimated bill so far</span><strong>{tariffPlan.currency}{estimatedBill.toFixed(0)}</strong><p>Using your selected tariff plan</p></article>
      </section>

      {high && <div className="home-alert"><Zap size={20} /><div><b>Power use is higher than usual</b><span>Consider switching off heaters, air conditioning or idle equipment for a while.</span></div></div>}

      <section className="suggestion-list">
        <h2>Helpful for your home</h2>
        <div className="suggestion-card"><span className="suggestion-icon"><Clock3 /></span><div><b>Run flexible appliances later</b><p>EV charging and dishwashing can move to a lower-cost part of the day.</p></div></div>
        <div className="suggestion-card"><span className="suggestion-icon"><Fan /></span><div><b>Check cooling use</b><p>Cooling often uses the most power. Raising the setting slightly can reduce household use.</p></div></div>
      </section>

      <p className="provenance-line">
        {meterConnected
          ? `Meter feed: simulated household readings · ${meterStats?.accepted ?? 0} accepted · ${meterStats?.rejected ?? 0} rejected`
          : 'No real meter is connected. The dashboard is showing its clearly labelled simulated fallback.'}
      </p>
    </div>
  )
}

export function SmartScheduleView({ appliances, onAppliances }: { appliances: Appliance[]; onAppliances: (items: Appliance[]) => void }) {
  const { timeline, tariffPlan } = useData()
  const weights = useMemo(() => ({ cost: 35, carbon: 30, peak: 20, comfort: 15 }), [])
  const result = useMemo(() => generateOptimizedSchedule(appliances, weights, timeline), [appliances, timeline, weights])
  const [decisions, setDecisions] = useState<Record<string, 'accepted' | 'rejected' | 'modified'>>({})
  const [editing, setEditing] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [backendSchedules, setBackendSchedules] = useState<BackendSchedule[]>([])
  const [executions, setExecutions] = useState<Record<string, ScheduleExecution[]>>({})
  const [scheduleMessage, setScheduleMessage] = useState('')
  const [scheduleError, setScheduleError] = useState('')
  const [createApplianceId, setCreateApplianceId] = useState(appliances[0]?.id ?? '')
  const now = new Date()
  const toLocalInput = (value: Date) => {
    const offset = value.getTimezoneOffset() * 60000
    return new Date(value.getTime() - offset).toISOString().slice(0, 16)
  }
  const [startAt, setStartAt] = useState(toLocalInput(now))
  const [endAt, setEndAt] = useState(toLocalInput(new Date(now.getTime() + 60 * 60000)))

  const refreshBackendSchedules = async () => {
    try {
      const response = await fetchBackendSchedules()
      setBackendSchedules(response.schedules)
      const executionPairs = await Promise.all(response.schedules.map(async (schedule) => {
        try {
          const result = await fetchScheduleExecutions(schedule.id)
          return [schedule.id, result.executions] as const
        } catch {
          return [schedule.id, []] as const
        }
      }))
      setExecutions(Object.fromEntries(executionPairs))
      setScheduleError('')
    } catch (error) {
      setScheduleError(error instanceof Error ? error.message : 'Could not load saved schedules.')
    }
  }

  useEffect(() => {
    void refreshBackendSchedules()
    const timer = window.setInterval(() => void refreshBackendSchedules(), 10000)
    return () => window.clearInterval(timer)
  }, [])

  const createSchedule = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setScheduleMessage('')
    setScheduleError('')

    const appliance = appliances.find((item) => item.id === createApplianceId)
    if (!appliance) {
      setScheduleError('Select an appliance first.')
      return
    }

    const start = new Date(startAt)
    const end = new Date(endAt)
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
      setScheduleError('Choose an end time that is after the start time.')
      return
    }

    try {
      await registerSimulatedAppliance(appliance.id, appliance.name)
      await createBackendSchedule({
        applianceId: appliance.id,
        name: appliance.name,
        startAt: start.toISOString(),
        endAt: end.toISOString(),
      })
      setScheduleMessage('Schedule saved. The simulated actuator will run it automatically.')
      setShowCreate(false)
      await refreshBackendSchedules()
    } catch (error) {
      setScheduleError(error instanceof Error ? error.message : 'Could not save the schedule.')
    }
  }

  const cancelSchedule = async (scheduleId: string) => {
    setScheduleMessage('')
    setScheduleError('')
    try {
      await cancelBackendSchedule(scheduleId)
      setScheduleMessage('Schedule cancelled.')
      await refreshBackendSchedules()
    } catch (error) {
      setScheduleError(error instanceof Error ? error.message : 'Could not cancel the schedule.')
    }
  }

  const modify = (applianceId: string, start: number) => {
    onAppliances(appliances.map((item) => item.id === applianceId ? { ...item, originalStart: start } : item))
    setDecisions((all) => ({ ...all, [applianceId]: 'modified' }))
    setEditing(null)
  }

  const savings = Math.max(0, result.originalCost - result.optimizedCost)

  return (
    <div className="residential-stack">
      <section className="schedule-intro">
        <div><span className="status-label">Recommended for today</span><h2>Simple times for flexible appliances</h2></div>
        <p>Each suggestion respects the device deadline and your preferred hours.</p>
      </section>

      <section className="saved-schedules-section">
        <div className="saved-schedules-toolbar">
          <div><span className="status-label">Saved schedules</span><h3>Automatic appliance control</h3></div>
          <button className="primary-small" onClick={() => setShowCreate(true)}><Plus size={16} /> Create Schedule</button>
        </div>

        {scheduleMessage && <div className="schedule-notice success">{scheduleMessage}</div>}
        {scheduleError && <div className="schedule-notice error">{scheduleError}</div>}

        {showCreate && (
          <form className="schedule-create-form" onSubmit={createSchedule}>
            <label>Appliance
              <select value={createApplianceId} onChange={(event) => setCreateApplianceId(event.target.value)}>
                <option value="">Select an appliance</option>
                {appliances.map((appliance) => <option key={appliance.id} value={appliance.id}>{appliance.name}</option>)}
              </select>
            </label>
            <label>Start date and time
              <input type="datetime-local" value={startAt} onChange={(event) => setStartAt(event.target.value)} />
            </label>
            <label>End date and time
              <input type="datetime-local" value={endAt} onChange={(event) => setEndAt(event.target.value)} />
            </label>
            <div className="schedule-form-actions">
              <button className="secondary-small" type="button" onClick={() => setShowCreate(false)}>Close</button>
              <button className="primary-small" type="submit">Save Schedule</button>
            </div>
          </form>
        )}

        <div className="saved-schedule-list">
          {backendSchedules.length === 0 ? (
            <p className="saved-schedule-empty">No saved schedules yet.</p>
          ) : backendSchedules.map((schedule) => {
            const status = savedScheduleStatus(schedule, executions[schedule.id] ?? [])
            return (
              <article className="saved-schedule-card" key={schedule.id}>
                <div><b>{schedule.name}</b><p>{formatSavedTime(schedule.startAt)} – {formatSavedTime(schedule.endAt)}</p></div>
                <span className={`schedule-status status-${status.toLowerCase()}`}>{status}</span>
                {status === 'Pending' && (
                  <button className="secondary-small" onClick={() => void cancelSchedule(schedule.id)}>Cancel</button>
                )}
              </article>
            )
          })}
        </div>
      </section>

      <div className="schedule-list">
        {result.schedule.map((item) => {
          const appliance = appliances.find((entry) => entry.id === item.applianceId)
          if (!appliance?.active) return null
          return (
            <article className="schedule-card" key={item.applianceId}>
              <div className="schedule-device"><span className="appliance-icon">{iconFor(appliance.icon)}</span><div><b>{appliance.name}</b><p>{item.infeasible ? 'Could not find a suitable time' : item.moved ? 'A better time was found' : 'Your preferred time works well'}</p></div></div>
              <div className="schedule-time"><Clock3 size={18} /><strong>{item.infeasible ? 'No suitable time' : `${clock(item.from)} – ${clock(item.to)}`}</strong></div>
              <p className="schedule-explanation">{item.reason}</p>
              <div className="schedule-actions">
                <button className="primary-small" onClick={() => setDecisions((all) => ({ ...all, [item.applianceId]: 'accepted' }))} disabled={decisions[item.applianceId] === 'accepted'}><Check size={15} /> {decisions[item.applianceId] === 'accepted' ? 'Accepted' : 'Accept'}</button>
                <button className="secondary-small" onClick={() => setEditing(editing === item.applianceId ? null : item.applianceId)}><Pencil size={15} /> Change</button>
                <button className="text-button" onClick={() => setDecisions((all) => ({ ...all, [item.applianceId]: 'rejected' }))}>Not now</button>
              </div>
              {editing === item.applianceId && <div className="schedule-edit"><label>Start time <input type="time" onChange={(event) => { const [hour, minute] = event.target.value.split(':').map(Number); modify(item.applianceId, hour + minute / 60) }} /></label></div>}
            </article>
          )
        })}
      </div>

      {result.infeasible.length > 0 && <div className="home-alert"><Clock3 size={20} /><div><b>A time could not be found</b><span>{result.infeasible.join(', ')} needs either a later deadline or a wider preferred time.</span></div></div>}
      {savings > 0 && <p className="calculated-savings">Calculated tariff difference: {tariffPlan.currency}{savings.toFixed(2)} for this simulated schedule. This is not a guaranteed bill saving.</p>}

      <details className="advanced-details"><summary>Advanced Details</summary><div><b>Estimated peak</b>: {result.optimizedPeak.toFixed(2)} household power units<br /><b>Technical schedule</b>: {result.schedule.map((item) => `${item.name} ${formatSchedule(item)}`).join(' · ') || 'No active appliances'}</div></details>
    </div>
  )
}

export function AppliancesView({ appliances, onAppliances }: { appliances: Appliance[]; onAppliances: (items: Appliance[]) => void }) {
  const [editing, setEditing] = useState<Appliance | null>(null)

  const save = (item: Appliance) => {
    const exists = appliances.some((entry) => entry.id === item.id)
    onAppliances(exists ? appliances.map((entry) => entry.id === item.id ? item : entry) : [...appliances, item])
    setEditing(null)
  }

  const newAppliance = () => ({
    id: `appliance-${Date.now()}`, name: 'New appliance', category: 'Flexible appliance',
    icon: 'lightbulb' as const, power: 0.8, duration: 1, deadline: 22, priority: 'Medium' as const,
    critical: false, interruptible: true, preferredWindow: [18, 22] as [number, number],
    originalStart: 18, active: true,
  })

  return (
    <div className="residential-stack">
      <div className="appliances-toolbar"><p>Appliances are estimated until the household meter identifies them.</p><button className="primary-small" onClick={() => setEditing(newAppliance())}><Plus size={16} /> Add appliance</button></div>
      <div className="appliance-grid">
        {appliances.map((item) => (
          <article className="appliance-card" key={item.id}>
            <div className="appliance-card-head"><span className="appliance-icon">{iconFor(item.icon, 24)}</span><div><h3>{item.name}</h3><p>{item.active ? 'Scheduling is on' : 'Scheduling is off'}</p></div><TagState active={item.active} /></div>
            <dl><div><dt>Consumption</dt><dd>Estimated only</dd></div><div><dt>Preferred time</dt><dd>{clock(item.preferredWindow[0])}–{clock(item.preferredWindow[1])}</dd></div><div><dt>Priority</dt><dd>{item.priority}</dd></div></dl>
            <div className="appliance-actions"><button onClick={() => setEditing(item)}><Pencil size={15} /> Edit</button><button onClick={() => onAppliances(appliances.filter((entry) => entry.id !== item.id))}><Trash2 size={15} /> Remove</button></div>
          </article>
        ))}
      </div>
      {editing && <ApplianceEditor item={editing} onCancel={() => setEditing(null)} onSave={save} />}
    </div>
  )
}

function TagState({ active }: { active: boolean }) {
  return <span className={`tag-state ${active ? 'good' : 'off'}`}>{active ? 'On' : 'Off'}</span>
}

function ApplianceEditor({ item, onCancel, onSave }: { item: Appliance; onCancel: () => void; onSave: (item: Appliance) => void }) {
  const [draft, setDraft] = useState(item)
  return (
    <div className="editor-backdrop"><div className="appliance-editor">
      <h2>{item.name === 'New appliance' ? 'Add appliance' : 'Edit appliance'}</h2>
      <label>Name<input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} /></label>
      <div className="editor-row"><label>Priority<select value={draft.priority} onChange={(event) => setDraft({ ...draft, priority: event.target.value as Appliance['priority'] })}><option>Low</option><option>Medium</option><option>High</option><option>Critical</option></select></label><label>Deadline<input type="time" value={clock(draft.deadline)} onChange={(event) => { const [h, m] = event.target.value.split(':').map(Number); setDraft({ ...draft, deadline: h + m / 60 }) }} /></label></div>
      <label className="toggle-row"><input type="checkbox" checked={draft.active} onChange={(event) => setDraft({ ...draft, active: event.target.checked })} /> Allow automatic scheduling</label>
      <div className="editor-actions"><button className="secondary-small" onClick={onCancel}>Cancel</button><button className="primary-small" onClick={() => onSave(draft)}>Save</button></div>
    </div></div>
  )
}
