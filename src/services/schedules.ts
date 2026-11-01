import type { BackendSchedule, ScheduleExecution } from '../types'

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: { Accept: 'application/json', 'Content-Type': 'application/json', ...init?.headers },
  })
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { error?: string } | null
    throw new Error(body?.error || `Schedule request failed (${response.status})`)
  }
  return response.json() as Promise<T>
}

export const fetchBackendSchedules = () =>
  requestJson<{ provenance: 'SIMULATED'; schedules: BackendSchedule[] }>('/api/schedules')

export const fetchScheduleExecutions = (scheduleId: string) =>
  requestJson<{ provenance: 'SIMULATED'; scheduleId: string; executions: ScheduleExecution[] }>(
    `/api/schedules/${encodeURIComponent(scheduleId)}/executions`,
  )

export const registerSimulatedAppliance = (id: string, name: string) =>
  requestJson<{ provenance: 'SIMULATED'; appliance: unknown }>(
    '/api/appliances/register',
    { method: 'POST', body: JSON.stringify({ id, name }) },
  )

export const createBackendSchedule = (schedule: {
  applianceId: string
  name: string
  startAt: string
  endAt: string
}) =>
  requestJson<{ provenance: 'SIMULATED'; schedules: BackendSchedule[] }>(
    '/api/schedules',
    { method: 'POST', body: JSON.stringify(schedule) },
  )

export const cancelBackendSchedule = (scheduleId: string) =>
  requestJson<{ provenance: 'SIMULATED'; schedule: BackendSchedule }>(
    `/api/schedules/${encodeURIComponent(scheduleId)}/cancel`,
    { method: 'POST' },
  )
