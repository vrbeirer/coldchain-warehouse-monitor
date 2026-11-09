# TRD — Warehouse Zone Monitoring System
### Technical Requirements Document

## 1. Tech Stack (fixed — don't substitute without logging a reason in `DECISIONS.md`)

| Layer | Choice | Why |
|---|---|---|
| Data generation | Python 3.11+, `pandas`, `numpy`, `faker`, `pydantic` | Standard, fast, typed validation on every record |
| Storage format | CSV + JSON + SQL seed script (SQLite-compatible, portable to Postgres) | Matches export requirement, no vendor lock-in |
| Backend API | FastAPI + SQLite loaded from generator output | Typed, async, zero external services |
| Frontend | React 18 + TypeScript + Vite | Fast dev loop |
| Styling | TailwindCSS + CSS variables for theming | Required by `04_UIUX_DESIGN_BRIEF.md` |
| Charts | `recharts` or `visx` | Handles dense time-series and zone heatmaps |
| Animation | `framer-motion`, used sparingly | Supports non-generic feel |

**No API keys required anywhere in this stack.** Everything runs local: local Python generator, local SQLite, local FastAPI, local Vite dev server.

## 2. Repo Structure

```
/data-generator
  /generators          # one module per entity
  /config              # seed, volume knobs, enums
  /output
    /csv  /json  /sql
    ground_truth.json
    ground_truth.csv
  /validation
  requirements.txt

/backend
  /routes  /models  /db
  main.py

/frontend
  /src
    /components  /pages  /styles  /lib

DECISIONS.md
```

## 3. ID / Naming Conventions
- `WH-001`
- `ZONE-<warehouse-id>-001`
- `SNS-<zone-id>-TEMP-01` (suffix varies by sensor type: TEMP / HUM / OCC / DOOR)
- `RDG-<sensor-id>-<timestamp>`
- `LOT-2026-000001`

Rules: zero-padded, immutable once assigned, referenced IDs must match exactly everywhere. A format validator should fail the build on any drift.

## 4. Non-Negotiable Data Integrity Rules
- Parent/master tables generated before child/event tables; no FK may reference an ID that doesn't exist.
- Derived values (dwell time, durations, totals) are **always** calculated from source records — never generated independently.
- Alarms and labels follow documented rules — never randomly assigned.
- State changes append new event rows; nothing is overwritten in place.
- `issue_type` / `ground_truth` are explicit columns on injected anomalies, kept separate from feature data.

## 5. Volume Targets
10 warehouses · 100 zones · 500 sensors · 1,000,000 sensor readings · 10,000 inventory lots. Fixed seed: `20261022`. Generator must support a `--scale` flag so a small dev dataset and the full dataset come from the same codebase.

## 6. Validation Requirements
Automated checks, run as part of the build (not manual):
- Primary-key uniqueness across every table
- Foreign-key integrity on every relationship
- Enum/allowed-value conformance
- Date ordering (arrival < departure; alarm < inspection < remediation)
- Arithmetic reconciliation on derived values
- Lifecycle transition legality (no illegal state reversals)
- Duplicate detection
- **Reproducibility**: run generator twice with the same seed, diff row counts + checksums — scripted, not eyeballed

The Zone Detail screen must use a backend aggregation endpoint for readings (for example
`/api/readings/series?zone_id=...`). The endpoint returns bounded time buckets with
average/minimum/maximum values and sample counts. The frontend must never request or
render the raw 1,000,000-row readings table.

## 7. Backend API Requirements
- Serves the generated dataset to the frontend: filterable, paginated endpoints per entity (warehouses, zones, sensors, readings, alarms, inspections, remediations).
- Read-only is sufficient — this is a monitoring tool over generated data, not a write-heavy transactional system.
- No external integrations, no auth provider, no API key management.

## 8. Non-Functional Requirements
- Local-first: entire project runs with `pip install` + `npm install`, no cloud account needed.
- Dashboard must remain responsive against the full 1M-reading dataset (paginate/aggregate on the backend, don't ship raw rows to the browser).
- Every phase in `06_IMPLEMENTATION_PLAN.md` must be independently verifiable before moving to the next.
