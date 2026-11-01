import type { Appliance } from '../types'

/**
 * Static reference data.
 * The appliance catalogue and tariff plans below are versioned assets that the
 * UI reads directly (add-appliance picker, tariff plan selector, bill maths).
 * They are deliberately kept separate from live/simulated telemetry so they can
 * later be served from a CMS or a config service without touching components.
 */

export interface ApplianceTemplate {
  name: string
  category: string
  icon: Appliance['icon']
  power: number
  duration: number
  deadline: number
  priority: Appliance['priority']
  critical: boolean
  interruptible: boolean
  preferredWindow: [number, number]
  originalStart: number
}

export interface TariffWindow {
  from: number
  to: number
  rate: number
  label: string
}

export interface TariffPlan {
  id: string
  name: string
  utility: string
  currency: string
  windows: TariffWindow[]
}

export const applianceCatalog: ApplianceTemplate[] = [
  { name: 'Ceiling Fan', category: 'Comfort load', icon: 'fan', power: 0.075, duration: 4, deadline: 23, priority: 'Medium', critical: false, interruptible: true, preferredWindow: [18, 23], originalStart: 18 },
  { name: 'Exhaust Fan', category: 'Comfort load', icon: 'fan', power: 0.05, duration: 2, deadline: 22, priority: 'Low', critical: false, interruptible: true, preferredWindow: [18, 22], originalStart: 19 },
  { name: 'Air Purifier', category: 'Climate control', icon: 'fan', power: 0.06, duration: 8, deadline: 23, priority: 'Low', critical: false, interruptible: true, preferredWindow: [21, 7], originalStart: 21 },
  { name: 'Inverter AC 1.5T', category: 'Climate control', icon: 'fan', power: 1.5, duration: 3, deadline: 22, priority: 'High', critical: false, interruptible: false, preferredWindow: [14, 22], originalStart: 15 },
  { name: 'Desert Cooler', category: 'Climate control', icon: 'fan', power: 0.25, duration: 5, deadline: 23, priority: 'Medium', critical: false, interruptible: true, preferredWindow: [16, 23], originalStart: 17 },
  { name: 'Room Heater', category: 'Comfort load', icon: 'droplets', power: 2.0, duration: 2, deadline: 22, priority: 'Medium', critical: false, interruptible: true, preferredWindow: [19, 22], originalStart: 20 },
  { name: 'Water Purifier', category: 'Essential load', icon: 'droplets', power: 0.5, duration: 1, deadline: 9, priority: 'Medium', critical: false, interruptible: true, preferredWindow: [6, 9], originalStart: 7 },
  { name: 'Washing Machine', category: 'Flexible load', icon: 'utensils', power: 0.6, duration: 1, deadline: 22, priority: 'Medium', critical: false, interruptible: true, preferredWindow: [20, 7], originalStart: 20 },
  { name: 'Tumble Dryer', category: 'Flexible load', icon: 'utensils', power: 2.5, duration: 1, deadline: 23, priority: 'Low', critical: false, interruptible: true, preferredWindow: [21, 7], originalStart: 22 },
  { name: 'Microwave Oven', category: 'Kitchen load', icon: 'utensils', power: 1.2, duration: 1, deadline: 21, priority: 'Medium', critical: false, interruptible: false, preferredWindow: [18, 21], originalStart: 19 },
  { name: 'Induction Cooktop', category: 'Kitchen load', icon: 'utensils', power: 2.0, duration: 1, deadline: 21, priority: 'High', critical: false, interruptible: false, preferredWindow: [18, 21], originalStart: 19 },
  { name: 'Electric Kettle', category: 'Kitchen load', icon: 'utensils', power: 1.5, duration: 1, deadline: 10, priority: 'Medium', critical: false, interruptible: false, preferredWindow: [7, 10], originalStart: 8 },
  { name: 'Refrigerator', category: 'Essential load', icon: 'monitor', power: 0.15, duration: 24, deadline: 23, priority: 'Critical', critical: true, interruptible: false, preferredWindow: [0, 23], originalStart: 0 },
  { name: 'Deep Freezer', category: 'Essential load', icon: 'monitor', power: 0.2, duration: 24, deadline: 23, priority: 'Critical', critical: true, interruptible: false, preferredWindow: [0, 23], originalStart: 0 },
  { name: 'Geyser', category: 'Comfort load', icon: 'droplets', power: 3.0, duration: 1, deadline: 8, priority: 'High', critical: false, interruptible: false, preferredWindow: [5, 8], originalStart: 6 },
  { name: 'Solar Water Heater', category: 'Comfort load', icon: 'droplets', power: 1.5, duration: 1, deadline: 9, priority: 'Medium', critical: false, interruptible: true, preferredWindow: [6, 9], originalStart: 7 },
  { name: 'Television', category: 'Entertainment', icon: 'monitor', power: 0.12, duration: 4, deadline: 23, priority: 'Low', critical: false, interruptible: true, preferredWindow: [19, 23], originalStart: 20 },
  { name: 'Gaming Console', category: 'Entertainment', icon: 'monitor', power: 0.2, duration: 2, deadline: 23, priority: 'Low', critical: false, interruptible: true, preferredWindow: [19, 23], originalStart: 20 },
  { name: 'Home Theatre', category: 'Entertainment', icon: 'monitor', power: 0.35, duration: 3, deadline: 23, priority: 'Low', critical: false, interruptible: true, preferredWindow: [19, 23], originalStart: 20 },
  { name: 'Wi-Fi Router + ONT', category: 'Essential load', icon: 'monitor', power: 0.02, duration: 24, deadline: 23, priority: 'Critical', critical: true, interruptible: false, preferredWindow: [0, 23], originalStart: 0 },
  { name: 'NAS / Server Rack', category: 'Productivity load', icon: 'monitor', power: 0.25, duration: 24, deadline: 23, priority: 'High', critical: true, interruptible: false, preferredWindow: [0, 23], originalStart: 0 },
  { name: 'Laptop Charging', category: 'Productivity load', icon: 'monitor', power: 0.09, duration: 2, deadline: 9, priority: 'Medium', critical: false, interruptible: true, preferredWindow: [22, 6], originalStart: 22 },
  { name: 'Laser Printer', category: 'Productivity load', icon: 'monitor', power: 0.5, duration: 1, deadline: 18, priority: 'Low', critical: false, interruptible: true, preferredWindow: [10, 18], originalStart: 11 },
  { name: 'Water Pump', category: 'Motor load', icon: 'droplets', power: 1.5, duration: 1, deadline: 10, priority: 'Medium', critical: false, interruptible: true, preferredWindow: [6, 10], originalStart: 7 },
  { name: 'Submersible Pump', category: 'Motor load', icon: 'droplets', power: 3.0, duration: 1, deadline: 11, priority: 'Medium', critical: false, interruptible: true, preferredWindow: [6, 11], originalStart: 7 },
  { name: 'Attic Fan', category: 'Comfort load', icon: 'fan', power: 0.3, duration: 3, deadline: 20, priority: 'Low', critical: false, interruptible: true, preferredWindow: [14, 20], originalStart: 15 },
  { name: 'Outdoor Lighting', category: 'Lighting', icon: 'lightbulb', power: 0.3, duration: 6, deadline: 23, priority: 'Medium', critical: false, interruptible: true, preferredWindow: [18, 24], originalStart: 18 },
  { name: 'Grow Lights', category: 'Lighting', icon: 'lightbulb', power: 0.6, duration: 8, deadline: 22, priority: 'Medium', critical: false, interruptible: true, preferredWindow: [8, 22], originalStart: 9 },
  { name: 'EV Charger (7.4 kW)', category: 'Transport load', icon: 'battery', power: 7.4, duration: 3, deadline: 7, priority: 'Medium', critical: false, interruptible: true, preferredWindow: [23, 7], originalStart: 23 },
  { name: 'E-Scooter Charger', category: 'Transport load', icon: 'battery', power: 0.8, duration: 3, deadline: 8, priority: 'Low', critical: false, interruptible: true, preferredWindow: [23, 8], originalStart: 23 },
  { name: 'Electric Cooking Pot', category: 'Kitchen load', icon: 'utensils', power: 1.0, duration: 1, deadline: 20, priority: 'Medium', critical: false, interruptible: false, preferredWindow: [17, 20], originalStart: 18 },
  { name: 'Home Elevator', category: 'Motor load', icon: 'monitor', power: 1.1, duration: 1, deadline: 22, priority: 'High', critical: true, interruptible: false, preferredWindow: [7, 22], originalStart: 8 },
]

