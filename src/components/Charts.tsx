import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useData } from '../data/DataContext'
import { weeklyUsage } from '../data/mockData'

const tooltipStyle = { background: '#101c2d', border: '1px solid #263853', borderRadius: 10, color: '#f4f8ff', fontSize: 12 }
const axisStyle = { fill: '#73819a', fontSize: 11 }

export function DemandChart({ forecast = false }: { forecast?: boolean }) {
  const { timeline } = useData()
  const top = Math.max(9, ...timeline.map((point) => point.upper ?? point.demand)) + 0.5
  return <div className="chart-box"><ResponsiveContainer width="100%" height="100%"><AreaChart data={timeline} margin={{ top: 12, right: 6, left: -16, bottom: 0 }}>
    <defs><linearGradient id="demandFill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#55e4a3" stopOpacity={0.35} /><stop offset="100%" stopColor="#55e4a3" stopOpacity={0} /></linearGradient><linearGradient id="forecastFill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#4fb3ff" stopOpacity={0.18} /><stop offset="100%" stopColor="#4fb3ff" stopOpacity={0} /></linearGradient></defs>
    <CartesianGrid vertical={false} stroke="#1c2a40" strokeDasharray="3 4" /><XAxis dataKey="time" tick={axisStyle} tickLine={false} axisLine={false} interval={1} /><YAxis tick={axisStyle} tickLine={false} axisLine={false} domain={[0, top]} unit=" kW" /><Tooltip contentStyle={tooltipStyle} formatter={(value: number) => [`${value.toFixed(1)} kW`, 'Demand']} />
    {forecast && <Area type="monotone" dataKey="upper" stroke="none" fill="url(#forecastFill)" fillOpacity={1} />}{forecast && <Area type="monotone" dataKey="lower" stroke="none" fill="#07101e" fillOpacity={1} />}
    <Area type="monotone" dataKey="demand" stroke="#55e4a3" strokeWidth={2.5} fill="url(#demandFill)" />{forecast && <Line type="monotone" dataKey="forecast" stroke="#4fb3ff" strokeWidth={2.2} strokeDasharray="6 5" dot={false} />}
  </AreaChart></ResponsiveContainer></div>
}

export function CarbonChart() {
  const { timeline, carbonStatus } = useData()
  const values = timeline.map((point) => point.carbon)
  const low = Math.min(...values) - 30
  const high = Math.max(...values) + 30
  return <div className="chart-box"><ResponsiveContainer width="100%" height="100%"><AreaChart data={timeline} margin={{ top: 12, right: 6, left: -16, bottom: 0 }}><defs><linearGradient id="carbonFill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#a78bfa" stopOpacity={0.36} /><stop offset="100%" stopColor="#a78bfa" stopOpacity={0} /></linearGradient></defs><CartesianGrid vertical={false} stroke="#1c2a40" strokeDasharray="3 4" /><XAxis dataKey="time" tick={axisStyle} tickLine={false} axisLine={false} interval={1} /><YAxis tick={axisStyle} tickLine={false} axisLine={false} domain={[low, high]} unit="g" /><Tooltip contentStyle={tooltipStyle} formatter={(value: number) => [`${value} gCO₂/kWh`, carbonStatus === 'live' ? 'Live intensity' : 'Simulated intensity']} /><Area type="monotone" dataKey="carbon" stroke="#a78bfa" strokeWidth={2.5} fill="url(#carbonFill)" /></AreaChart></ResponsiveContainer></div>
}

