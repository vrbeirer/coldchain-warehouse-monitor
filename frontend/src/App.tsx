import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Activity, AlertTriangle, Box, Building2, ClipboardCheck, Database, LayoutDashboard, Moon, ShieldCheck, Sun, Thermometer } from 'lucide-react'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

type View = 'overview' | 'zone' | 'alarms' | 'tracker' | 'qa'
type Row = Record<string, string | number>
const API = 'http://localhost:8000'
const nav: { id: View; label: string; icon: typeof Activity }[] = [
  { id: 'overview', label: 'Warehouse overview', icon: LayoutDashboard },
  { id: 'zone', label: 'Zone detail', icon: Thermometer },
  { id: 'alarms', label: 'Alarm center', icon: AlertTriangle },
  { id: 'tracker', label: 'Follow-up tracker', icon: ClipboardCheck },
  { id: 'qa', label: 'Ground truth / QA', icon: ShieldCheck },
]

async function fetchEntity(entity: string, query = ''): Promise<Row[]> {
  try {
    const response = await fetch(`${API}/api/${entity}${query}`)
    if (!response.ok) return []
    const payload = await response.json()
    return payload.items ?? []
  } catch {
    return []
  }
}

async function fetchSummary(): Promise<Record<string, number>> {
  try { const response = await fetch(`${API}/api/summary`); return response.ok ? await response.json() : {} } catch { return {} }
}

function EmptyState({ label }: { label: string }) {
  return <div className="empty"><Database size={18} /><strong>No {label} available</strong><span>Start the FastAPI service and generate a dataset to populate this view.</span></div>
}

function AnimatedValue({ value }: { value: string }) {
  const match = value.match(/^(-?\d+(?:\.\d+)?)(.*)$/)
  const target = match ? Number(match[1]) : null
  const suffix = match?.[2] ?? ''
  const [display, setDisplay] = useState(target ?? 0)
  useEffect(() => {
    if (target === null) return
    const started = performance.now()
    let frame = 0
    const tick = (now: number) => {
      const progress = Math.min((now - started) / 500, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setDisplay(target * eased)
      if (progress < 1) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [target])
  if (target === null) return <>{value}</>
  const decimals = match?.[1].includes('.') ? 1 : 0
  return <>{display.toFixed(decimals)}{suffix}</>
}

function Metric({ label, value, note, warning = false }: { label: string; value: string; note: string; warning?: boolean }) {
  return <div className="metric"><div className="metric-label">{label}</div><div className="metric-value"><AnimatedValue value={value} /></div><div className={`metric-note ${warning ? 'warn' : ''}`}>{note}</div></div>
}

function SkeletonMetrics() {
  return <div className="metrics">{Array.from({ length: 4 }, (_, index) => <div className="metric skeleton-card" key={index}><span className="skeleton skeleton-label" /><span className="skeleton skeleton-value" /><span className="skeleton skeleton-note" /></div>)}</div>
}

function SkeletonRows({ count = 4 }: { count?: number }) {
  return <div className="skeleton-rows">{Array.from({ length: count }, (_, index) => <div className="skeleton skeleton-row" key={index} />)}</div>
}

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ name?: string; value?: number; payload?: { timestamp?: string } }>; label?: string }) {
  if (!active || !payload?.length) return null
  const timestamp = payload[0].payload?.timestamp ?? `${label} UTC`
  return <div className="chart-tooltip"><strong>{timestamp}</strong>{payload.map((point) => <div key={point.name} className="chart-tooltip-value"><span>{point.name}</span><b>{Number(point.value).toFixed(2)} °C</b></div>)}</div>
}

