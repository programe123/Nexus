import type { MeterReading } from './types.js'

export type ValidationResult =
  | { ok: true; reading: MeterReading }
  | { ok: false; reason: string }

export function validateReading(value: unknown): ValidationResult {
  if (!value || typeof value !== 'object') return { ok: false, reason: 'reading must be an object' }
  const row = value as Record<string, unknown>
  const requiredStrings = ['deviceId', 'readingId', 'timestamp']
  for (const key of requiredStrings) {
    if (typeof row[key] !== 'string' || !(row[key] as string).trim()) {
      return { ok: false, reason: `${key} is required` }
    }
  }
  const timestamp = Date.parse(row.timestamp as string)
  if (!Number.isFinite(timestamp)) return { ok: false, reason: 'timestamp must be ISO 8601' }

  const numericKeys = ['powerKw', 'voltageV', 'currentA', 'cumulativeEnergyKwh', 'intervalEnergyKwh']
  for (const key of numericKeys) {
    if (typeof row[key] !== 'number' || !Number.isFinite(row[key])) {
      return { ok: false, reason: `${key} must be a finite number` }
    }
  }

  const powerKw = row.powerKw as number
  const voltageV = row.voltageV as number
  const currentA = row.currentA as number
  const cumulativeEnergyKwh = row.cumulativeEnergyKwh as number
  const intervalEnergyKwh = row.intervalEnergyKwh as number

  if (powerKw < 0 || powerKw > 100) return { ok: false, reason: 'powerKw outside physical range 0-100 kW' }
  if (voltageV < 180 || voltageV > 260) return { ok: false, reason: 'voltageV outside physical range 180-260 V' }
  if (currentA < 0 || currentA > 450) return { ok: false, reason: 'currentA outside physical range 0-450 A' }
  if (cumulativeEnergyKwh < 0 || intervalEnergyKwh < 0) return { ok: false, reason: 'energy values cannot be negative' }
  if (row.meterLevel !== undefined && row.meterLevel !== 'household') {
    return { ok: false, reason: 'household meter data cannot identify an appliance' }
  }

  const reading: MeterReading = {
    deviceId: (row.deviceId as string).trim(),
    readingId: (row.readingId as string).trim(),
    timestamp: new Date(timestamp).toISOString(),
    powerKw,
    voltageV,
    currentA,
    cumulativeEnergyKwh,
    intervalEnergyKwh,
    meterLevel: 'household',
  }
  return { ok: true, reading }
}
