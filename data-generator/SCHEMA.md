# Warehouse Monitoring Schema

All timestamps are UTC ISO-8601 strings. IDs are immutable, required, unique primary keys unless noted.

## Entities

| Entity | Fields (type; required; units/allowed values; validation) |
|---|---|
| Warehouse | `warehouse_id` string; yes; `WH-###`; unique; `name` string; yes; non-empty; `region` enum string; yes; NE/SE/MW/SW; `status` enum; yes; active |
| Zone | `zone_id` string; yes; `ZONE-WH-###-###`; unique; `warehouse_id` FK; yes; existing Warehouse; `name` string; yes; `zone_type` enum; yes; cold-chain/ambient; `state` enum; yes; active/under-maintenance/decommissioned; baseline temperatures numeric °C and humidity numeric % |
| Sensor | `sensor_id` string; yes; `SNS-<zone>-<type>-##`; unique; `zone_id` FK; yes; existing Zone; `sensor_type` enum TEMP/HUM/OCC/DOOR; `state` enum active/outage/decommissioned; `expected_interval_seconds` positive integer |
| SensorReading | `reading_id` string; yes; `RDG-<sensor>-<timestamp>`; unique; `sensor_id` and `zone_id` FKs; yes; timestamp; yes; value numeric with unit; no nulls |
| DoorEvent | `door_event_id` string; yes; unique; `zone_id` and DOOR `sensor_id` FKs; timestamps required; `duration_seconds` derived non-negative integer |
| InventoryLot | `lot_id` string; yes; `LOT-2026-######`; unique; `zone_id` and `requirement_id` FKs; product_type enum frozen/ambient; arrival/departure required and arrival < departure; dwell_time_hours derived |
| StorageRequirement | `requirement_id` string; yes; unique; `zone_id` FK; product_type enum; min/max temperature °C and humidity %; min <= max |
| Alarm | `alarm_id` string; yes; unique; zone/sensor/reading FKs; `rule_code` required and documented; severity critical/high/medium/low; state open/acknowledged/closed; triggered_at required |
| Inspection | `inspection_id` string; yes; unique; `alarm_id` FK; status scheduled/in-progress/completed; scheduled/completed timestamps; completion after schedule |
| Remediation | `remediation_id` string; yes; unique; `inspection_id` FK; status pending/in-progress/resolved; opened/resolved timestamps; resolved only after completed inspection |

## Relationships and lifecycle

- Warehouse 1:N Zone (required parent; Zone cannot outlive its Warehouse).
- Zone 1:N Sensor and Zone 1:N StorageRequirement (required parent; effective for the zone lifetime).
- Zone 1:N InventoryLot; each lot has one zone during its dwell window.
- Sensor 1:N SensorReading and Zone 1:N DoorEvent.
- Sensor-to-zone reassignment is represented by an effective-dated bridge table in future full exports; it is never a multi-value field.
- Alarm N:M InventoryLot through `alarm_lots` (`alarm_id`, `lot_id`), both required.
- Alarm 1:N Inspection; Inspection 1:N Remediation (zero or more remediations).
- Legal transitions are append-only: Zone/Sensor may decommission; Lot in-storage → moved → shipped; Alarm open → acknowledged → closed; Inspection scheduled → in-progress → completed; Remediation pending → in-progress → resolved.

## Derived and QA fields

`dwell_time_hours = departure_timestamp - arrival_timestamp`; `duration_seconds = close_timestamp - open_timestamp`; all aggregates are computed from source rows. `ground_truth.csv/json` contains `case_id`, `record_id`, `issue_type`, and `ground_truth` only and is never joined into feature tables.