function Overview({ go }: { go: (view: View) => void }) {
  const [warehouses, setWarehouses] = useState<Row[]>([])
  const [summary, setSummary] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  useEffect(() => { void Promise.all([fetchEntity('warehouses', '?page_size=100'), fetchSummary()]).then(([rows, counts]) => { setWarehouses(rows); setSummary(counts); setLoading(false) }) }, [])
  const connected = Object.keys(summary).length > 0
  return <><div className="page-heading"><div><h1>Warehouse overview</h1><p className="lede">Operational signal across the PATIL network.</p></div><div className="mono timestamp">06 NOV 2026 · 23:22 UTC</div></div>
    {loading ? <SkeletonMetrics /> : <div className="metrics"><Metric label="Warehouses online" value={connected ? `${warehouses.length} / ${summary.warehouses ?? '—'}` : '—'} note={connected ? 'Live from API' : 'Waiting for API'} /><Metric label="Active alarms" value={connected ? String(summary.alarms ?? 0) : '—'} note={connected ? 'From generated records' : 'No data loaded'} warning={connected && (summary.alarms ?? 0) > 0} /><Metric label="Sensors reporting" value={connected ? String(summary.sensors ?? 0) : '—'} note={connected ? 'Registered sensors' : 'No data loaded'} /><Metric label="Lots in storage" value={connected ? String(summary.lots ?? 0) : '—'} note={connected ? 'Generated inventory' : 'No data loaded'} /></div>}
    <div className="grid"><section className="panel"><div className="panel-title"><h2>Network status</h2><span>{loading ? 'Loading' : `${warehouses.length} facilities`}</span></div>{loading ? <SkeletonRows count={5} /> : warehouses.length ? <div className="warehouse-list">{warehouses.map((warehouse) => <motion.div whileHover={{ x: 3 }} className="warehouse-row" key={String(warehouse.warehouse_id)} onClick={() => go('zone')} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); go('zone') } }} role="button" tabIndex={0}><div><div className="warehouse-name">{String(warehouse.name)}</div><div className="warehouse-id">{String(warehouse.warehouse_id)} · {String(warehouse.region ?? 'region unassigned')}</div></div><div className="bar"><i style={{ width: '100%' }} /></div><div className="status healthy">Online</div></motion.div>)}</div> : <EmptyState label="warehouse records" />}</section>
      <section className="panel"><div className="panel-title"><h2>Attention queue</h2><span>Live records</span></div>{loading ? <SkeletonRows count={3} /> : connected && (summary.alarms ?? 0) > 0 ? <div className="alert-stack"><div className="alert"><div className="alert-title">Active alarm records detected</div><div className="alert-meta">{summary.alarms} alarms are available in Alarm Center</div></div><button className="nav-button" style={{ marginTop: 16, color: 'var(--accent)' }} onClick={() => go('alarms')}>Open alarm center <span>→</span></button></div> : <EmptyState label="active alarms" />}</section></div></>
}

function ZoneDetail() {
  const [zones, setZones] = useState<Row[]>([])
  const [selected, setSelected] = useState('')
  const [readings, setReadings] = useState<Row[]>([])
  const [chartExpanded, setChartExpanded] = useState(false)
  const [zonesLoading, setZonesLoading] = useState(true)
  const [readingsLoading, setReadingsLoading] = useState(false)
  useEffect(() => { void fetchEntity('zones', '?page_size=100').then((rows) => { setZones(rows); if (rows[0]) setSelected(String(rows[0].zone_id)); setZonesLoading(false) }) }, [])
  useEffect(() => { if (!selected) return; setReadingsLoading(true); void fetchEntity('readings/series', `?zone_id=${encodeURIComponent(selected)}&page_size=288&bucket_minutes=5`).then((rows) => { setReadings(rows); setReadingsLoading(false) }) }, [selected])
  const zone = useMemo(() => zones.find((item) => item.zone_id === selected), [selected, zones])
  const chartData = readings.map((reading) => ({ timestamp: String(reading.bucket), time: String(reading.bucket).slice(11, 16), average: Number(reading.average_value), minimum: Number(reading.minimum_value), maximum: Number(reading.maximum_value) }))
  const chartValues = chartData.flatMap((reading) => [reading.minimum, reading.maximum]).filter(Number.isFinite)
  const chartMin = chartValues.length ? Math.min(...chartValues) : 0
  const chartMax = chartValues.length ? Math.max(...chartValues) : 1
  const chartPad = Math.max((chartMax - chartMin) * 0.12, 0.5)
  const last = chartData.at(-1)
  return <><div className="page-heading"><div><h1>Zone detail</h1><p className="lede">Aggregated telemetry with gaps preserved as gaps.</p></div><select className="filter" value={selected} onChange={(event) => setSelected(event.target.value)} aria-label="Select zone">{!zones.length && <option value="">No zones available</option>}{zones.map((item) => <option key={String(item.zone_id)} value={String(item.zone_id)}>{String(item.zone_id)}</option>)}</select></div>
    {zonesLoading ? <SkeletonMetrics /> : <div className="metrics"><Metric label="Latest average" value={last ? `${last.average.toFixed(1)} °C` : '—'} note={last ? 'From latest 5-minute bucket' : 'No readings loaded'} /><Metric label="Samples rendered" value={String(readings.length || '—')} note="Backend-bucketed, max 288" /><Metric label="Zone state" value={zone ? String(zone.state) : '—'} note={zone ? String(zone.zone_type) : 'No zone selected'} /><Metric label="Raw readings sent" value="0" note="Aggregation enforced" /></div>}
    <section className={`panel chart-panel ${chartExpanded ? 'chart-panel-expanded' : ''}`}><div className="panel-title"><h2>{zone ? String(zone.name) : 'Zone telemetry'}</h2><button className="chart-expand-button" onClick={() => setChartExpanded((expanded) => !expanded)} aria-expanded={chartExpanded} aria-label={chartExpanded ? 'Collapse chart' : 'Expand chart'}>{chartExpanded ? 'Collapse' : 'Expand'} chart</button></div>{readingsLoading ? <div className="skeleton skeleton-chart" /> : chartData.length ? <><div className="chart"><ResponsiveContainer width="100%" height="100%"><AreaChart data={chartData}><defs><linearGradient id="greenFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#2fbf71" stopOpacity=".28" /><stop offset="100%" stopColor="#2fbf71" stopOpacity="0" /></linearGradient></defs><CartesianGrid stroke="var(--line)" vertical={false} /><XAxis dataKey="time" tick={{ fill: 'var(--muted)', fontSize: 11 }} axisLine={false} tickLine={false} /><YAxis domain={[chartMin - chartPad, chartMax + chartPad]} tick={{ fill: 'var(--muted)', fontSize: 11 }} axisLine={false} tickLine={false} /><Tooltip content={<ChartTooltip />} /><Area type="monotone" dataKey="maximum" stroke="#2fbf71" fill="none" strokeWidth={1} strokeOpacity=".35" /><Area type="monotone" dataKey="average" stroke="#2fbf71" fill="url(#greenFill)" strokeWidth={2} /><Area type="monotone" dataKey="minimum" stroke="#2fbf71" fill="none" strokeWidth={1} strokeOpacity=".35" /></AreaChart></ResponsiveContainer></div><div className="mono chart-note">Each point is an API aggregate; no interpolation is applied.</div></> : <EmptyState label="readings for this zone" />}</section></>
}

