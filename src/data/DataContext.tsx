import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  carbonSourceLabel,
  fetchCarbon,
  fetchWeather,
  type CarbonProvider,
  type CarbonSnapshot,
  type Location,
  type WeatherBundle,
  type WeatherSnapshot,
} from '../services/api'
import {
  advanceClock,
  applianceShares,
  buildTimeline,
  carbonWindows,
  currentSnapshot,
  emissionsToday,
  energyToday,
  spendToday,
  TICK_STEP_MINUTES,
} from './simulator'
import { defaultLocation, defaultTariffPlanId, tariffPlans, type TariffPlan } from './staticData'
import type { Appliance, InputSource, SeriesPoint } from '../types'
import {
  fetchLatestMeterReading,
  fetchMeterStats,
  type MeterReading,
  type MeterStatsResponse,
} from '../services/meter'

/**
 * DataContext is the single seam between the UI and the data layer.
 * Everything the dashboard shows flows through here: live API responses,
 * static reference data and simulator output. Swapping the simulator for a
 * real telemetry stream only means changing this file.
 */

export interface ApplianceShare {
  name: string
  value: number
  color: string
}

export interface CarbonPeriod {
  label: string
  value: string
  detail: string
  tone: 'good' | 'risk' | 'info'
}

type WeatherDay = WeatherBundle['day']

interface DataValue {
  timeline: SeriesPoint[]
  meterReading: MeterReading | null
  meterStats: MeterStatsResponse | null
  meterConnected: boolean
  tariffPlan: TariffPlan
  setTariffPlan: (plan: TariffPlan) => void
  weather: WeatherSnapshot | null
  weatherDay: WeatherDay | null
  carbon: CarbonSnapshot | null
  carbonProvider: CarbonProvider
  setCarbonProvider: (provider: CarbonProvider) => void
  carbonStatus: 'live' | 'simulated' | 'offline'
  sources: InputSource[]
  shares: ApplianceShare[]
  carbonPeriods: CarbonPeriod[]
  emissions: number
  windows: ReturnType<typeof carbonWindows>
  now: Date
  tick: number
  liveCount: number
  refresh: () => void
  loading: boolean
}

const storageKey = (suffix: string) => `nexus-${suffix}`

