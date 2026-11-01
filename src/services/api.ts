/**
 * API adapters.
 * Each adapter returns a normalized shape and throws on failure so the caller can
 * fall back to the local simulator. To point at a different region or provider,
 * change the URLs / env vars below - no other module needs to know.
 */

export interface Location {
  name: string
  latitude: number
  longitude: number
}

export interface WeatherSnapshot {
  temperature: number
  humidity: number
  condition: string
  windSpeed: number
  coolingImpact: number
  isDay: boolean
  updatedAt: number
}

export interface WeatherDay {
  date: string
  blocks: Array<{ label: string; temperature: number; precipitation: number }>
}

export interface WeatherBundle {
  current: WeatherSnapshot
  hourly: Array<{ time: string; temperature: number; precipitation: number }>
  day: WeatherDay
  source: string
}

export type CarbonProvider = 'auto' | 'electricitymaps' | 'uk' | 'simulated'

export interface CarbonEntry {
  time: string
  intensity: number
}

export interface CarbonSnapshot {
  intensity: number
  forecast: CarbonEntry[]
  provider: string
  source: 'live' | 'simulated'
  updatedAt: number
}

/* ------------------------------------------------------------------ weather */

const WEATHER_CODES: Record<number, string> = {
  0: 'Clear sky', 1: 'Mainly clear', 2: 'Partly cloudy', 3: 'Overcast',
  45: 'Fog', 48: 'Rime fog', 51: 'Light drizzle', 53: 'Drizzle', 55: 'Dense drizzle',
  56: 'Freezing drizzle', 57: 'Dense freezing drizzle', 61: 'Light rain', 63: 'Rain',
  65: 'Heavy rain', 66: 'Freezing rain', 67: 'Heavy freezing rain', 71: 'Light snow',
  73: 'Snow', 75: 'Heavy snow', 77: 'Snow grains', 80: 'Light showers', 81: 'Showers',
  82: 'Violent showers', 85: 'Snow showers', 86: 'Heavy snow showers', 95: 'Thunderstorm',
  96: 'Thunderstorm with hail', 99: 'Severe thunderstorm with hail',
}

const clockLabel = (value: string) => {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return '--:--'
  return parsed.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

export async function fetchWeather(location: Location, signal?: AbortSignal): Promise<WeatherBundle> {
  const params = new URLSearchParams({
    latitude: String(location.latitude),
    longitude: String(location.longitude),
    current: 'temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m,is_day',
    hourly: 'temperature_2m,precipitation',
    forecast_days: '1',
    timezone: 'auto',
  })
  const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params.toString()}`, { signal })
  if (!response.ok) throw new Error(`Open-Meteo responded ${response.status}`)
  const payload = await response.json()

  const hourly: WeatherBundle['hourly'] = (payload.hourly?.time ?? []).map((time: string, index: number) => ({
    time: clockLabel(time),
    temperature: payload.hourly.temperature_2m[index],
    precipitation: payload.hourly.precipitation?.[index] ?? 0,
  }))

  const block = (label: string, start: number, end: number) => {
    const slice = hourly.filter((entry) => {
      const hour = Number(entry.time.slice(0, 2))
      return hour >= start && hour < end
    })
    return {
      label,
      temperature: slice.length
        ? Math.round((slice.reduce((sum, entry) => sum + entry.temperature, 0) / slice.length) * 10) / 10
        : payload.current.temperature_2m,
      precipitation: Math.round(slice.reduce((sum, entry) => sum + entry.precipitation, 0) * 10) / 10,
    }
  }

  return {
    current: {
      temperature: payload.current.temperature_2m,
      humidity: payload.current.relative_humidity_2m,
      condition: WEATHER_CODES[payload.current.weather_code] ?? 'Unknown',
      windSpeed: payload.current.wind_speed_10m,
      coolingImpact: Math.max(0, Math.round((payload.current.temperature_2m - 25) * 1.4)),
      isDay: payload.current.is_day === 1,
      updatedAt: Date.now(),
    },
    hourly,
    day: {
      date: new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' }),
      blocks: [block('Morning', 6, 12), block('Afternoon', 12, 17), block('Evening', 17, 22), block('Night', 0, 6)],
    },
    source: 'Open-Meteo',
  }
}

/* ----------------------------------------------------------- carbon intensity */

const withTimeout = async (url: string, init: RequestInit & { timeoutMs?: number } = {}) => {
  const { timeoutMs = 8000, ...rest } = init
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, { ...rest, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

async function carbonFromElectricityMaps(token: string, zone: string): Promise<CarbonSnapshot> {
  const live = await withTimeout(`https://api.electricitymap.org/v3/carbon-intensity/latest?zone=${zone}`, { headers: { 'auth-token': token } })
  if (!live.ok) throw new Error(`Electricity Maps responded ${live.status}`)
  const liveData = await live.json()

  const forecastResponse = await withTimeout(
    `https://api.electricitymap.org/v3/carbon-intensity/forecast?zone=${zone}`,
    { headers: { 'auth-token': token } },
  ).catch(() => null)
  const forecastPayload = forecastResponse?.ok ? await forecastResponse.json() : null

  const forecast: CarbonEntry[] = (forecastPayload?.forecast ?? []).slice(0, 24).map((entry: { carbonIntensity: number; datetime: string }) => ({
    time: clockLabel(entry.datetime),
    intensity: Math.round(entry.carbonIntensity),
  }))

  return {
    intensity: Math.round(liveData.carbonIntensity ?? liveData.zoneStates?.at?.(-1)?.carbonIntensity ?? 0),
    forecast,
    provider: `Electricity Maps · ${zone}`,
    source: 'live',
    updatedAt: Date.now(),
  }
}

async function carbonFromUkGrid(): Promise<CarbonSnapshot> {
  const response = await withTimeout('https://api.carbonintensity.org.uk/intensity')
  if (!response.ok) throw new Error(`Carbon Intensity API responded ${response.status}`)
  const payload = await response.json()
  const periods = payload.data ?? []
  if (!periods.length) throw new Error('Carbon Intensity API returned no periods')

  const forecast: CarbonEntry[] = periods.slice(0, 48).map((period: { from: string; intensity: { forecast: number } }) => ({
    time: clockLabel(period.from),
    intensity: Math.round(period.intensity.forecast),
  }))
  const current = periods[0]

  return {
    intensity: Math.round(current.intensity.actual ?? current.intensity.forecast),
    forecast,
    provider: 'National Grid ESO · UK',
    source: 'live',
    updatedAt: Date.now(),
  }
}

export async function fetchCarbon(provider: CarbonProvider, options: { token?: string; zone?: string } = {}): Promise<CarbonSnapshot> {
  const chain: Array<() => Promise<CarbonSnapshot>> = []

  if ((provider === 'electricitymaps' || provider === 'auto') && options.token) {
    chain.push(() => carbonFromElectricityMaps(options.token!, options.zone ?? 'IN-NO'))
  }
  if (provider === 'uk' || provider === 'auto') chain.push(() => carbonFromUkGrid())

  for (const attempt of chain) {
    try {
      return await attempt()
    } catch {
      /* try the next provider, then fall back to the simulator */
    }
  }
  throw new Error('No live carbon-intensity provider responded')
}

/* ----------------------------------------------------------------- utilities */

export function carbonSourceLabel(provider: CarbonProvider): string {
  if (provider === 'electricitymaps') return 'Electricity Maps'
  if (provider === 'uk') return 'National Grid ESO (UK)'
  if (provider === 'auto') return 'Electricity Maps (token required)'
  return 'Local simulator'
}
