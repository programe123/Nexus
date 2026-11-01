export type PageKey =
  | 'home'
  | 'schedule'
  | 'appliances'
  | 'advanced'
  | 'overview'
  | 'inputs'
  | 'analytics'
  | 'forecasting'
  | 'carbon'
  | 'optimization'
  | 'preferences'

export type SourceStatus = 'live' | 'simulated' | 'configured' | 'offline'

export interface InputSource {
  id: string
  name: string
  shortName: string
  description: string
  status: SourceStatus
  lastUpdated: string
  metrics: Array<{ label: string; value: string; detail?: string }>
  note: string
  accent: 'emerald' | 'blue' | 'amber' | 'violet' | 'rose'
  source?: string
}

export interface SeriesPoint {
  time: string
  hour?: number
  demand: number
  forecast?: number
  lower?: number
  upper?: number
  carbon: number
  rate: number
  temperature: number
}

export interface Appliance {
  id: string
  name: string
  category: string
  icon: 'fan' | 'battery' | 'droplets' | 'monitor' | 'utensils' | 'lightbulb'
  power: number
  duration: number
  deadline: number
  priority: 'Low' | 'Medium' | 'High' | 'Critical'
  critical: boolean
  interruptible: boolean
  preferredWindow: [number, number]
  originalStart: number
  active: boolean
}

export interface OptimizerWeights {
  cost: number
  carbon: number
  peak: number
  comfort: number
}

export interface ScheduleItem {
  applianceId: string
  name: string
  from: number
  to: number
  power: number
  moved: boolean
  reason: string
  infeasible?: boolean
}

export interface OptimizationResult {
  schedule: ScheduleItem[]
  originalSchedule: ScheduleItem[]
  originalCost: number
  optimizedCost: number
  originalCarbon: number
  optimizedCarbon: number
  originalPeak: number
  optimizedPeak: number
  confidence: number
  infeasible: string[]
}

export interface Recommendation {
  id: string
  title: string
  action: string
  reason: string
  savings: string
  carbon: string
  confidence: number
  status: 'pending' | 'accepted' | 'rejected'
}

export interface BackendSchedule {
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

export interface ScheduleExecution {
  executionId: string
  scheduleId: string
  applianceId: string
  action: 'ON' | 'OFF'
  scheduledAt: string
  executedAt: string
  status: 'success' | 'failed' | 'skipped' | 'duplicate'
  reason?: string
  simulated: true
}
