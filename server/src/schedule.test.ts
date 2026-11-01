import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { ApplianceStorage } from './appliance-storage.js'
import { SimulatedActuator } from './actuator.js'
import { ScheduleStorage } from './schedule-storage.js'
import { ScheduleExecutor } from './schedule-executor.js'
import type { AcceptedSchedule } from './types.js'

let tempDir: string | undefined
afterEach(async () => {
  if (tempDir) await rm(tempDir, { recursive: true, force: true })
  tempDir = undefined
})

const schedule = (id: string, startAt: string, endAt: string): AcceptedSchedule => ({
  id,
  applianceId: 'heater',
  name: 'Water Heater',
  startAt,
  endAt,
  status: 'accepted',
  simulated: true,
  createdAt: new Date().toISOString(),
})

describe('accepted schedule execution', () => {
  it('detects conflicting accepted schedules for the same appliance', async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), 'nexus-schedule-'))
    const storage = new ScheduleStorage(
      path.join(tempDir, 'schedules.ndjson'),
      path.join(tempDir, 'executions.ndjson'),
    )
    await storage.load()
    await storage.save(schedule('first', '2026-11-01T18:00:00.000Z', '2026-11-01T19:00:00.000Z'))

    expect(storage.conflicts(
      'heater',
      '2026-11-01T18:30:00.000Z',
      '2026-11-01T18:45:00.000Z',
    ).map((item) => item.id)).toEqual(['first'])
  })

  it('persists schedules and reloads them after restart', async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), 'nexus-schedule-'))
    const scheduleFile = path.join(tempDir, 'schedules.ndjson')
    const storage = new ScheduleStorage(scheduleFile, path.join(tempDir, 'executions.ndjson'))
    await storage.load()
    await storage.save(schedule('schedule-a', '2026-11-01T18:00:00.000Z', '2026-11-01T19:00:00.000Z'))

    const reloaded = new ScheduleStorage(scheduleFile, path.join(tempDir, 'executions.ndjson'))
    await reloaded.load()
    expect(reloaded.get('schedule-a')?.applianceId).toBe('heater')
  })

  it('executes overdue ON actions once and records execution status', async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), 'nexus-schedule-'))
    const scheduleStorage = new ScheduleStorage(
      path.join(tempDir, 'schedules.ndjson'),
      path.join(tempDir, 'executions.ndjson'),
    )
    await scheduleStorage.load()
    const applianceStorage = new ApplianceStorage(
      path.join(tempDir, 'appliances.ndjson'),
      path.join(tempDir, 'commands.ndjson'),
    )
    await applianceStorage.load()
    const actuator = new SimulatedActuator(applianceStorage)
    await actuator.register('heater', 'Water Heater')

    const now = Date.now()
    const overdue = schedule('overdue', new Date(now - 120_000).toISOString(), new Date(now + 120_000).toISOString())
    await scheduleStorage.save(overdue)

    const executor = new ScheduleExecutor(scheduleStorage, actuator)
    await executor.process(true)
    await executor.process(true)

    expect(applianceStorage.get('heater')?.state).toBe('ON')
    const executions = scheduleStorage.executionsFor('overdue')
    expect(executions.filter((record) => record.action === 'ON')).toHaveLength(1)
    expect(executions[0].status).toBe('success')
  })

  it('does not execute cancelled schedules', async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), 'nexus-schedule-'))
    const scheduleStorage = new ScheduleStorage(
      path.join(tempDir, 'schedules.ndjson'),
      path.join(tempDir, 'executions.ndjson'),
    )
    await scheduleStorage.load()
    const applianceStorage = new ApplianceStorage(
      path.join(tempDir, 'appliances.ndjson'),
      path.join(tempDir, 'commands.ndjson'),
    )
    await applianceStorage.load()
    const actuator = new SimulatedActuator(applianceStorage)
    await actuator.register('heater', 'Water Heater')

    const now = Date.now()
    const cancelled = {
      ...schedule('cancelled', new Date(now - 60_000).toISOString(), new Date(now + 60_000).toISOString()),
      status: 'cancelled' as const,
      cancelledAt: new Date().toISOString(),
    }
    await scheduleStorage.save(cancelled)

    await new ScheduleExecutor(scheduleStorage, actuator).process(true)
    expect(applianceStorage.get('heater')?.state).toBe('OFF')
    expect(scheduleStorage.executionsFor('cancelled')).toHaveLength(0)
  })

  it('respects manual appliance commands over scheduled transitions', async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), 'nexus-schedule-'))
    const scheduleStorage = new ScheduleStorage(
      path.join(tempDir, 'schedules.ndjson'),
      path.join(tempDir, 'executions.ndjson'),
    )
    await scheduleStorage.load()
    const applianceStorage = new ApplianceStorage(
      path.join(tempDir, 'appliances.ndjson'),
      path.join(tempDir, 'commands.ndjson'),
    )
    await applianceStorage.load()
    const actuator = new SimulatedActuator(applianceStorage)
    await actuator.register('heater', 'Water Heater')

    const now = Date.now()
    await scheduleStorage.save(schedule('manual', new Date(now - 60_000).toISOString(), new Date(now + 60_000).toISOString()))
    await actuator.command('heater', 'ON', 'manual')
    await new ScheduleExecutor(scheduleStorage, actuator).process(true)

    const skipped = scheduleStorage.executionsFor('manual').find((record) => record.action === 'ON')
    expect(skipped?.status).toBe('skipped')
  })

  it('reloads execution IDs so restart does not duplicate commands', async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), 'nexus-schedule-'))
    const scheduleFile = path.join(tempDir, 'schedules.ndjson')
    const executionFile = path.join(tempDir, 'executions.ndjson')
    const scheduleStorage = new ScheduleStorage(scheduleFile, executionFile)
    await scheduleStorage.load()
    const applianceStorage = new ApplianceStorage(
      path.join(tempDir, 'appliances.ndjson'),
      path.join(tempDir, 'commands.ndjson'),
    )
    await applianceStorage.load()
    const actuator = new SimulatedActuator(applianceStorage)
    await actuator.register('heater', 'Water Heater')

    const now = Date.now()
    await scheduleStorage.save(schedule('restart', new Date(now - 120_000).toISOString(), new Date(now + 120_000).toISOString()))
    await new ScheduleExecutor(scheduleStorage, actuator).process(true)

    const reloaded = new ScheduleStorage(scheduleFile, executionFile)
    await reloaded.load()
    await new ScheduleExecutor(reloaded, actuator).process(true)
    expect(reloaded.executionsFor('restart').filter((record) => record.action === 'ON')).toHaveLength(1)
  })
})