function Alarms() {
  const [alarms, setAlarms] = useState<Row[]>([])
  const [severity, setSeverity] = useState('all')
  const [loading, setLoading] = useState(true)
  const [newAlarmIds, setNewAlarmIds] = useState<Set<string>>(new Set())
  const previousIds = useRef<Set<string> | null>(null)
  useEffect(() => {
    let active = true
    const refresh = async () => {
      const next = await fetchEntity('alarms', '?page_size=100')
      if (!active) return
      const nextIds = new Set(next.map((alarm) => String(alarm.alarm_id)))
      if (previousIds.current) {
        const fresh = new Set([...nextIds].filter((id) => !previousIds.current?.has(id)))
        if (fresh.size) {
          setNewAlarmIds(fresh)
          window.setTimeout(() => setNewAlarmIds(new Set()), 1600)
        }
      }
      previousIds.current = nextIds
      setAlarms(next)
      setLoading(false)
    }
    void refresh()
    const interval = window.setInterval(() => void refresh(), 30000)
    return () => { active = false; window.clearInterval(interval) }
  }, [])
  const filtered = severity === 'all' ? alarms : alarms.filter((item) => item.severity === severity)
  return <><div className="page-heading"><div><h1>Alarm center</h1><p className="lede">Every alert is traceable to a rule, reading, and affected inventory.</p></div></div><div className="toolbar"><select className="filter" value={severity} onChange={(event) => setSeverity(event.target.value)}><option value="all">All severities</option><option value="critical">Critical</option><option value="high">High</option><option value="medium">Medium</option></select><span className="mono timestamp">{loading ? 'Loading' : `${filtered.length} loaded`}</span></div><section className="panel table-wrap">{loading ? <SkeletonRows count={5} /> : filtered.length ? <table className="data-table"><thead><tr><th>Alarm</th><th>Severity</th><th>Zone</th><th>Rule fired</th><th>State</th><th>Triggered</th></tr></thead><tbody>{filtered.map((alarm) => <tr className={newAlarmIds.has(String(alarm.alarm_id)) ? 'new-alarm-row' : ''} key={String(alarm.alarm_id)}><td><strong>{String(alarm.alarm_id)}</strong><div className="secondary">{String(alarm.summary)}</div></td><td><span className={`pill ${alarm.severity === 'critical' ? 'coral' : 'blue'}`}>{String(alarm.severity)}</span></td><td className="mono">{String(alarm.zone_id)}</td><td className="mono">{String(alarm.rule_code)}</td><td><span className="pill blue">{String(alarm.state)}</span></td><td className="mono">{String(alarm.triggered_at).slice(11, 16)} UTC</td></tr>)}</tbody></table> : <EmptyState label="alarm records" />}</section></>
}

