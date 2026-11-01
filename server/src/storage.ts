import { mkdir, readFile, appendFile } from 'node:fs/promises'
import path from 'node:path'
import type { MeterReading } from './types.js'

export class MeterStorage {
  private readonly recent = new Map<string, MeterReading>()
  private readonly bufferLimit: number

  constructor(private readonly filePath: string, bufferLimit = 1000) {
    this.bufferLimit = bufferLimit
  }

  async load(): Promise<void> {
    await mkdir(path.dirname(this.filePath), { recursive: true })
    try {
      const text = await readFile(this.filePath, 'utf8')
      for (const line of text.split(/\r?\n/)) {
        if (!line.trim()) continue
        try {
          const reading = JSON.parse(line) as MeterReading
          this.recent.set(reading.readingId, reading)
        } catch {
          // Corrupt historical lines are ignored; subsequent writes remain append-only.
        }
      }
      this.trimBuffer()
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code
      if (code !== 'ENOENT') throw error
    }
  }

  has(readingId: string): boolean {
    return this.recent.has(readingId)
  }

  async append(reading: MeterReading): Promise<void> {
    await mkdir(path.dirname(this.filePath), { recursive: true })
    await appendFile(this.filePath, `${JSON.stringify(reading)}\n`, { encoding: 'utf8', mode: 0o600 })
    this.recent.set(reading.readingId, reading)
    this.trimBuffer()
  }

  list(limit = 100): MeterReading[] {
    return Array.from(this.recent.values())
      .sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp))
      .slice(0, Math.max(0, limit))
  }

  latest(): MeterReading | undefined {
    return this.list(1)[0]
  }

  private trimBuffer() {
    const sorted = Array.from(this.recent.values())
      .sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp))
    while (sorted.length > this.bufferLimit) sorted.shift()
    this.recent.clear()
    for (const reading of sorted) this.recent.set(reading.readingId, reading)
  }
}
