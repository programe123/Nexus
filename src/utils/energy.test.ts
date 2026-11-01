import { describe, expect, it } from 'vitest'
import {
  aggregateTimeBuckets,
  calculateCarbonEmissions,
  calculateCost,
  calculatePeakDemand,
  calculateSimultaneousDemand,
  kwToKwh,
} from './energy'

describe('energy calculations', () => {
  it('converts kW and hours to kWh', () => {
    expect(kwToKwh(2, 0.25)).toBe(0.5)
    expect(kwToKwh(7.4, 3)).toBeCloseTo(22.2)
  })

  it('aggregates simultaneous loads by overlapping 15-minute buckets', () => {
    const buckets = aggregateTimeBuckets([
      { from: 0, to: 1, power: 2 },
      { from: 0.5, to: 1.5, power: 1.5 },
    ], 15, 2)

    expect(buckets[0].demandKw).toBe(2)
    expect(buckets[2].demandKw).toBe(3.5)
    expect(buckets[5].demandKw).toBe(1.5)
  })

  it('calculates peak and coincident demand', () => {
    const buckets = calculateSimultaneousDemand([
      { from: 10, to: 12, power: 1.2 },
      { from: 11, to: 13, power: 0.8 },
    ], 15, 24)
    expect(calculatePeakDemand(buckets)).toBeCloseTo(2)
  })

  it('calculates cost and carbon at point rates and intensities', () => {
    const loads = [{ from: 0, to: 1, power: 3, rate: 5, carbon: 500 }]
    expect(calculateCost(loads)).toBe(15)
    expect(calculateCarbonEmissions(loads)).toBeCloseTo(1.5)
  })

  it('handles overnight and partial buckets without leaking across the horizon', () => {
    const buckets = aggregateTimeBuckets([
      { from: 23.75, to: 24, power: 4 },
    ], 15, 24)
    expect(buckets).toHaveLength(96)
    expect(buckets[95].energyKwh).toBe(1)
  })
})