const readStorage = <T,>(suffix: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(storageKey(suffix))
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

const formatAge = (timestamp: number) => {
  const minutes = Math.max(0, Math.round((Date.now() - timestamp) / 60_000))
  if (minutes < 1) return 'just now'
  if (minutes === 1) return '1 min ago'
  return `${minutes} min ago`
}

/** Read a Vite env var without requiring the vite/client types. */
const envValue = (key: string): string | undefined => {
  const meta = import.meta as unknown as { env?: Record<string, string | undefined> }
  return meta.env?.[key]
}

const DataContext = createContext<DataValue | null>(null)

export function DataProvider({ children, appliances }: { children: ReactNode; appliances: Appliance[] }) {
  const [tariffPlan, setTariffPlanState] = useState<TariffPlan>(
    () => tariffPlans.find((plan) => plan.id === readStorage('tariff-plan', defaultTariffPlanId)) ?? tariffPlans[0],
  )
  const [carbonProvider, setCarbonProviderState] = useState<CarbonProvider>(() => readStorage('carbon-provider', 'uk' as CarbonProvider))
  const [weather, setWeather] = useState<WeatherBundle['current'] | null>(null)
  const [weatherDay, setWeatherDay] = useState<WeatherDay | null>(null)
  const [carbon, setCarbon] = useState<CarbonSnapshot | null>(null)
  const [carbonStatus, setCarbonStatus] = useState<'live' | 'simulated' | 'offline'>('simulated')
  const [meterReading, setMeterReading] = useState<MeterReading | null>(null)
  const [meterStats, setMeterStats] = useState<MeterStatsResponse | null>(null)
  const [meterConnected, setMeterConnected] = useState(false)
  const [tick, setTick] = useState(0)
  const [loading, setLoading] = useState(true)
  const location: Location = readStorage('location', defaultLocation)

  const setTariffPlan = useCallback((plan: TariffPlan) => {
    setTariffPlanState(plan)
    localStorage.setItem(storageKey('tariff-plan'), JSON.stringify(plan.id))
  }, [])

  const setCarbonProvider = useCallback((provider: CarbonProvider) => {
    setCarbonProviderState(provider)
    localStorage.setItem(storageKey('carbon-provider'), JSON.stringify(provider))
  }, [])

  /* Live feeds --------------------------------------------------------- */

  const loadWeather = useCallback(async () => {
    try {
      const bundle = await fetchWeather(location)
      setWeather(bundle.current)
      setWeatherDay(bundle.day)
    } catch {
      /* offline: simulator values keep the dashboard populated */
    }
  }, [location])

  const loadCarbon = useCallback(async () => {
    if (carbonProvider === 'simulated') {
      setCarbon(null)
      setCarbonStatus('simulated')
      return
    }
    try {
      const snapshot = await fetchCarbon(carbonProvider, {
        token: envValue('VITE_ELECTRICITY_MAPS_TOKEN'),
        zone: envValue('VITE_GRID_ZONE'),
      })
      setCarbon(snapshot)
      setCarbonStatus('live')
    } catch {
      setCarbon(null)
      setCarbonStatus('offline')
    }
  }, [carbonProvider])

  const refresh = useCallback(() => {
    setLoading(true)
    void Promise.all([loadWeather(), loadCarbon()]).finally(() => setLoading(false))
  }, [loadWeather, loadCarbon])

  useEffect(() => {
    refresh()
  }, [refresh])

  useEffect(() => {
    let active = true
    const loadMeter = async () => {
      try {
        const [latest, stats] = await Promise.all([fetchLatestMeterReading(), fetchMeterStats()])
        if (!active) return
        setMeterConnected(true)
        setMeterReading(latest.reading)
        setMeterStats(stats)
      } catch {
        if (!active) return
        setMeterConnected(false)
      }
    }
    void loadMeter()
    const timer = window.setInterval(() => void loadMeter(), 5000)
    return () => {
      active = false
      window.clearInterval(timer)
    }
  }, [])

  /* Simulator tick ----------------------------------------------------- */

  useEffect(() => {
    const timer = window.setInterval(() => {
      advanceClock(TICK_STEP_MINUTES)
      setTick((value) => value + 1)
    }, 10_000)
    return () => window.clearInterval(timer)
  }, [])

  /* Derived series ----------------------------------------------------- */

  const simulatedTimeline = useMemo(() => buildTimeline(tariffPlan), [tariffPlan, tick])
  const timeline = useMemo<SeriesPoint[]>(() =>
    meterConnected && meterReading
      ? simulatedTimeline.map((point, index) => index === 0
        ? { ...point, demand: meterReading.powerKw }
        : point)
      : simulatedTimeline,
  [simulatedTimeline, meterConnected, meterReading])
  const snapshot = useMemo(() => currentSnapshot(tariffPlan), [tariffPlan, tick])
  const shares = useMemo(() => applianceShares(appliances), [appliances])
  const windows = useMemo(() => carbonWindows(), [tick])
  const emissions = useMemo(() => emissionsToday(), [tick])

  /* Merged sources ----------------------------------------------------- */

  const sources = useMemo<InputSource[]>(() => {
    const energy = energyToday()
    const emissions = emissionsToday()
    const spend = spendToday(tariffPlan)
    const peakRate = Math.max(...tariffPlan.windows.map((entry) => entry.rate))
    const liveCarbon = carbonStatus === 'live' && carbon ? carbon.intensity : snapshot.carbon

    const weatherSource: InputSource = weather
      ? {
          id: 'weather', name: 'Weather API', shortName: 'Weather signal', status: 'live', lastUpdated: formatAge(weather.updatedAt), accent: 'blue',
          description: `Live conditions from Open-Meteo for ${location.name}.`,
          metrics: [
            { label: 'Temperature', value: `${Math.round(weather.temperature)}°C` },
            { label: 'Humidity', value: `${Math.round(weather.humidity)}%` },
            { label: 'Condition', value: weather.condition },
            { label: 'Cooling impact', value: `+${weather.coolingImpact}%` },
          ],
          note: `Fetched live from api.open-meteo.com. ${weatherDay?.date ?? ''} outlook: ${weatherDay?.blocks.map((block) => `${block.label} ${Math.round(block.temperature)}°C`).join(' · ')}.`,
          source: 'api.open-meteo.com',
        }
      : {
          id: 'weather', name: 'Weather API', shortName: 'Weather signal', status: 'offline', lastUpdated: 'unreachable', accent: 'blue',
          description: 'Weather feed could not be reached, simulator values are standing in.',
          metrics: [
            { label: 'Temperature', value: `${snapshot.temperature}°C` },
            { label: 'Humidity', value: '64%' },
            { label: 'Condition', value: 'Simulated' },
            { label: 'Cooling impact', value: '+12%' },
          ],
          note: 'api.open-meteo.com did not respond. Demand and carbon still use the local simulator profile.',
          source: 'Local simulator',
        }

    const carbonSource: InputSource = {
      id: 'carbon', name: 'Grid Carbon Intensity', shortName: 'Grid impact',
      status: carbonStatus === 'live' ? 'live' : carbonStatus === 'simulated' ? 'simulated' : 'offline',
      lastUpdated: carbonStatus === 'live' && carbon ? formatAge(carbon.updatedAt) : 'simulated feed',
      accent: 'violet',
      description: carbonStatus === 'live'
        ? `Live carbon intensity from ${carbon?.provider ?? 'grid API'}.`
        : 'Time-dependent grid emissions signal, currently simulated locally.',
      metrics: [
        { label: 'Current intensity', value: `${liveCarbon} gCO₂/kWh` },
        { label: 'Today’s emissions', value: `${emissions} kgCO₂` },
        { label: 'Cleanest window', value: `${windows.cleanest.from}–${windows.cleanest.to}` },
        { label: 'Data source', value: carbonStatus === 'live' ? 'Live API' : 'Simulated' },
      ],
      note: carbonStatus === 'live'
        ? `Fetched live from ${carbon?.provider ?? 'grid API'}.`
        : `No live feed attached. Set the provider on Input Monitoring (Electricity Maps token or UK grid) to go live. Current fallback: ${carbonSourceLabel(carbonProvider)}.`,
      source: carbonStatus === 'live' ? carbon?.provider : 'Local simulator',
    }

    return [
      {
        id: 'meter', name: 'Smart Meter / IoT Devices', shortName: 'IoT telemetry',
        status: meterConnected ? 'simulated' : 'offline',
        lastUpdated: meterConnected && meterReading ? formatAge(Date.parse(meterReading.timestamp)) : 'backend unavailable',
        accent: 'emerald',
        description: meterConnected
          ? 'SIMULATED household-level MQTT telemetry ingested through the backend.'
          : 'SIMULATED meter backend unavailable; dashboard is using local fallback values.',
        metrics: [
          { label: 'Current household power', value: `${(meterConnected && meterReading ? meterReading.powerKw : snapshot.demand).toFixed(3)} kW` },
          { label: 'Interval energy', value: `${meterConnected && meterReading ? meterReading.intervalEnergyKwh.toFixed(6) : '0.000000'} kWh` },
          { label: 'Cumulative energy', value: `${meterConnected && meterReading ? meterReading.cumulativeEnergyKwh.toFixed(3) : 'fallback'} kWh` },
          { label: 'Accepted / rejected', value: `${meterStats?.accepted ?? 0} / ${meterStats?.rejected ?? 0}` },
        ],
        note: meterConnected
          ? `SIMULATED backend connected. Reading level is household-only; appliance identification is not inferred. Rejected=${meterStats?.rejected ?? 0}, duplicates=${meterStats?.duplicate ?? 0}.`
          : 'Local simulator fallback remains active because the Node/MQTT backend is unavailable.',
        source: meterConnected ? 'SIMULATED MQTT meter backend' : 'Local simulator',
      },
      weatherSource,
      {
        id: 'tariff', name: 'Electricity Tariff', shortName: 'Time-of-use pricing', status: 'configured', lastUpdated: tariffPlan.utility, accent: 'amber',
        description: `${tariffPlan.name} rates applied across the schedule and bill estimate.`,
        metrics: [
          { label: 'Current rate', value: `${tariffPlan.currency}${snapshot.rate.toFixed(2)} / kWh` },
          { label: 'Peak rate', value: `${tariffPlan.currency}${peakRate.toFixed(2)} / kWh` },
          { label: 'Current window', value: snapshot.window.label },
          { label: 'Cheapest window', value: tariffPlan.windows.reduce((best, entry) => (entry.rate < best.rate ? entry : best)).label },
        ],
        note: 'Static tariff plan from the local catalogue. Swap for a utility tariff API when one is available.',
        source: 'Static tariff catalogue',
      },
      carbonSource,
      {
        id: 'operator', name: 'User / Operator Input', shortName: 'Human signals', status: 'configured', lastUpdated: 'stored locally', accent: 'rose',
        description: 'Priorities, constraints and recommendation feedback protect user comfort.',
        metrics: [
          { label: 'Acceptance rate', value: '82%' },
          { label: 'Critical loads', value: String(appliances.filter((item) => item.critical).length) },
          { label: 'Saved preferences', value: '14' },
          { label: 'Active constraints', value: String(appliances.filter((item) => !item.interruptible).length) },
        ],
        note: 'Stored locally for this prototype. Production can route this to a user preference service.',
        source: 'Local storage',
      },
    ]
  }, [weather, weatherDay, carbon, carbonStatus, carbonProvider, tariffPlan, appliances, snapshot, windows, tick, meterConnected, meterReading, meterStats])

  const value = useMemo<DataValue>(() => ({
    timeline,
    meterReading,
    meterStats,
    meterConnected,
    tariffPlan,
    setTariffPlan,
    weather,
    weatherDay,
    carbon,
    carbonProvider,
    setCarbonProvider,
    carbonStatus,
    sources,
    shares,
    carbonPeriods: [
      { label: 'Cleanest window', value: `${windows.cleanest.from}–${windows.cleanest.to}`, detail: `${windows.cleanest.value} gCO₂/kWh`, tone: 'good' },
      { label: 'High-carbon period', value: `${windows.dirtiest.from}–${windows.dirtiest.to}`, detail: `${windows.dirtiest.value} gCO₂/kWh`, tone: 'risk' },
      { label: 'Reduction potential', value: `${windows.reduction}%`, detail: 'With flexible-load shifts', tone: 'info' },
    ],
    emissions,
    windows,
    now: snapshot.now,
    tick,
    liveCount: sources.filter((source) => source.status === 'live').length,
    refresh,
    loading,
  }), [timeline, tariffPlan, setTariffPlan, weather, weatherDay, carbon, carbonProvider, setCarbonProvider, carbonStatus, sources, shares, windows, emissions, snapshot, tick, refresh, loading, meterReading, meterStats, meterConnected])

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>
}

export function useData(): DataValue {
  const context = useContext(DataContext)
  if (!context) throw new Error('useData must be used inside <DataProvider>')
  return context
}