export function TariffChart() {
  const { timeline, tariffPlan } = useData()
  const top = Math.max(...timeline.map((point) => point.rate))
  return <div className="chart-box compact-chart"><ResponsiveContainer width="100%" height="100%"><BarChart data={timeline} margin={{ top: 8, right: 2, left: -22, bottom: 0 }}><XAxis dataKey="time" tick={axisStyle} tickLine={false} axisLine={false} interval={2} /><YAxis tick={axisStyle} tickLine={false} axisLine={false} unit={tariffPlan.currency} /><Tooltip contentStyle={tooltipStyle} formatter={(value: number) => [`${tariffPlan.currency}${value.toFixed(2)}/kWh`, 'Tariff']} /><Bar dataKey="rate" radius={[5, 5, 0, 0]}>{timeline.map((item) => <Cell key={item.time} fill={item.rate > top * 0.9 ? '#f4a261' : item.rate < top * 0.55 ? '#55e4a3' : '#4fb3ff'} />)}</Bar></BarChart></ResponsiveContainer></div>
}

export function WeeklyUsageChart() {
  return <div className="chart-box"><ResponsiveContainer width="100%" height="100%"><BarChart data={weeklyUsage} margin={{ top: 16, right: 0, left: -16, bottom: 0 }} barGap={6}><CartesianGrid vertical={false} stroke="#1c2a40" strokeDasharray="3 4" /><XAxis dataKey="day" tick={axisStyle} tickLine={false} axisLine={false} /><YAxis tick={axisStyle} tickLine={false} axisLine={false} unit=" kWh" /><Tooltip contentStyle={tooltipStyle} formatter={(value: number) => [`${value.toFixed(1)} kWh`, '']} /><Bar dataKey="baseline" fill="#263543" radius={[5, 5, 0, 0]} /><Bar dataKey="usage" fill="#55e4a3" radius={[5, 5, 0, 0]} /></BarChart></ResponsiveContainer></div>
}

export function ApplianceDonut() {
  const { shares } = useData()
  const total = shares.reduce((sum, item) => sum + item.value, 0)
  return <div className="donut-layout"><div className="donut"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={shares} dataKey="value" nameKey="name" innerRadius={58} outerRadius={79} paddingAngle={3} stroke="none">{shares.map((item) => <Cell key={item.name} fill={item.color} />)}</Pie><Tooltip contentStyle={tooltipStyle} formatter={(value: number) => [`${value}%`, 'Share']} /></PieChart></ResponsiveContainer><div className="donut-center"><b>{total.toFixed(0)}</b><span>% allocated</span></div></div><div className="legend-list">{shares.slice(0, 5).map((item) => <div key={item.name}><i style={{ background: item.color }} /><span>{item.name}</span><b>{item.value}%</b></div>)}</div></div>
}

export function ForecastChart() {
  const { timeline } = useData()
  const horizon = timeline.slice(0, 8)
  const top = Math.max(9, ...horizon.map((point) => point.upper ?? point.demand)) + 0.5
  const low = Math.min(...horizon.map((point) => point.lower ?? point.demand)) - 0.5
  return <div className="forecast-chart"><ResponsiveContainer width="100%" height="100%"><LineChart data={horizon} margin={{ top: 16, right: 8, left: -10, bottom: 0 }}><CartesianGrid vertical={false} stroke="#1c2a40" strokeDasharray="3 4" /><XAxis dataKey="time" tick={axisStyle} tickLine={false} axisLine={false} /><YAxis tick={axisStyle} tickLine={false} axisLine={false} domain={[low, top]} unit=" kW" /><Tooltip contentStyle={tooltipStyle} /><Line type="monotone" dataKey="upper" stroke="#52617a" strokeWidth={1.5} strokeDasharray="4 4" dot={false} /><Line type="monotone" dataKey="lower" stroke="#52617a" strokeWidth={1.5} strokeDasharray="4 4" dot={false} /><Line type="monotone" dataKey="forecast" stroke="#4fb3ff" strokeWidth={3} dot={{ fill: '#07101e', stroke: '#4fb3ff', strokeWidth: 2, r: 3 }} /><Line type="monotone" dataKey="demand" stroke="#55e4a3" strokeWidth={2} dot={false} /></LineChart></ResponsiveContainer></div>
}
