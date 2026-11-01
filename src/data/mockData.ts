import type { Recommendation } from '../types'

/**
 * Remaining static fixtures.
 * Live telemetry, weather, carbon and tariffs now flow through src/data/DataContext.
 * This file keeps the genuinely static content: weekly history, decision log
 * and the seeded recommendation set.
 */

export const weeklyUsage = [
  { day: 'Mon', usage: 62.4, baseline: 66.2 },
  { day: 'Tue', usage: 58.7, baseline: 64.8 },
  { day: 'Wed', usage: 65.1, baseline: 65.9 },
  { day: 'Thu', usage: 59.3, baseline: 63.4 },
  { day: 'Fri', usage: 61.8, baseline: 64.2 },
  { day: 'Sat', usage: 49.6, baseline: 52.8 },
  { day: 'Sun', usage: 45.1, baseline: 48.3 },
]

export const initialRecommendations: Recommendation[] = [
  { id: 'rec-ev', title: 'Delay EV charging by 3 hours', action: '21:00 → 00:00', reason: 'Avoids the forecast peak and enters a lower-carbon, off-peak window.', savings: '₹13.2 saved', carbon: '1.4 kgCO₂ less', confidence: 88, status: 'pending' },
  { id: 'rec-water', title: 'Preheat water before 08:00', action: '06:00 → 05:00', reason: 'Keeps the comfort deadline while using the cleanest early-morning interval.', savings: '₹2.1 saved', carbon: '0.3 kgCO₂ less', confidence: 91, status: 'pending' },
  { id: 'rec-hvac', title: 'Hold HVAC setpoint at 24°C', action: '14:00–16:00', reason: 'Small adjustment avoids peak demand. The operator profile shows high acceptance.', savings: '0.4 kW peak cut', carbon: '0.5 kgCO₂ less', confidence: 79, status: 'pending' },
]

export const history = [
  { date: 'Oct 25', action: 'Shifted EV charging', outcome: 'Accepted', impact: '₹10.8 · 1.2 kgCO₂' },
  { date: 'Oct 24', action: 'Lowered HVAC setpoint', outcome: 'Rejected', impact: 'Comfort constraint' },
  { date: 'Oct 22', action: 'Preheated water', outcome: 'Accepted', impact: '₹1.9 · 0.3 kgCO₂' },
  { date: 'Oct 21', action: 'Delayed dishwasher', outcome: 'Accepted', impact: '₹3.6 · 0.4 kgCO₂' },
]