function Tracker() {
  const [inspections, setInspections] = useState<Row[]>([])
  const [remediations, setRemediations] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  useEffect(() => { void Promise.all([fetchEntity('inspections', '?page_size=100'), fetchEntity('remediations', '?page_size=100')]).then(([inspectionRows, remediationRows]) => { setInspections(inspectionRows); setRemediations(remediationRows); setLoading(false) }) }, [])
  const scheduled = inspections.filter((item) => item.status === 'scheduled')
  const progress = [...inspections.filter((item) => item.status === 'in-progress'), ...remediations.filter((item) => item.status === 'in-progress')]
  const resolved = [...inspections.filter((item) => item.status === 'completed'), ...remediations.filter((item) => item.status === 'resolved')]
  const column = (label: string, items: Row[], description: string) => <div className="track-col"><div className="track-head">{label} · {items.length}</div>{items.length ? items.slice(0, 20).map((item) => <div className="ticket" key={String(item.inspection_id ?? item.remediation_id)}><strong>{String(item.alarm_id ?? item.inspection_id ?? item.remediation_id)}</strong><small>{description} · {String(item.status)}</small></div>) : <div className="track-empty">No records</div>}</div>
  return <><div className="page-heading"><div><h1>Follow-up tracker</h1><p className="lede">Inspection and remediation work stays connected to originating alarms.</p></div></div>{loading ? <div className="tracker">{Array.from({ length: 3 }, (_, index) => <div className="track-col" key={index}><span className="skeleton skeleton-column-title" /><SkeletonRows count={3} /></div>)}</div> : <div className="tracker">{column('Scheduled', scheduled, 'Inspection')}{column('In progress', progress, 'Active work')}{column('Resolved', resolved, 'Completed')}</div>}</>
}

function QA() {
  const [truth, setTruth] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  useEffect(() => { void fetchEntity('ground-truth', '?page_size=100').then((rows) => { setTruth(rows); setLoading(false) }) }, [])
  return <><div className="page-heading"><div><h1>Ground truth / QA</h1><p className="lede">Internal verification of injected cases against surfaced dashboard signals.</p></div></div><div className="qa-note"><Database size={15} /> Ground truth is kept separate from feature data and never used as a model input.</div><section className="panel table-wrap">{loading ? <SkeletonRows count={4} /> : truth.length ? <table className="data-table"><thead><tr><th>Case</th><th>Issue type</th><th>Record</th><th>Expected correct outcome</th></tr></thead><tbody>{truth.map((item) => <tr key={String(item.case_id)}><td className="mono">{String(item.case_id)}</td><td><span className="pill blue">{String(item.issue_type)}</span></td><td className="mono">{String(item.record_id)}</td><td>{String(item.ground_truth)}</td></tr>)}</tbody></table> : <EmptyState label="ground-truth cases" />}</section></>
}

export default function App() {
  const [view, setView] = useState<View>('overview')
  const [dark, setDark] = useState(() => localStorage.getItem('aegis-theme') !== 'light')
  const [apiConnected, setApiConnected] = useState<boolean | null>(null)
  useEffect(() => { document.documentElement.dataset.theme = dark ? 'dark' : 'light'; localStorage.setItem('aegis-theme', dark ? 'dark' : 'light') }, [dark])
  useEffect(() => { let active = true; void fetch(`${API}/health`).then((response) => { if (active) setApiConnected(response.ok) }).catch(() => { if (active) setApiConnected(false) }); return () => { active = false } }, [])
  const content = view === 'overview' ? <Overview go={setView} /> : view === 'zone' ? <ZoneDetail /> : view === 'alarms' ? <Alarms /> : view === 'tracker' ? <Tracker /> : <QA />
  const navButton = ({ id, label, icon: Icon }: { id: View; label: string; icon: typeof Activity }) => <button key={id} className={`nav-button ${view === id ? 'active' : ''}`} onClick={() => setView(id)}>{view === id && <motion.span layoutId="sidebar-active" className="nav-active-indicator" transition={{ type: 'spring', stiffness: 420, damping: 32 }} />}<Icon className="nav-icon" /><span>{label}</span></button>
  return <div className="app-shell"><aside className="sidebar"><div className="brand"><div className="brand-mark"><Building2 size={18} /></div><div className="brand-name">PATIL<span className="brand-sub">coldchain intelligence</span></div></div><div className="nav-label">Monitor</div>{nav.slice(0, 3).map(navButton)}<div className="nav-label">Workflow</div>{nav.slice(3).map(navButton)}<div className="side-foot"><Box size={14} style={{ verticalAlign: 'middle', marginRight: 5, color: 'var(--accent)' }} /> Seeded simulation<br />v1.0 · local only</div></aside><main className="main"><div className="topbar"><div className="breadcrumb">PATIL / {nav.find((item) => item.id === view)?.label}</div><div className="topbar-actions"><div className="live" aria-live="polite"><span className="live-dot" /> {apiConnected === null ? 'API CHECKING' : apiConnected ? 'API CONNECTED' : 'API DISCONNECTED'}</div><button className="theme-toggle" onClick={() => setDark((value) => !value)} aria-label={`Switch to ${dark ? 'light' : 'dark'} mode`}>{dark ? <Sun size={16} /> : <Moon size={16} />}</button></div></div><AnimatePresence mode="wait"><motion.div key={view} initial={{ opacity: 0, y: 7 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: .18 }}>{content}</motion.div></AnimatePresence></main></div>
}
