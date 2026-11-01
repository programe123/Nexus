import type { ApplianceCommandRecord, AppliancePowerState, ApplianceState } from './types.js'
import { ApplianceStorage } from './appliance-storage.js'

let commandSequence = 0

export class SimulatedActuator {
  constructor(private readonly storage: ApplianceStorage) {}

  async register(id: string, name?: string): Promise<ApplianceState> {
    const existing = this.storage.get(id)
    if (existing) return existing

    const now = new Date().toISOString()
    const state: ApplianceState = {
      id,
      name: name?.trim() || id,
      state: 'OFF',
      simulated: true,
      registeredAt: now,
      updatedAt: now,
    }
    await this.storage.saveState(state)
    return state
  }

  async command(
    id: string,
    command: AppliancePowerState,
    source: 'manual' | 'schedule' = 'manual',
  ): Promise<ApplianceCommandRecord & { state?: ApplianceState }> {
    const requestedAt = new Date().toISOString()
    commandSequence++
    const appliance = this.storage.get(id)
    let success = true
    let reason: string | undefined

    if (!appliance) {
      success = false
      reason = 'Appliance is not registered'
    } else if (command !== 'ON' && command !== 'OFF') {
      success = false
      reason = 'Command must be ON or OFF'
    }

    let state: ApplianceState | undefined
    if (success && appliance) {
      state = { ...appliance, state: command, simulated: true, updatedAt: new Date().toISOString() }
      await this.storage.saveState(state)
      if (source === 'manual') this.storage.recordManualOverride(id, new Date().toISOString())
    }

    const record: ApplianceCommandRecord & { state?: ApplianceState } = {
      commandId: `sim-command-${Date.now()}-${commandSequence}`,
      applianceId: id,
      command,
      requestedAt,
      completedAt: new Date().toISOString(),
      success,
      reason,
      simulated: true,
      state,
      source,
    }
    await this.storage.appendCommand(record)
    return record
  }

  getManualOverrideTimestamp(id: string): string | undefined {
    return this.storage.getManualOverrideTimestamp(id)
  }
}
