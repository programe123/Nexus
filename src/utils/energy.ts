export interface TimeBucket {
  index: number
  startHour: number
  demandKw: number
  energyKwh: number
}

export interface ApplianceLoad {
  from: number
  to: number
  power: number
  rate?: number
  carbon?: number
}

export const kwToKwh = (powerKw: number, durationHours: number): number =>
  powerKw * durationHours

export const calculateEnergyKwh = kwToKwh

export function aggregateTimeBuckets(
  loads: ApplianceLoad[],
  intervalMinutes = 15,
  horizonHours = 24,
): TimeBucket[] {
  if (intervalMinutes <= 0 || horizonHours <= 0) return []
  const bucketCount = Math.ceil((horizonHours * 60) / intervalMinutes)
  const intervalHours = intervalMinutes / 60
  const buckets = Array.from({ length: bucketCount }, (_, index) => ({
    index,
    startHour: index * intervalHours,
    demandKw: 0,
    energyKwh: 0,
  }))

  for (const load of loads) {
    const startBucket = Math.max(0, Math.floor(load.from / intervalHours))
    const endBucket = Math.min(bucketCount, Math.ceil(load.to / intervalHours))
    for (let index = startBucket; index < endBucket; index++) {
      const bucketStart = index * intervalHours
      const bucketEnd = bucketStart + intervalHours
      const overlap = Math.max(0, Math.min(load.to, bucketEnd) - Math.max(load.from, bucketStart))
      if (overlap > 0) {
        buckets[index].demandKw += load.power
        buckets[index].energyKwh += kwToKwh(load.power, overlap)
      }
    }
  }
  return buckets
}

export const calculateSimultaneousDemand = aggregateTimeBuckets

export function calculatePeakDemand(buckets: TimeBucket[] | number[]): number {
  if (!buckets.length) return 0
  return Math.max(...buckets.map((bucket) =>
    typeof bucket === 'number' ? bucket : bucket.demandKw,
  ))
}

export function calculateCost(loads: ApplianceLoad[], fallbackRate = 0): number {
  return loads.reduce((total, load) => {
    const rate = load.rate ?? fallbackRate
    return total + kwToKwh(load.power, Math.max(0, load.to - load.from)) * rate
  }, 0)
}

export function calculateCarbonEmissions(loads: ApplianceLoad[], fallbackCarbon = 0): number {
  const kg = loads.reduce((total, load) => {
    const carbon = load.carbon ?? fallbackCarbon
    return total + kwToKwh(load.power, Math.max(0, load.to - load.from)) * carbon / 1000
  }, 0)
  return kg
}

export function calculateScheduleImpact(loads: ApplianceLoad[], baseDemand = 0) {
  const intervalMinutes = loads.length ? 15 : 15
  void intervalMinutes
  const buckets = aggregateTimeBuckets(loads)
  const cost = calculateCost(loads)
  const carbon = calculateCarbonEmissions(loads)
  const demand = buckets.map((bucket) => baseDemand + bucket.demandKw)
  return {
    cost,
    carbon,
    peak: calculatePeakDemand(demand),
    buckets,
  }
}
