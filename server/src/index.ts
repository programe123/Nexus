import 'dotenv/config'
import net from 'node:net'
import path from 'node:path'
import express from 'express'
import { Aedes } from 'aedes'
import mqtt from 'mqtt'
import { MeterIngestion } from './ingestion.js'
import { MeterStorage } from './storage.js'
import { MeterSimulator } from './simulator.js'
import { ApplianceStorage } from './appliance-storage.js'
import { SimulatedActuator } from './actuator.js'
import { ScheduleStorage } from './schedule-storage.js'
import { ScheduleExecutor } from './schedule-executor.js'
import type { AcceptedSchedule } from './types.js'
import { randomUUID } from 'node:crypto'

const httpPort = Number(process.env.HTTP_PORT ?? 3001)
const mqttPort = Number(process.env.MQTT_PORT ?? 1883)
const mqttHost = process.env.MQTT_HOST ?? '127.0.0.1'
const deviceId = process.env.METER_DEVICE_ID ?? 'nexus-home-in-01'
const intervalMs = Number(process.env.METER_PUBLISH_INTERVAL_MS ?? 5000)
const dataFile = path.resolve(process.env.METER_DATA_FILE ?? path.join(process.cwd(), 'data', 'meter-readings.ndjson'))
const applianceStateFile = path.resolve(process.env.APPLIANCE_STATE_DATA_FILE ?? path.join(process.cwd(), 'data', 'appliances.ndjson'))
const applianceCommandFile = path.resolve(process.env.APPLIANCE_COMMAND_DATA_FILE ?? path.join(process.cwd(), 'data', 'appliance-commands.ndjson'))
const scheduleFile = path.resolve(process.env.SCHEDULE_DATA_FILE ?? path.join(process.cwd(), 'data', 'schedules.ndjson'))
const scheduleExecutionFile = path.resolve(process.env.SCHEDULE_EXECUTION_DATA_FILE ?? path.join(process.cwd(), 'data', 'schedule-executions.ndjson'))

const storage = new MeterStorage(dataFile)
await storage.load()
const ingestion = new MeterIngestion(storage)
const applianceStorage = new ApplianceStorage(applianceStateFile, applianceCommandFile)
await applianceStorage.load()
const actuator = new SimulatedActuator(applianceStorage)
const scheduleStorage = new ScheduleStorage(scheduleFile, scheduleExecutionFile)
await scheduleStorage.load()
const scheduleExecutor = new ScheduleExecutor(scheduleStorage, actuator)

const broker = await Aedes.createBroker()
const tcpServer = net.createServer(broker.handle)
tcpServer.listen(mqttPort, '127.0.0.1')

broker.on('clientError', (_client, error) => {
  console.error('MQTT client error:', error.message)
})

const app = express()
app.use(express.json({ limit: '100kb' }))

app.get('/api/health', (_request, response) => {
  response.json({
    ok: true,
    service: 'nexus-meter-backend',
    mqtt: { port: mqttPort, broker: 'running' },
    timestamp: new Date().toISOString(),
  })
})

app.get('/api/meter/latest', (_request, response) => {
  const reading = storage.latest()
  response.json({
    connected: true,
    provenance: 'SIMULATED',
    reading: reading ?? null,
  })
})

app.get('/api/meter/readings', (request, response) => {
  const limit = Math.min(1000, Math.max(1, Number(request.query.limit ?? 100)))
  response.json({
    provenance: 'SIMULATED',
    readings: storage.list(limit),
  })
})

app.get('/api/meter/stats', (_request, response) => {
  response.json({
    provenance: 'SIMULATED',
    meterLevel: 'household',
    applianceIdentification: false,
    ...ingestion.stats,
    storageFile: dataFile,
  })
})

app.get('/api/appliances', (_request, response) => {
  response.json({
    provenance: 'SIMULATED',
    appliances: applianceStorage.list(),
  })
})

