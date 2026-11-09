# Implementation Plan — Warehouse Zone Monitoring System

Execute phases in order. Commit after each. Do not merge phases. Log every assumption in `DECISIONS.md` instead of asking — pick the most defensible engineering choice and move on.

## Phase 0 — Environment & Scaffolding
- Repo structure per `02_TRD.md` §2.
- Python venv + `requirements.txt`. Vite + React + TS + Tailwind scaffold. FastAPI scaffold with a health-check route.
- **Done when:** `pip install` and `npm install` both succeed clean; empty app boots on both ends. No API keys involved anywhere.

## Phase 1 — Data Dictionary
- Write `data-generator/SCHEMA.md` satisfying `05_BACKEND_SCHEMA.md` in full — every field, every relationship, every cardinality.
- **Done when:** schema doc fully describes all 10 entities and every FK relationship with cardinality stated explicitly.

## Phase 2 — ID Scheme & Master Data
- Implement ID formats exactly (`02_TRD.md` §3). Build a format validator that fails the build on drift.
- Generate: `Warehouse` → `Zone` (nested, realistic distribution — not flat 10/10) → `Sensor` (placed in zones) → `StorageRequirement`.
- **Done when:** 10 warehouses, 100 zones, 500 sensors exist with valid IDs and FKs resolving correctly.

## Phase 3 — Transactional / Event Data
In order, using only valid parent IDs:
1. `InventoryLot` (10,000) — zone + storage requirement + dwell window.
2. `SensorReading` (1,000,000) — time series respecting each zone's baseline, realistic noise.
3. `DoorEvent` — open/close pairs with duration.
4. Inject localized excursions (bounded time window, specific zone) and genuine sensor outages (real gaps, not zero/null).
5. `Alarm` — generated from documented thresholds, linked to zone + sensor + overlapping lots.
6. `Inspection` / `Remediation` — follow-ups against triggered alarms with realistic lag.
- State changes append new rows; nothing overwritten in place.
- **Done when:** volumes match targets, every alarm traces to its firing rule and affected lot(s), timestamp ordering is valid everywhere.

## Phase 4 — Ground Truth & Required Edge Cases
- Produce `ground_truth.csv`/`.json`, kept separate from feature data.
- Inject the four required edge cases from `05_BACKEND_SCHEMA.md` §7, each tagged with `issue_type` + `ground_truth`.
- **Done when:** ground truth file lists every injected case with a stable ID, issue type, and expected correct outcome.

## Phase 5 — Validation & Reproducibility
- Build the validation suite from `02_TRD.md` §6 (PK/FK/enum/date/reconciliation/lifecycle/duplicates).
- Build `verify_reproducibility.py`: run generator twice with seed `20261022`, diff row counts + checksums.
- Export CSV + JSON + SQL seed + `README.md` + `SCHEMA.md` + validation summary.
- **Done when:** validator exits 0 on fresh generation; reproducibility script confirms identical checksums across two runs.

## Phase 6 — Backend API
- FastAPI, read-only, filterable + paginated endpoints per entity.
- Loads from generator output into SQLite on startup.
- **Done when:** every entity has an endpoint, and the 1M-row `SensorReading` table can be queried by zone/time range without shipping the full table.

## Phase 7 — Dashboard (Frontend)
- Invoke `/ui-styling` and `/ui-ux-pro-max` before writing components — see `04_UIUX_DESIGN_BRIEF.md`.
- Build the 5 screens from `03_APP_FLOW.md` §3: Warehouse Overview, Zone Detail, Alarm Center, Inspection/Remediation Tracker, Ground Truth/QA view.
- **Done when:** all 5 screens work against live backend data, remain responsive at full dataset scale, and meet the design bar in `04_UIUX_DESIGN_BRIEF.md` §1.

## Final Deliverable Checklist
- [ ] `SCHEMA.md` — complete data dictionary
- [ ] Generator code, seeded at `20261022`, `--scale` flag supported
- [ ] CSV + JSON + SQL exports
- [ ] `ground_truth.csv`/`.json`, separate from feature data
- [ ] Validation suite — passing
- [ ] Reproducibility script — matching checksums across two runs
- [ ] `README.md` — generator command, seed, scale params, regeneration steps
- [ ] FastAPI backend serving the dataset
- [ ] Dashboard — all 5 views, built with the two design skills
- [ ] `DECISIONS.md` — every assumption logged

## Notes
- No API keys, no external services, anywhere in this project — confirmed in `01_PRD.md` §3.
- If a volume target is heavy for local dev, use the `--scale` flag rather than writing a second generator.
