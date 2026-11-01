import type { Appliance, OptimizationResult, OptimizerWeights, ScheduleItem, SeriesPoint } from '../types'
import { calculatePeakDemand, kwToKwh } from './energy'

export const DEFAULT_INTERVAL_MINUTES = 15
const INTERVALS_PER_HOUR = 60 / DEFAULT_INTERVAL_MINUTES

const normalize24 = (value: number) => ((value % 24) + 24) % 24

const withinWindow = (hour: number, window: [number, number]) => {
  const [rawStart, rawEnd] = window
  if (rawEnd === 24) return hour >= rawStart && hour <= 24
  const start = normalize24(rawStart)
  const end = normalize24(rawEnd)
  return start <= end
    ? hour >= start && hour <= end
    : hour >= start || hour <= end
}

const wallHourAt = (timeline: SeriesPoint[], index: number) => {
  const point = timeline[index]
  if (point?.hour !== undefined) return point.hour
  if (!timeline.length) return index / INTERVALS_PER_HOUR
  const parsed = /^(\d{1,2}):(\d{2})/.exec(point.time)
  if (!parsed) return normalize24(index / INTERVALS_PER_HOUR)
  return Number(parsed[1]) + Number(parsed[2]) / 60
}

const formatHour = (hour: number) => {
  const normalized = normalize24(hour)
  const whole = Math.floor(normalized)
  const minutes = Math.round((normalized - whole) * 60)
  return `${String(whole).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
}

export const formatSchedule = (item: ScheduleItem) =>
  `${formatHour(item.from)}-${formatHour(item.to)}`

const candidateFitsWindow = (timeline: SeriesPoint[], startIndex: number, durationIntervals: number, appliance: Appliance) =>
  Array.from({ length: durationIntervals }, (_, offset) => {
    const hour = wallHourAt(timeline, startIndex + offset)
    return hour !== undefined && withinWindow(hour, appliance.preferredWindow)
  }).every(Boolean)

const candidateMeetsDeadline = (timeline: SeriesPoint[], startIndex: number, durationIntervals: number, appliance: Appliance) => {
  const startHour = wallHourAt(timeline, startIndex)
  const completionOffsetHours = durationIntervals / INTERVALS_PER_HOUR
  const nextDeadline = normalize24(appliance.deadline) >= startHour
    ? normalize24(appliance.deadline)
    : normalize24(appliance.deadline) + 24
  const completion = startHour + completionOffsetHours
  return completion <= nextDeadline
}

const candidateIsFeasible = (timeline: SeriesPoint[], startIndex: number, appliance: Appliance, intervalCount = 96) => {
  const durationIntervals = Math.max(1, Math.ceil(appliance.duration * INTERVALS_PER_HOUR))
  if (startIndex + durationIntervals > intervalCount) return false
  return candidateFitsWindow(timeline, startIndex, durationIntervals, appliance)
    && candidateMeetsDeadline(timeline, startIndex, durationIntervals, appliance)
}

const scheduleImpact = (timeline: SeriesPoint[], items: ScheduleItem[], baseDemand = true) => {
  void baseDemand
  const findStartIndex = (hour: number) => {
    const normalizedHour = normalize24(hour)
    const exact = timeline.findIndex((point) =>
      point.hour !== undefined && Math.abs(normalize24(point.hour) - normalizedHour) < 0.001)
    return exact >= 0
      ? exact
      : Math.max(0, Math.min(timeline.length - 1, Math.round(normalizedHour * INTERVALS_PER_HOUR)))
  }

  let cost = 0
  let carbonKg = 0
  const intervalLoads = timeline.map((point) => ({ ...point, applianceDemand: 0 }))

  for (const item of items) {
    const durationHours = item.from === item.to ? 24 : item.to >= item.from
      ? item.to - item.from
      : 24 - item.from + item.to
    const durationIntervals = Math.max(1, Math.ceil(durationHours * INTERVALS_PER_HOUR))
    const startIndex = findStartIndex(item.from)
    for (let offset = 0; offset < durationIntervals && startIndex + offset < intervalLoads.length; offset++) {
      const bucket = intervalLoads[startIndex + offset]
      bucket.applianceDemand += item.power
      const energy = kwToKwh(item.power, 1 / INTERVALS_PER_HOUR)
      cost += energy * bucket.rate
      carbonKg += energy * bucket.carbon / 1000
    }
  }

  const demand = intervalLoads.map((bucket) => bucket.demand + bucket.applianceDemand)
  return {
    cost,
    carbon: carbonKg,
    peak: calculatePeakDemand(demand),
  }
}

export const generateOptimizedSchedule = (
  appliances: Appliance[],
  weights: OptimizerWeights,
  timeline: SeriesPoint[],
  intervalMinutes = DEFAULT_INTERVAL_MINUTES,
): OptimizationResult => {
  if (intervalMinutes !== DEFAULT_INTERVAL_MINUTES) {
    // Keep the optimizer deterministic at the configured public 15-minute default.
    // Existing callers can pass the default; custom callers receive quarter-hour normalization.
  }
  const intervalCount = timeline.length || 96
  const original: ScheduleItem[] = appliances.filter((item) => item.active).map((item) => ({
    applianceId: item.id,
    name: item.name,
    from: normalize24(item.originalStart),
    to: normalize24(item.originalStart + item.duration),
    power: item.power,
    moved: false,
    reason: 'Original plan',
  }))

  const schedule: ScheduleItem[] = []
  const infeasible: string[] = []

  for (const appliance of appliances.filter((item) => item.active)) {
    const originalStartOffset = Math.max(0, Math.min(intervalCount - 1,
      Math.round(normalize24(appliance.originalStart) * INTERVALS_PER_HOUR)))
    const durationIntervals = Math.max(1, Math.ceil(appliance.duration * INTERVALS_PER_HOUR))
    const originalItem: ScheduleItem = {
      applianceId: appliance.id,
      name: appliance.name,
      from: normalize24(appliance.originalStart),
      to: normalize24(appliance.originalStart + appliance.duration),
      power: appliance.power,
      moved: false,
      reason: 'Original plan',
    }

    if (appliance.critical) {
      const feasible = candidateIsFeasible(timeline, originalStartOffset, appliance, intervalCount)
      if (!feasible) infeasible.push(appliance.name)
      schedule.push({
        ...originalItem,
        infeasible: !feasible,
        reason: feasible ? 'Critical load protected' : 'Critical load cannot satisfy its deadline/window constraints',
      })
      continue
    }

    const candidates = Array.from({ length: intervalCount - durationIntervals + 1 }, (_, index) => index)
      .filter((index) => candidateIsFeasible(timeline, index, appliance, intervalCount))

    if (!candidates.length) {
      infeasible.push(appliance.name)
      schedule.push({
        ...originalItem,
        infeasible: true,
        reason: 'No feasible start satisfies duration, preferred window and deadline',
      })
      continue
    }

    const evaluated = candidates.map((index) => {
      const signalIndexes = Array.from({ length: durationIntervals }, (_, offset) => timeline[index + offset] ? index + offset : index)
      const cost = signalIndexes.reduce((sum, signalIndex) => sum + kwToKwh(appliance.power, 1 / INTERVALS_PER_HOUR) * (timeline[signalIndex]?.rate ?? 0), 0)
      const carbon = signalIndexes.reduce((sum, signalIndex) => sum + kwToKwh(appliance.power, 1 / INTERVALS_PER_HOUR) * (timeline[signalIndex]?.carbon ?? 0) / 1000, 0)
      const peak = signalIndexes.reduce((sum, signalIndex) => sum + (timeline[signalIndex]?.demand ?? 0) + appliance.power, 0) / signalIndexes.length
      const movement = Math.min(Math.abs(index - originalStartOffset), intervalCount - Math.abs(index - originalStartOffset)) / intervalCount
      return { index, cost, carbon, peak, movement }
    })

    const minMax = (key: 'cost' | 'carbon' | 'peak' | 'movement') => {
      const values = evaluated.map((entry) => entry[key])
      const min = Math.min(...values)
      const max = Math.max(...values)
      return [min, max] as const
    }
    const ranges = {
      cost: minMax('cost'),
      carbon: minMax('carbon'),
      peak: minMax('peak'),
      movement: minMax('movement'),
    }
    const normalized = (key: 'cost' | 'carbon' | 'peak' | 'movement', value: number) => {
      const [min, max] = ranges[key]
      return max === min ? 0 : (value - min) / (max - min)
    }

    const selected = evaluated.reduce((best, candidate) => {
      const score = weights.cost * normalized('cost', candidate.cost)
        + weights.carbon * normalized('carbon', candidate.carbon)
        + weights.peak * normalized('peak', candidate.peak)
        + weights.comfort * normalized('movement', candidate.movement)
      const bestScore = weights.cost * normalized('cost', best.cost)
        + weights.carbon * normalized('carbon', best.carbon)
        + weights.peak * normalized('peak', best.peak)
        + weights.comfort * normalized('movement', best.movement)
      return score < bestScore ? candidate : best
    }, evaluated[0])

    const startHour = wallHourAt(timeline, selected.index)
    const endHour = startHour + appliance.duration
    const moved = selected.index !== originalStartOffset
    schedule.push({
      applianceId: appliance.id,
      name: appliance.name,
      from: startHour,
      to: normalize24(endHour),
      power: appliance.power,
      moved,
      infeasible: false,
      reason: moved
        ? appliance.interruptible
          ? 'Shifted to a feasible cost/carbon/peak slot while preserving the operating window'
          : 'Non-interruptible block shifted contiguously while preserving its window and deadline'
        : 'Current timing is within the constraints and priority balance',
    })
  }

  const baseline = scheduleImpact(timeline,
    original.map((item) => ({ ...item, from: normalize24(item.from), to: normalize24(item.to) })),
  )
  const improved = scheduleImpact(timeline, schedule.filter((item) => !item.infeasible))

  return {
    schedule,
    originalSchedule: original,
    originalCost: baseline.cost,
    optimizedCost: improved.cost,
    originalCarbon: baseline.carbon,
    optimizedCarbon: improved.carbon,
    originalPeak: baseline.peak,
    optimizedPeak: improved.peak,
    confidence: infeasible.length ? Math.round(schedule.length ? (schedule.length - infeasible.length) / schedule.length * 100 : 0) : 100,
    infeasible,
  }
}