app.post('/api/appliances/register', async (request, response, next) => {
  try {
    const id = typeof request.body?.id === 'string' ? request.body.id.trim() : ''
    if (!id) {
      response.status(400).json({ error: 'Appliance id is required' })
      return
    }
    const name = typeof request.body?.name === 'string' ? request.body.name : undefined
    const appliance = await actuator.register(id, name)
    response.status(200).json({
      registered: true,
      provenance: 'SIMULATED',
      appliance,
    })
  } catch (error) {
    next(error)
  }
})

app.post('/api/appliances/:id/command', async (request, response, next) => {
  try {
    const command = request.body?.command
    if (command !== 'ON' && command !== 'OFF') {
      response.status(400).json({ error: 'Command must be ON or OFF' })
      return
    }
    const result = await actuator.command(request.params.id, command)
    const status = result.success ? 200 : 404
    subscriber.publish(
      `nexus/appliance/${request.params.id}/command-result`,
      JSON.stringify(result),
    )
    if (result.state) {
      subscriber.publish(
        `nexus/appliance/${request.params.id}/state`,
        JSON.stringify(result.state),
      )
    }
    response.status(status).json({
      provenance: 'SIMULATED',
      ...result,
    })
  } catch (error) {
    next(error)
  }
})

const wallTimeToDate = (dateValue: string | undefined, hourValue: number): Date => {
  const now = new Date()
  const date = dateValue ? new Date(`${dateValue}T00:00:00`) : new Date(now.getFullYear(), now.getMonth(), now.getDate())
  if (Number.isNaN(date.getTime())) throw new Error('Invalid schedule date')
  const totalMinutes = Math.max(0, Math.min(1439, Math.round(hourValue * 60)))
  date.setHours(Math.floor(totalMinutes / 60), totalMinutes % 60, 0, 0)
  return date
}

app.get('/api/schedules', (_request, response) => {
  response.json({ provenance: 'SIMULATED', schedules: scheduleStorage.list() })
})

app.get('/api/schedules/:id/executions', (request, response) => {
  const schedule = scheduleStorage.get(request.params.id)
  if (!schedule) {
    response.status(404).json({ error: 'Schedule not found' })
    return
  }
  response.json({
    provenance: 'SIMULATED',
    scheduleId: schedule.id,
    executions: scheduleStorage.executionsFor(schedule.id),
  })
})

app.post('/api/schedules', async (request, response, next) => {
  try {
    const payloads = Array.isArray(request.body?.schedules)
      ? request.body.schedules
      : Array.isArray(request.body)
        ? request.body
        : [request.body]
    const saved: AcceptedSchedule[] = []

    for (const payload of payloads) {
      const applianceId = typeof payload?.applianceId === 'string' ? payload.applianceId.trim() : ''
      if (!applianceId) throw new Error('applianceId is required')

      let start: Date
      let end: Date
      if (typeof payload.startAt === 'string' && typeof payload.endAt === 'string') {
        start = new Date(payload.startAt)
        end = new Date(payload.endAt)
      } else if (typeof payload.from === 'number') {
        const from = payload.from
        const to = typeof payload.to === 'number' ? payload.to : from
        start = wallTimeToDate(payload.date, from)
        end = wallTimeToDate(payload.date, to)
        if (end <= start) end.setDate(end.getDate() + 1)
      } else {
        throw new Error('Schedule requires startAt/endAt or from/to')
      }
      if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
        throw new Error('Schedule has an invalid time range')
      }

      const conflicts = scheduleStorage.conflicts(
        applianceId,
        start.toISOString(),
        end.toISOString(),
      )
      if (conflicts.length) {
        response.status(409).json({
          error: 'Conflicting accepted schedule',
          provenance: 'SIMULATED',
          conflicts: conflicts.map((schedule) => schedule.id),
        })
        return
      }

      const now = new Date().toISOString()
      const schedule: AcceptedSchedule = {
        id: typeof payload.id === 'string' && payload.id.trim() ? payload.id.trim() : randomUUID(),
        applianceId,
        name: typeof payload.name === 'string' ? payload.name : applianceId,
        startAt: start.toISOString(),
        endAt: end.toISOString(),
        status: 'accepted',
        simulated: true,
        createdAt: now,
      }
      await scheduleStorage.save(schedule)
      saved.push(schedule)
    }

    response.status(201).json({ provenance: 'SIMULATED', schedules: saved })
  } catch (error) {
    if (error instanceof Error && /(required|requires|invalid)/i.test(error.message)) {
      response.status(400).json({ error: error.message })
      return
    }
    next(error)
  }
})

