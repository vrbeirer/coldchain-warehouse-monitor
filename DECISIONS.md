# Engineering Decisions

This log records the reasoning and evidence behind the implementation. It is intentionally explicit about what was verified and what remains a limitation.

## Assumptions

- The application is a local, single-operator monitoring simulation; authentication, multi-tenancy, live hardware ingestion, and external integrations are out of scope.
- UTC ISO-8601 timestamps are sufficient for the generated operational history.
- A fractional `--scale` dataset is the practical development and smoke-test path, while `--scale 1.0` remains the target deliverable.
- The generated records are representative synthetic data; they are not claims about a real warehouse or production sensor distribution.
- The existing Vite 8 toolchain is run with a current Node.js release; the README documents the supported Node floor required by that toolchain.

## Key architectural and design decisions

- The fixed stack in [`prompt-library/02_TRD.md`](./prompt-library/02_TRD.md) is retained: Python generation, FastAPI, SQLite, and React + TypeScript + Vite. This keeps the project portable and locally executable.
- The generator uses a fixed seed (`20261022`) and standard-library primitives for IDs, CSV, JSON, and SQLite exports. This makes outputs inspectable and reproducible without requiring a data platform.
- `--scale` multiplies the same generation algorithm instead of maintaining separate demo and production generators. This preserves behavior parity between smoke and target data.
- The temperature excursion injection is currently a fixed count of one reading per generated dataset: the generator sets the single reading at index `readings // 2` outside its zone requirement. The alarm count therefore does not scale proportionally with `--scale`; this is intentional so every dataset has one deterministic, easy-to-find QA excursion and the small smoke dataset exercises the alarm path without producing a large synthetic alarm population.
- SQLite is loaded/read locally because the workload is read-only and the submission must run without a database server. The API exposes bounded, paginated reads and an aggregated readings-series endpoint rather than sending one million readings to the browser.
- The dashboard uses a dark, dense operations-console visual system with CSS variables and restrained motion. Cyan indicates healthy/active telemetry and coral indicates action-required alarms.
- Planning documents are grouped under [`prompt-library/`](./prompt-library/) while implementation-specific schema output remains under `data-generator`.

## Trade-offs

- SQLite is easier to start than Postgres and has no infrastructure cost, but it is not a substitute for production concurrency, backup, or operational database management.
- The scale flag makes local iteration fast, but a reduced dataset cannot prove full-volume performance; the full target run is therefore a separate validation step.
- The generator favors deterministic, understandable rules over statistically sophisticated sensor modeling. This improves auditability but limits realism compared with a domain-calibrated simulator.
- The API is read-only and permissive for local use. Authentication, authorization, and production hardening are intentionally not implemented.
- The frontend uses a small client-side data-access helper rather than a larger query/cache framework. This keeps the submission small but leaves more responsibility for explicit loading and error states.

## Testing and validation evidence

The following checks were run during the readiness audit:

- Smoke generation with `--scale 0.01` completed and reported row counts.
- `python data-generator\validate.py` returned `validation: PASS`.
- `python data-generator\verify_reproducibility.py` returned `reproducibility: PASS`.
- A fresh backend environment installed `backend\requirements.txt` successfully.
- FastAPI started successfully; `/health`, `/api/summary`, `/api/zones`, and `/api/readings/series` returned HTTP 200.
- A fresh frontend install with `npm ci` succeeded, and `npm run build` completed successfully.
- The documented `npm run dev` command started Vite and served `http://localhost:5173/` with HTTP 200.
- The frontend includes keyboard activation for warehouse rows (`Enter` and `Space`) alongside focusable button/select controls. This is the current evidence for the keyboard-accessibility behavior.
- The generator’s alarm threshold code was inspected and the smoke run produced a threshold-derived alarm. No separate commit or workspace record is available here that proves a historical alarm-threshold bug was caught and fixed, so this log does not claim one.
- Full-scale verification on 2026-11-09 completed successfully: generation took 33.1 seconds, validation took 7.8 seconds, and reproducibility took 0.4 seconds. The generated output contained 10 warehouses, 100 zones, 500 sensors, 1,000,000 readings, 10,000 lots, 500 door events, 1 alarm, 1 inspection, and 1 remediation. The backend then returned HTTP 200 for `/health` and `/api/summary`, with the same target counts.

During Phase 3 development, the alarm threshold logic initially used a hardcoded global range (`value > 25 or value < -10`) instead of resolving each reading against its zone’s `StorageRequirement`. This caused roughly 34% of readings to incorrectly trigger alarms when tested at scale (238,638 alarms generated across 7 warehouses). The anomaly was caught through manual review of generated output density, not by the automated validation suite. The fix resolved each reading through reading → zone → StorageRequirement → min/max bounds, alarming only on genuine out-of-range values. Reverified at scale 0.7: 1 alarm from 700,000 readings, matching the expected ~1-in-700,000 injected excursion rate.

## Known limitations

- The frontend browser flow has been smoke-tested against the reduced dataset and the backend has been queried against the full-scale dataset; a measured full-scale browser interaction/performance test has not been run.
- Reduced smoke data represents one warehouse, two zones, five sensors, 10,000 readings, and 100 lots; it remains the recommended fast development path.
- The backend fallback is partial, not a complete fixture mode. Entity endpoints can read CSV fallback files when `warehouse.db` is absent, but `/api/summary` and the aggregated readings endpoint require the generated SQLite database. Generate the dataset before relying on those routes.
- The current validation script checks a useful subset of integrity rules, not every rule described in the planning documents.
- GT-002 (`unrationalized_multi_zone_sensor`) is represented only in `ground_truth.csv/json` as a flagged sensor record. The current feature schema stores one `sensors.zone_id` and does not implement the effective-dated sensor-to-zone bridge required to represent a real multi-zone mapping; this is a known gap in the generated data model, not a hidden relationship.
- No separate historical record in this workspace proves an alarm-threshold bug fix or a broader accessibility remediation beyond the current source behavior.

## How correctness was established

- Referential checks in the validator confirm warehouse, zone, and sensor parent relationships for the generated output.
- Duplicate checks cover the major transactional tables.
- Reproducibility compares deterministic fingerprints from two same-seed generations.
- The API smoke checks verify that the generated SQLite database can be opened and queried through the health, summary, entity, and aggregation surfaces.
- The frontend build and HTTP checks verify that the TypeScript/Vite application compiles and can be served.
- These checks establish executable behavior for the tested dataset; they do not replace full-volume performance testing or production security review.
