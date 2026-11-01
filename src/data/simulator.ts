import type { Appliance, SeriesPoint } from '../types'
import type { TariffPlan } from './staticData'

/**
 * Local data simulator.
 * Produces a coherent, seeded 24 h timeline for demand, carbon intensity,
 * tariff rate and temperature. A virtual clock advances the series so the
 * dashboard keeps moving even when no live feed is attached. Live API values
 * are merged on top by the DataProvider, so nothing here is a dead end.
 */

/** Simulated minutes added per simulator tick. */
export const TICK_STEP_MINUTES = 5

let clockOffsetMs = 0

/** Advance the virtual clock (used by the ticker). */
export function advanceClock(minutes: number) {
  clockOffsetMs += minutes * 60_000
}

/** Virtual "now" - real time shifted by the simulator clock. */
export function getNow(baseMs: number = Date.now()): Date {
  return new Date(baseMs + clockOffsetMs)
}

/* ---------------------------------------------------------------- curves */

/** Hourly base demand (kW) - Indian residential double-peak shape. */
const DEMAND_CURVE = [3.1, 2.9, 2.6, 2.4, 2.5, 2.9, 3.3, 4.1, 4.7, 5.0, 5.4, 5.9, 6.2, 6.5, 6.7, 6.3, 6.0, 6.4, 7.1, 6.9, 6.4, 5.5, 4.4, 3.6]

/** Hourly base grid carbon intensity (gCO2/kWh). */
const CARBON_CURVE = [476, 462, 448, 432, 421, 426, 438, 461, 491, 512, 532, 551, 564, 578, 588, 581, 559, 548, 536, 524, 497, 486, 478, 470]

/** Cosine interpolation between hourly samples keeps the series smooth. */
const sampleCurve = (curve: number[], hour: number) => {
  const position = ((hour % 24) + 24) % 24
  const index = Math.floor(position)
  const fraction = position - index
  const next = curve[(index + 1) % 24]
  const blend = (1 - Math.cos(fraction * Math.PI)) / 2
  return curve[index] + (next - curve[index]) * blend
}

/** Deterministic pseudo-random value in [-1, 1] for a given hour + seed. */
export const seededNoise = (seed: number, hour: number) => {
  const value = Math.sin(seed * 12.9898 + hour * 78.233) * 43758.5453
  return (value - Math.floor(value)) * 2 - 1
}

/** Temperature profile (deg C) - trough pre-dawn, peak mid-afternoon. */
const temperatureCurve = (hour: number, seed: number) => 29.5 + 5.5 * Math.sin(((hour - 9) / 24) * 2 * Math.PI) + seededNoise(seed, hour) * 0.8

/** Hotter hours pull more cooling load onto the grid, lifting intensity. */
const weatherCarbonMultiplier = (temperature: number, seed: number, hour: number) => {
  const heat = Math.max(0, Math.min(1, (temperature - 28) / 7))
  return 1 + heat * 0.12 + seededNoise(seed + 7, hour) * 0.02
}

const demandAt = (hour: number, seed: number) => Math.max(0.8, sampleCurve(DEMAND_CURVE, hour) + seededNoise(seed, hour) * 0.22)
const carbonAt = (hour: number, seed: number) => Math.round(sampleCurve(CARBON_CURVE, hour) * weatherCarbonMultiplier(temperatureCurve(hour, seed), seed, hour))

/* ---------------------------------------------------------------- tariff */

/** Rate applicable at a given hour for a tariff plan (handles windows that cross midnight). */
export function tariffRateAt(plan: TariffPlan, hour: number): number {
  const position = ((hour % 24) + 24) % 24
  const window = plan.windows.find((entry) => (entry.from < entry.to ? position >= entry.from && position < entry.to : position >= entry.from || position < entry.to))
  return window?.rate ?? plan.windows[0].rate
}

export function tariffWindowAt(plan: TariffPlan, hour: number): TariffPlan['windows'][number] {
  const position = ((hour % 24) + 24) % 24
  return plan.windows.find((entry) => (entry.from < entry.to ? position >= entry.from && position < entry.to : position >= entry.from || position < entry.to)) ?? plan.windows[0]
}

export const peakRateOf = (plan: TariffPlan) => Math.max(...plan.windows.map((entry) => entry.rate))

/* ---------------------------------------------------------------- series */

export const clockLabel = (date: Date) => date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })

const STEP_HOURS = 0.25
const POINTS = 96

/**
 * Build the rolling 24 h timeline starting from the virtual clock.
 * The first 3 points carry a forecast + uncertainty band.
 */
