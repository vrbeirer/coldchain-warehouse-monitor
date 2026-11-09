# PRD — Warehouse Zone Monitoring System
### Product Requirements Document

## 1. Problem Statement
Warehouse operators need to monitor temperature, humidity, occupancy and door events across multiple zones, and get alerted when conditions put stored inventory at risk (e.g. a cold-storage zone drifting warm, a door left open too long, a sensor going silent).

This project builds a **working simulation of that system**: a realistic synthetic dataset standing in for real sensor infrastructure, plus a dashboard that a plant operator or quality engineer would actually use to monitor it.

## 2. Primary Users
- **Plant operator** — watches zone status, acknowledges alarms day to day.
- **Maintenance / quality engineer** — investigates excursions, runs inspections, closes remediations.
- **Production planner** — cares about which inventory lots were exposed to risk conditions.
- **OT/IT administrator** — cares about sensor health and data integrity, not product.

## 3. Scope
In scope:
- Synthetic master + transactional data for the full warehouse/zone/sensor/lot hierarchy.
- Rule-driven alarms (not randomly labelled) with full traceability to affected lots.
- A dashboard covering warehouse → zone → sensor → alarm → inspection → remediation.
- Documented, injected edge cases with a separate ground-truth file for QA.

Out of scope:
- Real sensor hardware or live ingestion — all data is generated, not streamed.
- Authentication/multi-tenant concerns — single internal tool, no login system required unless trivial to add.
- Third-party API integrations — **no external API keys are required anywhere in this project.**

## 4. Success Criteria
- Dataset is large enough to be realistic (10 warehouses, 100 zones, 500 sensors, 1M readings, 10k lots) and fully joinable — no orphan IDs.
- Every alarm traces back to the rule that fired and the lot(s) it affects.
- Injected edge cases are correctly represented in ground truth and correctly surfaced by the dashboard.
- Dataset regenerates identically from the same seed (reproducibility is provable, not just claimed).
- Dashboard looks and feels like a real operations tool, not a scaffolded demo — see `04_UIUX_DESIGN_BRIEF.md`.

## 5. Key Business Rules (summary — full detail in `02_TRD.md` and `05_BACKEND_SCHEMA.md`)
- Master data (warehouse → zone → sensor → storage requirement) exists before any transactional data.
- Alarms are generated strictly from documented threshold rules against readings/door events — never randomly assigned.
- State changes are appended as new event records; history is never overwritten.
- Derived values (dwell time, durations, totals) are always calculated from source records, never generated independently.
- Ground truth for injected anomalies is kept in a separate file and never leaks into the feature data.

## 6. Deliverables
1. Synthetic data generator (seeded, reproducible) + exports (CSV/JSON/SQL)
2. Ground truth file for injected edge cases
3. Validation suite (PK/FK/enum/date/reconciliation/lifecycle checks)
4. Backend API serving the dataset to the frontend
5. Dashboard (5 core views — detailed in `03_APP_FLOW.md`)
6. Documentation: this PRD, TRD, app flow, design brief, backend schema, implementation plan, plus a running `DECISIONS.md` log

## 7. Non-Goals / Guardrails
- No API keys, no external services, no paid dependencies.
- No feature on the dashboard should exist that isn't backed by real generated data — no fake/placeholder UI states dressed up as finished features.
