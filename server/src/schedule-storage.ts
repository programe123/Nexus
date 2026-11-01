import { appendFile, mkdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import type { AcceptedSchedule, ScheduleExecutionRecord } from './types.js'

export class ScheduleStorage {
  private readonly schedules = new Map<string, AcceptedSchedule>()
  private readonly executionIds = new Set<string>()
  private readonly executions = new Map<string, ScheduleExecutionRecord>()

  constructor(
    private readonly scheduleFile: string,
    private readonly executionFile: string,
  ) {}

  async load(): Promise<void> {
    await mkdir(path.dirname(this.scheduleFile), { recursive: true })
    await mkdir(path.dirname(this.executionFile), { recursive: true })
    await this.loadScheduleFile()
    await this.loadExecutionFile()
  }

  private async loadScheduleFile(): Promise<void> {
    try {
      const text = await readFile(this.scheduleFile, 'utf8')
      for (const line of text.split(/\r?\n/)) {
        if (!line.trim()) continue
        try {
          const schedule = JSON.parse(line) as AcceptedSchedule
          this.schedules.set(schedule.id, schedule)
        } catch {
          // Ignore corrupt historical lines; latest valid schedule state remains usable.
        }
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
    }
  }

  private async loadExecutionFile(): Promise<void> {
    try {
      const text = await readFile(this.executionFile, 'utf8')
      for (const line of text.split(/\r?\n/)) {
        if (!line.trim()) continue
        try {
          const record = JSON.parse(line) as ScheduleExecutionRecord
          if (record.executionId) this.executionIds.add(record.executionId)
          if (record.executionId) this.executions.set(record.executionId, record)
        } catch {
          // Ignore corrupt execution lines.
        }
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
    }
  }

  list(): AcceptedSchedule[] {
    return Array.from(this.schedules.values()).sort((a, b) => a.startAt.localeCompare(b.startAt))
  }

  conflicts(applianceId: string, startAt: string, endAt: string): AcceptedSchedule[] {
    const start = Date.parse(startAt)
    const end = Date.parse(endAt)
    return this.list().filter((schedule) =>
      schedule.status === 'accepted' &&
      schedule.applianceId === applianceId &&
      start < Date.parse(schedule.endAt) &&
      end > Date.parse(schedule.startAt),
    )
  }

  get(id: string): AcceptedSchedule | undefined {
    return this.schedules.get(id)
  }

  async save(schedule: AcceptedSchedule): Promise<void> {
    await mkdir(path.dirname(this.scheduleFile), { recursive: true })
    await appendFile(this.scheduleFile, `${JSON.stringify(schedule)}\n`, { encoding: 'utf8', mode: 0o600 })
    this.schedules.set(schedule.id, schedule)
  }

  async appendExecution(record: ScheduleExecutionRecord): Promise<void> {
    await mkdir(path.dirname(this.executionFile), { recursive: true })
    await appendFile(this.executionFile, `${JSON.stringify(record)}\n`, { encoding: 'utf8', mode: 0o600 })
    this.executionIds.add(record.executionId)
    this.executions.set(record.executionId, record)
  }

  hasExecution(executionId: string): boolean {
    return this.executionIds.has(executionId)
  }

  markExecution(executionId: string): void {
    this.executionIds.add(executionId)
  }

  executionsFor(scheduleId: string): ScheduleExecutionRecord[] {
    return Array.from(this.executions.values())
      .filter((record) => record.scheduleId === scheduleId)
      .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt))
  }
}
