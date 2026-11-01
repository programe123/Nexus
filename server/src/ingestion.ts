import type { MeterReading } from './types.js'
import { MeterStorage } from './storage.js'
import { validateReading } from './validation.js'

export interface IngestionStats {
  accepted: number
  rejected: number
  duplicate: number
  outOfOrder: number
  received: number
}

export class MeterIngestion {
  readonly stats: IngestionStats = { accepted: 0, rejected: 0, duplicate: 0, outOfOrder: 0, received: 0 }
  private latestTimestamp = 0

  constructor(private readonly storage: MeterStorage) {
    const latest = storage.latest()
    this.latestTimestamp = latest ? Date.parse(latest.timestamp) : 0
  }

  async ingest(value: unknown): Promise<{ accepted: boolean; reason?: string; reading?: MeterReading }> {
    this.stats.received++
    const result = validateReading(value)
    if (!result.ok) {
      this.stats.rejected++
      return { accepted: false, reason: result.reason }
    }

    if (this.storage.has(result.reading.readingId)) {
      this.stats.rejected++
      this.stats.duplicate++
      return { accepted: false, reason: 'duplicate readingId' }
    }

    const timestamp = Date.parse(result.reading.timestamp)
    if (this.latestTimestamp && timestamp < this.latestTimestamp) this.stats.outOfOrder++
    else this.latestTimestamp = timestamp

    await this.storage.append(result.reading)
    this.stats.accepted++
    return { accepted: true, reading: result.reading }
  }
}