export function buildTimeline(plan: TariffPlan, baseMs: number = Date.now()): SeriesPoint[] {
  const now = getNow(baseMs)
  const seed = now.getFullYear() * 372 + now.getMonth() * 31 + now.getDate()
  const startHour = now.getHours() + now.getMinutes() / 60

  return Array.from({ length: POINTS }, (_, index) => {
    const hour = startHour + index * STEP_HOURS
    const demand = demandAt(hour, seed)
    const forecastable = index < 3
    const spread = 0.07 + index * 0.02

    return {
      time: clockLabel(new Date(now.getTime() + index * STEP_HOURS * 3600_000)),
      hour: ((startHour + index * STEP_HOURS) % 24 + 24) % 24,
      demand: Number(demand.toFixed(2)),
      forecast: forecastable ? Number((demand * 1.03).toFixed(2)) : undefined,
      lower: forecastable ? Number((demand * (1 - spread)).toFixed(2)) : undefined,
      upper: forecastable ? Number((demand * (1 + spread)).toFixed(2)) : undefined,
      carbon: carbonAt(hour, seed),
      rate: tariffRateAt(plan, hour),
      temperature: Math.round(temperatureCurve(hour, seed)),
    }
  })
}

/** Instantaneous values at the virtual clock position. */
export function currentSnapshot(plan: TariffPlan, baseMs: number = Date.now()) {
  const now = getNow(baseMs)
  const hour = now.getHours() + now.getMinutes() / 60
  const seed = now.getFullYear() * 372 + now.getMonth() * 31 + now.getDate()
  return {
    now,
    hour,
    demand: Number(demandAt(hour, seed).toFixed(2)),
    carbon: carbonAt(hour, seed),
    rate: tariffRateAt(plan, hour),
    window: tariffWindowAt(plan, hour),
    temperature: Math.round(temperatureCurve(hour, seed)),
  }
}

/** Daily energy (kWh) by integrating the demand curve from midnight to now. */
export function energyToday(baseMs: number = Date.now()): number {
  const now = getNow(baseMs)
  const seed = now.getFullYear() * 372 + now.getMonth() * 31 + now.getDate()
  const hour = now.getHours() + now.getMinutes() / 60
  let total = 0
  for (let step = 0; step < hour; step += 0.25) {
    const duration = Math.min(0.25, hour - step)
    if (duration > 0) total += demandAt(step, seed) * duration
  }
  return Number(total.toFixed(1))
}

/** Spend so far today at the active tariff plan's rates. */
export function spendToday(plan: TariffPlan, baseMs: number = Date.now()): number {
  const now = getNow(baseMs)
  const seed = now.getFullYear() * 372 + now.getMonth() * 31 + now.getDate()
  const hour = now.getHours() + now.getMinutes() / 60
  let total = 0
  for (let step = 0; step < hour; step += 0.25) {
    const duration = Math.min(0.25, hour - step)
    if (duration > 0) total += demandAt(step, seed) * tariffRateAt(plan, step) * duration
  }
  return Number(total.toFixed(0))
}

/** Emissions so far today (kgCO2). */
export function emissionsToday(baseMs: number = Date.now()): number {
  const now = getNow(baseMs)
  const seed = now.getFullYear() * 372 + now.getMonth() * 31 + now.getDate()
  const hour = now.getHours() + now.getMinutes() / 60
  let total = 0
  for (let step = 0; step < hour; step += 0.25) {
    const duration = Math.min(0.25, hour - step)
    if (duration > 0) total += demandAt(step, seed) * carbonAt(step, seed) * duration
  }
  return Number((total / 1000).toFixed(1))
}

/** Cleanest / dirtiest window in the next few hours, straight off the series. */
export function carbonWindows(baseMs: number = Date.now()) {
  const now = getNow(baseMs)
  const seed = now.getFullYear() * 372 + now.getMonth() * 31 + now.getDate()
  const start = now.getHours() + now.getMinutes() / 60
  const samples = Array.from({ length: 7 }, (_, index) => ({ hour: start + index, value: carbonAt(start + index, seed) }))
  const cleanest = samples.reduce((best, sample) => (sample.value < best.value ? sample : best))
  const dirtiest = samples.reduce((worst, sample) => (sample.value > worst.value ? sample : worst))
  const format = (hour: number) => `${String(Math.floor(hour) % 24).padStart(2, '0')}:00`
  const spread = Math.max(1, dirtiest.value - cleanest.value)
  return {
    cleanest: { from: format(cleanest.hour), to: format(cleanest.hour + 3), value: cleanest.value },
    dirtiest: { from: format(dirtiest.hour), to: format(dirtiest.hour + 3), value: dirtiest.value },
    reduction: Math.round((spread / dirtiest.value) * 100),
  }
}

/** Appliance share of today's energy from the live appliance list. */
export function applianceShares(appliances: Appliance[]) {
  const colors = ['#55e4a3', '#4fb3ff', '#a78bfa', '#fbbf5b', '#f472b6', '#66748e', '#38bdf8', '#34d399']
  const active = appliances.filter((item) => item.active)
  const weighted = active.map((item) => ({ item, share: item.power * item.duration }))
  const total = weighted.reduce((sum, entry) => sum + entry.share, 0) || 1

  const rows = weighted
    .map((entry, index) => ({
      name: entry.item.name,
      value: Number(((entry.share / total) * 100).toFixed(1)),
      color: colors[index % colors.length],
    }))
    .sort((a, b) => b.value - a.value)

  if (rows.length > 6) {
    const head = rows.slice(0, 5)
    const rest = rows.slice(5).reduce((sum, row) => sum + row.value, 0)
    return [...head, { name: 'Other', value: Number(rest.toFixed(1)), color: colors[5] }]
  }
  return rows
}
