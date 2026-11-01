export interface MeterReading {
  deviceId: string
  readingId: string
  timestamp: string
  powerKw: number
  voltageV: number
  currentA: number
  cumulativeEnergyKwh: number
  intervalEnergyKwh: number
  meterLevel: 'household'
}

export interface MeterLatestResponse {
  connected: boolean
  provenance: 'SIMULATED'
  reading: MeterReading | null
}

export interface MeterStatsResponse {
  provenance: 'SIMULATED'
  meterLevel: 'household'
  applianceIdentification: boolean
  accepted: number
  rejected: number
  duplicate: number
  outOfOrder: number
  received: number
  storageFile?: string
}

export interface MeterReadingsResponse {
  provenance: 'SIMULATED'
  readings: MeterReading[]
}

async function getJson<T>(path: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(path, { signal, headers: { Accept: 'application/json' } })
  if (!response.ok) throw new Error(`Meter API responded ${response.status}`)
  return response.json() as Promise<T>
}

export const fetchLatestMeterReading = (signal?: AbortSignal) =>
  getJson<MeterLatestResponse>('/api/meter/latest', signal)

export const fetchMeterReadings = (limit = 100, signal?: AbortSignal) =>
  getJson<MeterReadingsResponse>(`/api/meter/readings?limit=${encodeURIComponent(limit)}`, signal)

export const fetchMeterStats = (signal?: AbortSignal) =>
  getJson<MeterStatsResponse>('/api/meter/stats', signal)
