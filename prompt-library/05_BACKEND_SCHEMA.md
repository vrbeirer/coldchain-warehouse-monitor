# Backend Schema — Data Dictionary

Write this out fully as `data-generator/SCHEMA.md` during Phase 1 of the implementation plan — this file sets the required shape; the generated schema doc must satisfy it.

## 1. Entities
`Warehouse`, `Zone`, `Sensor`, `SensorReading`, `DoorEvent`, `InventoryLot`, `StorageRequirement`, `Alarm`, `Inspection`, `Remediation`.

For **every field on every entity**, document: type, required/optional, allowed values, units, uniqueness, validation rule. For **every relationship**, document: cardinality (1:1 / 1:N / N:M), optional vs required, effective dates, lifecycle states.

## 2. Relationship Rules
- `Warehouse` 1:N `Zone`
- `Zone` 1:N `Sensor` — but a sensor serving multiple zones over time must use a **bridge table** (effective-dated rows), never a denormalized multi-value field. Any such mapping without a documented rationale is a flagged edge case, not a quiet feature.
- `Zone` 1:N `StorageRequirement` (per product/lot type — cold-chain vs ambient, etc.)
- `Zone` 1:N `InventoryLot` (a lot is stored in a zone for a dwell window)
- `Sensor` 1:N `SensorReading`
- `Zone` 1:N `DoorEvent`
- `Alarm` N:M `InventoryLot` (an alarm can affect multiple lots; a lot can be affected by multiple alarms) — use a bridge table
- `Alarm` 1:N `Inspection`
- `Inspection` 1:N `Remediation` (0 or more — not every inspection finds something to remediate)

## 3. ID Scheme (see `02_TRD.md` §3 for full rules)
- `WH-001`
- `ZONE-<warehouse-id>-001`
- `SNS-<zone-id>-TEMP-01`
- `RDG-<sensor-id>-<timestamp>`
- `LOT-2026-000001`

## 4. Lifecycle States to Model
- **Zone**: active / under-maintenance / decommissioned
- **Sensor**: active / outage / decommissioned
- **InventoryLot**: in-storage / moved / shipped
- **Alarm**: open / acknowledged / closed
- **Inspection**: scheduled / in-progress / completed
- **Remediation**: pending / in-progress / resolved

Transitions must follow a legal order (e.g. an `Alarm` can't go `closed → open` without a genuinely new event; a `Remediation` can't be `resolved` before its `Inspection` is `completed`).

## 5. Derived Values (must be calculated, never independently generated)
- `InventoryLot.dwell_time` = departure_timestamp − arrival_timestamp
- `DoorEvent.duration` = close_timestamp − open_timestamp
- Any zone-level aggregate (avg temp, alarm count) = computed from underlying readings/alarms, not hardcoded

## 6. Ground Truth / Edge Case Fields
Every injected anomaly carries two explicit columns on its record:
- `issue_type` (e.g. `incompatible_zone_assignment`, `unlinked_alarm`, `sensor_outage_misread`, `unrationalized_multi_zone_sensor`)
- `ground_truth` (the correct label/decision for that record)

These two columns live in `ground_truth.csv`/`.json`, kept separate from the feature tables — never merged in, never used as a model input.

## 7. Required Edge Cases (minimum set)
1. Lot assigned to an incompatible zone (e.g. frozen goods in an ambient zone)
2. Sensor mapped to multiple zones with no documented rationale
3. A reading gap that naive logic would misread as "holding steady" but is actually an outage
4. An alarm that exists but isn't correctly linked to the inventory lots it should affect
