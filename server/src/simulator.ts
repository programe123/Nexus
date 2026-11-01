import mqtt from 'mqtt'

export interface MeterSimulatorOptions {
  brokerUrl: string
  deviceId: string
  intervalMs?: number
}

export class MeterSimulator {
  private timer: NodeJS.Timeout | undefined
  private sequence = 0
  private cumulativeEnergy = 1842.35
  private lastReading: Record<string, unknown> | undefined
  private client: ReturnType<typeof mqtt.connect>

  constructor(private readonly options: MeterSimulatorOptions) {
    this.client = mqtt.connect(options.brokerUrl)
  }

  start() {
    this.client.on('connect', () => {
      this.publish()
      this.timer = setInterval(() => this.publish(), this.options.intervalMs ?? 5000)
    })
  }

  stop() {
    if (this.timer) clearInterval(this.timer)
    this.client.end(true)
  }

  private currentLoad(date: Date) {
    const hour = date.getHours() + date.getMinutes() / 60
    let base = 0.28
    if ((hour >= 6 && hour < 9) || (hour >= 18 && hour < 23)) base = 2.3
    else if (hour >= 0 && hour < 6) base = 0.18
    else if (hour >= 12 && hour < 18) base = 1.05
    const noise = Math.sin(Date.now() / 90000 + this.sequence / 7) * 0.12
    const appliancePulse = this.sequence % 13 === 0 ? 0.9 : this.sequence % 17 === 0 ? -0.25 : 0
    return Math.max(0.08, Number((base + noise + appliancePulse).toFixed(3)))
  }

  private publish() {
    const date = new Date()
    const intervalHours = (this.options.intervalMs ?? 5000) / 3600000
    const powerKw = this.currentLoad(date)
    const intervalEnergyKwh = Number((powerKw * intervalHours).toFixed(6))
    this.cumulativeEnergy += intervalEnergyKwh
    const voltageV = Number((238 + Math.sin(this.sequence / 6) * 4).toFixed(1))
    this.sequence++

    const reading = {
      deviceId: this.options.deviceId,
      readingId: `${this.options.deviceId}-${date.toISOString()}-${this.sequence}`,
      timestamp: date.toISOString(),
      powerKw,
      voltageV,
      currentA: Number((powerKw * 1000 / voltageV).toFixed(3)),
      cumulativeEnergyKwh: Number(this.cumulativeEnergy.toFixed(6)),
      intervalEnergyKwh,
      meterLevel: 'household',
    }

    if (this.sequence % 23 === 0) {
      this.client.publish(`nexus/meter/${this.options.deviceId}`, JSON.stringify(reading))
      this.client.publish(`nexus/meter/${this.options.deviceId}`, JSON.stringify(reading))
    } else if (this.sequence % 29 === 0) {
      this.client.publish(`nexus/meter/${this.options.deviceId}`, JSON.stringify({
        ...reading,
        powerKw: 250,
      }))
    } else {
      this.client.publish(`nexus/meter/${this.options.deviceId}`, JSON.stringify(reading))
    }
    this.lastReading = reading
  }
}
