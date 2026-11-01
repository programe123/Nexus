import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { MeterIngestion } from './ingestion.js'
import { MeterStorage } from './storage.js'

let tempDir: string | undefined
afterEach(async () => {
  if (tempDir) await rm(tempDir, { recursive: true, force: true })
  tempDir = undefined
})

const reading = (readingId: string, timestamp: string, powerKw = 2) => ({
  deviceId: 'nexus-home-in-01',
  readingId,
  timestamp,
  powerKw,
  voltageV: 230,
  currentA: powerKw * 1000 / 230,
  cumulativeEnergyKwh: 100,
  intervalEnergyKwh: 0.002,
  meterLevel: 'household',
})

describe('meter ingestion', () => {
  it('accepts readings and rejects duplicates', async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), 'nexus-meter-'))
    const storage = new MeterStorage(path.join(tempDir, 'readings.ndjson'))
    await storage.load()
    const ingestion = new MeterIngestion(storage)
    expect((await ingestion.ingest(reading('a', '2026-11-01T20:00:00.000Z'))).accepted).toBe(true)
    expect((await ingestion.ingest(reading('a', '2026-11-01T20:00:00.000Z'))).accepted).toBe(false)
    expect(ingestion.stats.accepted).toBe(1)
    expect(ingestion.stats.duplicate).toBe(1)
    expect(storage.latest()?.readingId).toBe('a')
  })

  it('accepts a late reading without replacing newer history', async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), 'nexus-meter-'))
    const storage = new MeterStorage(path.join(tempDir, 'readings.ndjson'))
    await storage.load()
    const ingestion = new MeterIngestion(storage)
    await ingestion.ingest(reading('new', '2026-11-01T20:00:05.000Z'))
    await ingestion.ingest(reading('late', '2026-11-01T20:00:03.000Z'))
    expect(ingestion.stats.outOfOrder).toBe(1)
    expect(storage.latest()?.readingId).toBe('new')
    expect(storage.list().map((item) => item.readingId)).toEqual(['new', 'late'])
  })
})
