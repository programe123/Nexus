import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { SimulatedActuator } from './actuator.js'
import { ApplianceStorage } from './appliance-storage.js'

let tempDir: string | undefined
afterEach(async () => {
  if (tempDir) await rm(tempDir, { recursive: true, force: true })
  tempDir = undefined
})

describe('simulated appliance control', () => {
  it('registers and switches a simulated appliance ON and OFF', async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), 'nexus-appliance-'))
    const storage = new ApplianceStorage(
      path.join(tempDir, 'appliances.ndjson'),
      path.join(tempDir, 'appliance-commands.ndjson'),
    )
    await storage.load()
    const actuator = new SimulatedActuator(storage)

    const registered = await actuator.register('ev-charger', 'EV Charger')
    expect(registered.state).toBe('OFF')
    expect(registered.simulated).toBe(true)

    const on = await actuator.command('ev-charger', 'ON')
    expect(on.success).toBe(true)
    expect(on.state?.state).toBe('ON')
    expect(storage.get('ev-charger')?.state).toBe('ON')

    const off = await actuator.command('ev-charger', 'OFF')
    expect(off.success).toBe(true)
    expect(storage.get('ev-charger')?.state).toBe('OFF')
  })

  it('records failure for an unregistered appliance', async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), 'nexus-appliance-'))
    const storage = new ApplianceStorage(
      path.join(tempDir, 'appliances.ndjson'),
      path.join(tempDir, 'appliance-commands.ndjson'),
    )
    await storage.load()
    const actuator = new SimulatedActuator(storage)

    const result = await actuator.command('missing', 'ON')
    expect(result.success).toBe(false)
    expect(result.reason).toBe('Appliance is not registered')
    expect(result.requestedAt).toBeTruthy()
    expect(result.completedAt).toBeTruthy()
  })

  it('reloads persisted appliance state', async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), 'nexus-appliance-'))
    const file = path.join(tempDir, 'appliances.ndjson')
    const storage = new ApplianceStorage(file, path.join(tempDir, 'commands.ndjson'))
    await storage.load()
    const actuator = new SimulatedActuator(storage)
    await actuator.register('heater', 'Water Heater')
    await actuator.command('heater', 'ON')

    const reloaded = new ApplianceStorage(file, path.join(tempDir, 'commands.ndjson'))
    await reloaded.load()
    expect(reloaded.get('heater')?.state).toBe('ON')
  })
})
