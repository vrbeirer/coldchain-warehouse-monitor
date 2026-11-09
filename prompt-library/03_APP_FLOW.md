# App Flow — Warehouse Zone Monitoring System

## 1. Data Flow (generation side)

```
Config (seed=20261022, scale flag)
      ↓
Master data: Warehouse → Zone → Sensor → StorageRequirement
      ↓
Transactional data: InventoryLot → SensorReading → DoorEvent
      ↓
Injected anomalies: excursions, sensor outages, bad zone assignments,
                      unlinked alarms, multi-zone sensors without rationale
      ↓
Derived/rule-based records: Alarm (from thresholds) → Inspection → Remediation
      ↓
Ground truth extracted (separate file, never merged into feature data)
      ↓
Validation suite (PK/FK/enum/date/reconciliation/lifecycle/duplicates)
      ↓
Export: CSV + JSON + SQL seed + README + SCHEMA.md + validation summary
      ↓
Reproducibility check (regenerate twice, diff checksums)
```

## 2. Data Flow (app side, at runtime)

```
Generator output (CSV/JSON/SQL)
      ↓
SQLite DB (loaded once)
      ↓
FastAPI (read-only endpoints per entity, filterable + paginated)
      ↓
React dashboard (fetches on demand, never pulls raw 1M rows client-side)
```

## 3. Dashboard Screen Flow

```
┌────────────────────┐
│  Warehouse Overview │  ← landing screen
│  (all 10 warehouses,│
│   risk status each) │
└─────────┬───────────┘
          │ click a warehouse
          ▼
┌────────────────────┐
│    Zone Detail       │  ← per-zone time series, occupancy,
│                      │     door log, sensor status (gaps visible)
└─────────┬───────────┘
          │ click an active alarm
          ▼
┌────────────────────┐
│   Alarm Center       │  ← filterable by zone/severity,
│                      │     expandable: rule fired + linked lots
└─────────┬───────────┘
          │ open an alarm's follow-up
          ▼
┌────────────────────┐
│ Inspection /         │  ← status of follow-ups against
│ Remediation Tracker  │     open alarms
└────────────────────┘

Separate, always-reachable tab:
┌────────────────────┐
│  Ground Truth / QA   │  ← injected edge cases next to what
│                      │     the dashboard actually surfaced
└────────────────────┘
```

## 4. Navigation Rules
- Warehouse Overview is the home screen — no login gate (none required for this tool).
- Every alarm is clickable through to its originating zone and its linked lots — no dead-end views.
- The Ground Truth/QA tab is for internal verification, not meant to look like a polished customer feature, but should still follow the design system for consistency.

## 5. What Triggers What
- A `SensorReading` or `DoorEvent` outside the zone's `StorageRequirement` thresholds → `Alarm` created, linked to zone + sensor + overlapping `InventoryLot`(s).
- An open `Alarm` → `Inspection` created after a realistic lag.
- A completed `Inspection` → `Remediation` created if the inspection confirms an issue.
- A `Sensor` with no readings for longer than its expected interval → outage flagged, visible as a genuine data gap on the Zone Detail chart (never faked as a flat/zero reading).
