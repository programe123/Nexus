import { describe, expect, it } from 'vitest'
import type { Appliance, OptimizerWeights, SeriesPoint } from '../types'
import { generateOptimizedSchedule } from './optimizer'

const weights: OptimizerWeights = { cost: 1, carbon: 1, peak: 1, comfort: 0.2 }

const timeline = (start = 0): SeriesPoint[] =>
  Array.from({ length: 96 }, (_, index) => ({
    time: `${String(Math.floor((start + index / 4) % 24)).padStart(2, '0')}:${String((index % 4) * 15).padStart(2, '0')}`,
    hour: (start + index / 4) % 24,
    demand: 3,
    rate: index < 32 ? 5 : index < 64 ? 10 : 8,
    carbon: index < 32 ? 400 : index < 64 ? 600 : 500,
    temperature: 30,
  }))

const appliance = (patch: Partial<Appliance> = {}): Appliance => ({
  id: 'test-load',
  name: 'Test Load',
  category: 'Flexible',
  icon: 'monitor',
  power: 2,
  duration: 1,
  deadline: 23,
  priority: 'Medium',
  critical: false,
  interruptible: true,
  preferredWindow: [0, 23],
  originalStart: 20,
  active: true,
  ...patch,
})

describe('optimizer', () => {
  it('sums overlapping appliance loads for peak demand', () => {
    const result = generateOptimizedSchedule([
      appliance({ id: 'a', name: 'A', originalStart: 1, duration: 2 }),
      appliance({ id: 'b', name: 'B', originalStart: 1, duration: 2 }),
    ], weights, timeline())
    expect(result.originalPeak).toBeGreaterThanOrEqual(7)
  })

  it('rejects deadline violations', () => {
    const result = generateOptimizedSchedule([
      appliance({ originalStart: 21, duration: 4, deadline: 22, preferredWindow: [21, 21.5] }),
    ], weights, timeline())
    const item = result.schedule[0]
    expect(item.infeasible || result.infeasible.includes('Test Load')).toBe(true)
  })

  it('returns an infeasible schedule when no candidate fits', () => {
    const result = generateOptimizedSchedule([
      appliance({ duration: 4, preferredWindow: [10, 11], deadline: 12 }),
    ], weights, timeline())
    expect(result.infeasible).toContain('Test Load')
  })

  it('handles overnight preferred windows', () => {
    const result = generateOptimizedSchedule([
      appliance({ duration: 2, originalStart: 23, preferredWindow: [23, 6], deadline: 7 }),
    ], weights, timeline())
    expect(result.infeasible).not.toContain('Test Load')
  })

  it('preserves contiguous duration for non-interruptible loads', () => {
    const result = generateOptimizedSchedule([
      appliance({ duration: 3, interruptible: false, preferredWindow: [0, 23], deadline: 23 }),
    ], weights, timeline())
    const item = result.schedule[0]
    if (!item.infeasible) {
      const duration = item.from === item.to ? 24 : item.to > item.from ? item.to - item.from : 24 - item.from + item.to
      expect(duration).toBeCloseTo(3)
    }
  })

  it('returns costs, carbon and peaks as explicit numeric comparisons', () => {
    const result = generateOptimizedSchedule([appliance()], weights, timeline())
    expect(typeof result.originalCost).toBe('number')
    expect(typeof result.optimizedCost).toBe('number')
    expect(typeof result.originalCarbon).toBe('number')
    expect(typeof result.optimizedPeak).toBe('number')
  })
})
