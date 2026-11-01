import { ScheduleStorage } from './schedule-storage.js'
import { SimulatedActuator } from './actuator.js'
import type { AcceptedSchedule, ScheduleExecutionRecord } from './types.js'

export class ScheduleExecutor {
  private timer: NodeJS.Timeout | undefined
  private running = false

  constructor(
    private readonly storage: ScheduleStorage,
    private readonly actuator: SimulatedActuator,
  ) {}

  start(intervalMs = 15000): void {
    void this.runRecovery()
    this.timer = setInterval(() => void this.process(), intervalMs)
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer)
  }

  private async runRecovery(): Promise<void> {
    await this.process(true)
  }

  async process(recovery = false): Promise<void> {
    if (this.running) return
    this.running = true
    try {
      const now = new Date()
      const schedules = this.storage.list()
      for (const schedule of schedules) {
        if (schedule.status !== 'accepted') continue
        const start = new Date(schedule.startAt)
        const end = new Date(schedule.endAt)

        await this.executeTransition(schedule, 'ON', start, now, recovery)
        if (now >= end) {
          await this.executeTransition(schedule, 'OFF', end, now, recovery)
          if (!this.storage.get(schedule.id)?.status?.startsWith('cancelled')) {
            const completed: AcceptedSchedule = {
              ...schedule,
              status: 'completed',
              completedAt: new Date().toISOString(),
            }
            await this.storage.save(completed)
          }
        }
      }
    } finally {
      this.running = false
    }
  }

  private async executeTransition(
    schedule: AcceptedSchedule,
    action: 'ON' | 'OFF',
    scheduledAt: Date,
    now: Date,
    recovery: boolean,
  ): Promise<void> {
    if (now < scheduledAt) return

    const executionId = `${schedule.id}:${action}`
    if (this.storage.hasExecution(executionId)) return

    let status: ScheduleExecutionRecord['status'] = 'success'
    let reason: string | undefined

    if (this.storage.get(schedule.id)?.status !== 'accepted') {
      status = 'skipped'
      reason = 'Schedule is no longer accepted'
    } else {
      const conflict = this.storage.list().find((candidate) =>
        candidate.id !== schedule.id &&
        candidate.status === 'accepted' &&
        candidate.applianceId === schedule.applianceId &&
        new Date(candidate.startAt) < new Date(schedule.endAt) &&
        new Date(candidate.endAt) > new Date(schedule.startAt),
      )
      if (conflict) {
        status = 'skipped'
        reason = `Conflicts with schedule ${conflict.id}`
      }
    }

    const manualAt = this.actuator.getManualOverrideTimestamp(schedule.applianceId)
    if (status === 'success' && manualAt && Date.parse(manualAt) >= Date.parse(schedule.createdAt)) {
      status = 'skipped'
      reason = 'Manual appliance command is authoritative for this schedule'
    }

    if (status === 'success') {
      const result = await this.actuator.command(schedule.applianceId, action, 'schedule')
      if (!result.success) {
        status = 'failed'
        reason = result.reason
      }
    }

    const record: ScheduleExecutionRecord = {
      executionId,
      scheduleId: schedule.id,
      applianceId: schedule.applianceId,
      action,
      scheduledAt: scheduledAt.toISOString(),
      executedAt: now.toISOString(),
      status,
      reason: reason || (recovery ? 'Recovered overdue schedule action' : undefined),
      simulated: true,
    }
    await this.storage.appendExecution(record)
    this.storage.markExecution(executionId)
  }
}
