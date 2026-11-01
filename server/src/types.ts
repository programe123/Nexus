export interface MeterReading {
  deviceId: string
  readingId: string
  timestamp: string
  powerKw: number
  voltageV: number
  currentA: number
  cumulativeEnergyKwh: number
  intervalEnergyKwh: number
  meterLevel: 'household'
}

export type AppliancePowerState = 'ON' | 'OFF'

export interface ApplianceState {
  id: string
  name: string
  state: AppliancePowerState
  simulated: true
  registeredAt: string
  updatedAt: string
}

export interface ApplianceCommandRecord {
  commandId: string
  applianceId: string
  command: AppliancePowerState
  requestedAt: string
  completedAt: string
  success: boolean
  reason?: string
  simulated: true
  source?: 'manual' | 'schedule'
}

export interface AcceptedSchedule {
  id: string
  applianceId: string
  name: string
  startAt: string
  endAt: string
  status: 'accepted' | 'cancelled' | 'completed' | 'expired'
  simulated: true
  createdAt: string
  cancelledAt?: string
  completedAt?: string
}

export interface ScheduleExecutionRecord {
  executionId: string
  scheduleId: string
  applianceId: string
  action: AppliancePowerState
  scheduledAt: string
  executedAt: string
  status: 'success' | 'failed' | 'skipped' | 'duplicate'
  reason?: string
  simulated: true
}