export const tariffPlans: TariffPlan[] = [
  {
    id: 'mumbai-toau-2024',
    name: 'Mumbai TOU  -  2024',
    utility: 'BEST / Adani Electricity',
    currency: '\u20B9',
    windows: [
      { from: 0, to: 6, rate: 5.2, label: 'Off-peak' },
      { from: 6, to: 17, rate: 8.7, label: 'Standard' },
      { from: 17, to: 21, rate: 11.6, label: 'Peak' },
      { from: 21, to: 24, rate: 9.4, label: 'Evening' },
    ],
  },
  {
    id: 'delhi-toau-2024',
    name: 'Delhi TOU  -  2024',
    utility: 'BSES / TPDDL',
    currency: '\u20B9',
    windows: [
      { from: 0, to: 7, rate: 4.9, label: 'Off-peak' },
      { from: 7, to: 16, rate: 7.8, label: 'Standard' },
      { from: 16, to: 23, rate: 10.2, label: 'Peak' },
      { from: 23, to: 24, rate: 8.1, label: 'Night' },
    ],
  },
  {
    id: 'karnataka-toau-2024',
    name: 'Bengaluru TOU  -  2024',
    utility: 'BESCOM',
    currency: '\u20B9',
    windows: [
      { from: 0, to: 6, rate: 5.6, label: 'Off-peak' },
      { from: 6, to: 18, rate: 8.2, label: 'Standard' },
      { from: 18, to: 23, rate: 10.8, label: 'Peak' },
      { from: 23, to: 24, rate: 7.4, label: 'Night' },
    ],
  },
  {
    id: 'uk-flexible-2024',
    name: 'UK Flexible  -  2024',
    utility: 'Agile-style half-hourly',
    currency: 'GBP',
    windows: [
      { from: 0, to: 7, rate: 0.22, label: 'Off-peak' },
      { from: 7, to: 16, rate: 0.29, label: 'Standard' },
      { from: 16, to: 19, rate: 0.41, label: 'Peak' },
      { from: 19, to: 24, rate: 0.31, label: 'Evening' },
    ],
  },
]

export const defaultTariffPlanId = 'mumbai-toau-2024'

export const defaultLocation = { name: 'New Delhi, India', latitude: 28.6139, longitude: 77.209 }