app.post('/api/schedules/:id/cancel', async (request, response, next) => {
  try {
    const schedule = scheduleStorage.get(request.params.id)
    if (!schedule) {
      response.status(404).json({ error: 'Schedule not found' })
      return
    }
    if (schedule.status === 'cancelled') {
      response.json({ provenance: 'SIMULATED', schedule })
      return
    }
    const cancelled: AcceptedSchedule = {
      ...schedule,
      status: 'cancelled',
      cancelledAt: new Date().toISOString(),
    }
    await scheduleStorage.save(cancelled)
    response.json({ provenance: 'SIMULATED', schedule: cancelled })
  } catch (error) {
    next(error)
  }
})

app.delete('/api/schedules/:id', async (request, response, next) => {
  try {
    const schedule = scheduleStorage.get(request.params.id)
    if (!schedule) {
      response.status(404).json({ error: 'Schedule not found' })
      return
    }
    const cancelled: AcceptedSchedule = {
      ...schedule,
      status: 'cancelled',
      cancelledAt: new Date().toISOString(),
    }
    await scheduleStorage.save(cancelled)
    response.json({ provenance: 'SIMULATED', schedule: cancelled })
  } catch (error) {
    next(error)
  }
})

app.use((_request, response) => response.status(404).json({ error: 'Not found' }))
app.use((error: unknown, _request: express.Request, response: express.Response, _next: express.NextFunction) => {
  console.error(error)
  response.status(500).json({ error: 'Internal server error' })
})

const subscriber = mqtt.connect(`mqtt://${mqttHost}:${mqttPort}`)
subscriber.on('connect', () => {
  subscriber.subscribe('nexus/meter/+', { qos: 0 })
  subscriber.subscribe('nexus/appliance/+/command', { qos: 0 })
})
subscriber.on('message', async (topic, payload) => {
  const applianceCommand = topic.match(/^nexus\/appliance\/([^/]+)\/command$/)
  if (applianceCommand) {
    try {
      const body = JSON.parse(payload.toString('utf8')) as { command?: unknown }
      if (body.command !== 'ON' && body.command !== 'OFF') {
        console.warn(`Rejected malformed simulated appliance command on ${topic}`)
        return
      }
      const result = await actuator.command(applianceCommand[1], body.command)
      subscriber.publish(`nexus/appliance/${applianceCommand[1]}/command-result`, JSON.stringify(result))
      if (result.state) {
        subscriber.publish(`nexus/appliance/${applianceCommand[1]}/state`, JSON.stringify(result.state))
      }
    } catch {
      console.warn(`Rejected malformed simulated appliance MQTT command on ${topic}`)
    }
    return
  }
  try {
    const result = await ingestion.ingest(JSON.parse(payload.toString('utf8')))
    if (!result.accepted) console.warn(`Rejected meter reading: ${result.reason}`)
  } catch (error) {
    ingestion.stats.received++
    ingestion.stats.rejected++
    console.warn(`Rejected malformed MQTT payload: ${(error as Error).message}`)
  }
})
subscriber.on('error', (error) => console.error('Meter subscriber error:', error.message))

const simulator = new MeterSimulator({
  brokerUrl: `mqtt://${mqttHost}:${mqttPort}`,
  deviceId,
  intervalMs,
})
simulator.start()
scheduleExecutor.start()

const server = app.listen(httpPort, '127.0.0.1', () => {
  console.log(`NEXUS meter backend listening at http://127.0.0.1:${httpPort}`)
  console.log(`Embedded MQTT broker listening at mqtt://${mqttHost}:${mqttPort}`)
})

function shutdown() {
  scheduleExecutor.stop()
  simulator.stop()
  subscriber.end(true)
  server.close()
  tcpServer.close(() => process.exit(0))
  setTimeout(() => process.exit(0), 2000).unref()
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
