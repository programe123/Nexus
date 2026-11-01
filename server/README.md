# NEXUS Meter Backend

## Setup

```powershell
npm install
Copy-Item .env.example .env
npm run dev
```

The HTTP server defaults to `127.0.0.1:3001`; the embedded MQTT broker defaults to `127.0.0.1:1883`. Environment variables in `.env` control ports, the simulator device, interval, and NDJSON file.

## Running from the repository root

```powershell
npm run dev:all
```

The root Vite server proxies `/api` to the backend. The backend also starts its simulated publisher automatically.

## APIs

- `GET /api/health`
- `GET /api/meter/latest`
- `GET /api/meter/readings?limit=100`
- `GET /api/meter/stats`
- `GET /api/appliances`
- `POST /api/appliances/register`
- `POST /api/appliances/:id/command`

Appliance endpoints and MQTT control operate on clearly marked simulated devices only.

`provenance: "SIMULATED"` is returned for meter data. Meter readings are household-level aggregate readings; they do not identify individual appliances.

## Appliance and schedule control

All appliance control is simulated:

- `GET /api/appliances`
- `POST /api/appliances/register`
- `POST /api/appliances/:id/command`
- `GET /api/schedules`
- `POST /api/schedules`
- `POST /api/schedules/:id/cancel`
- `DELETE /api/schedules/:id`
- `GET /api/schedules/:id/executions`

Accepted schedules can be sent with ISO `startAt`/`endAt` timestamps or optimizer-style decimal-hour `from`/`to` values plus an optional `date`. The backend reloads accepted schedules at startup and executes overdue transitions safely. Schedule commands do not override later manual appliance commands.

## MQTT

Topic: `nexus/meter/{deviceId}`

The simulator publishes every 5 seconds by default and demonstrates duplicate and malformed readings. Accepted/rejected counts are available through `/api/meter/stats`.
