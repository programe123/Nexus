import { describe, expect, it } from 'vitest'
import { validateReading } from './validation.js'

const valid = () => ({
  deviceId: 'nexus-home-in-01',
  readingId: 'reading-1',
  timestamp: '2026-11-01T20:00:00.000Z',
  powerKw: 2.4,
  voltageV: 230,
  currentA: 10.43,
  cumulativeEnergyKwh: 100.5,
  intervalEnergyKwh: 0.003,
  meterLevel: 'household',
})

describe('meter validation', () => {
  it('accepts a valid household reading', () => {
    expect(validateReading(valid()).ok).toBe(true)
  })

  it('rejects malformed timestamps', () => {
    expect(validateReading({ ...valid(), timestamp: 'not-a-date' }).ok).toBe(false)
  })

  it('rejects physically impossible power and voltage', () => {
    expect(validateReading({ ...valid(), powerKw: 250 }).ok).toBe(false)
    expect(validateReading({ ...valid(), voltageV: 300 }).ok).toBe(false)
  })

  it('rejects negative energy and appliance-level claims', () => {
    expect(validateReading({ ...valid(), intervalEnergyKwh: -0.1 }).ok).toBe(false)
    expect(validateReading({ ...valid(), meterLevel: 'appliance' }).ok).toBe(false)
  })
})
