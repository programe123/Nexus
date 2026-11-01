import { appendFile, mkdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import type { ApplianceCommandRecord, ApplianceState } from './types.js'

export class ApplianceStorage {
  private readonly states = new Map<string, ApplianceState>()
  private readonly manualOverrides = new Map<string, string>()

  constructor(
    private readonly stateFile: string,
    private readonly commandFile: string,
  ) {}

  async load(): Promise<void> {
    await mkdir(path.dirname(this.stateFile), { recursive: true })
    await mkdir(path.dirname(this.commandFile), { recursive: true })
    try {
      const text = await readFile(this.stateFile, 'utf8')
      for (const line of text.split(/\r?\n/)) {
        if (!line.trim()) continue
        try {
          const state = JSON.parse(line) as ApplianceState
          this.states.set(state.id, state)
        } catch {
          // Ignore corrupt historical state lines and keep the latest valid state.
        }
      }
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code
      if (code !== 'ENOENT') throw error
    }
    await this.loadManualOverrides()
  }

  private async loadManualOverrides(): Promise<void> {
    try {
      const text = await readFile(this.commandFile, 'utf8')
      for (const line of text.split(/\r?\n/)) {
        if (!line.trim()) continue
        try {
          const record = JSON.parse(line) as ApplianceCommandRecord
          if (record.success && record.source !== 'schedule') {
            this.manualOverrides.set(record.applianceId, record.completedAt)
          }
        } catch {
          // Ignore corrupt command lines.
        }
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
    }
  }

  list(): ApplianceState[] {
    return Array.from(this.states.values()).sort((a, b) => a.id.localeCompare(b.id))
  }

  get(id: string): ApplianceState | undefined {
    return this.states.get(id)
  }

  async saveState(state: ApplianceState): Promise<void> {
    await mkdir(path.dirname(this.stateFile), { recursive: true })
    await appendFile(this.stateFile, `${JSON.stringify(state)}\n`, { encoding: 'utf8', mode: 0o600 })
    this.states.set(state.id, state)
  }

  async appendCommand(record: ApplianceCommandRecord): Promise<void> {
    await mkdir(path.dirname(this.commandFile), { recursive: true })
    await appendFile(this.commandFile, `${JSON.stringify(record)}\n`, { encoding: 'utf8', mode: 0o600 })
  }

  getManualOverrideTimestamp(id: string): string | undefined {
    return this.manualOverrides.get(id)
  }

  recordManualOverride(id: string, timestamp: string): void {
    this.manualOverrides.set(id, timestamp)
  }
}
