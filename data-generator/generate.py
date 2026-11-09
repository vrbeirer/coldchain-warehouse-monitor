"""Seeded warehouse monitoring dataset generator."""
from __future__ import annotations

import argparse
import csv
import hashlib
import json
import random
import sqlite3
from datetime import datetime, timedelta, timezone
from pathlib import Path

from config import SEED, TARGETS

ROOT = Path(__file__).resolve().parent


def iso(value: datetime) -> str:
    return value.replace(tzinfo=timezone.utc).isoformat()


def write_rows(path: Path, rows: list[dict]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    if not rows:
        path.write_text("")
        return
    with path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(rows[0]))
        writer.writeheader()
        writer.writerows(rows)


def make_dataset(scale: float) -> tuple[dict[str, list[dict]], list[dict]]:
    rng = random.Random(SEED)
    warehouses = max(1, round(TARGETS["warehouses"] * scale))
    zones = max(2, round(TARGETS["zones"] * scale))
    sensors = max(4, round(TARGETS["sensors"] * scale))
    lots = max(20, round(TARGETS["lots"] * scale))
    readings = max(100, round(TARGETS["readings"] * scale))
    now = datetime(2026, 10, 22, 12, 0)

    warehouse_names = ["PATIL North Distribution", "PATIL East Cold Store", "PATIL South Fulfillment", "PATIL West Reserve"]
    warehouse_rows = [
        {"warehouse_id": f"WH-{i:03d}", "name": f"{warehouse_names[(i - 1) % len(warehouse_names)]} {i:02d}", "region": ["NE", "SE", "MW", "SW"][i % 4], "status": "active"}
        for i in range(1, warehouses + 1)
    ]
    zone_rows = []
    for i in range(1, zones + 1):
        wh = warehouse_rows[(i * 7) % warehouses]["warehouse_id"]
        zone_rows.append({"zone_id": f"ZONE-{wh}-{i:03d}", "warehouse_id": wh, "name": f"Zone {i:03d}", "zone_type": "cold-chain" if i % 3 == 0 else "ambient", "state": "active" if i % 19 else "under-maintenance", "baseline_temp_c": -18.0 if i % 3 == 0 else 20.0, "baseline_humidity_pct": 45.0 if i % 3 == 0 else 52.0})
    sensor_rows = []
    sensor_types = ["TEMP", "HUM", "OCC", "DOOR"]
    for i in range(1, sensors + 1):
        zone = zone_rows[((i - 1) * 11) % len(zone_rows)]
        kind = sensor_types[(i - 1) % len(sensor_types)]
        sensor_rows.append({"sensor_id": f"SNS-{zone['zone_id']}-{kind}-{((i - 1) // 4) + 1:02d}", "zone_id": zone["zone_id"], "sensor_type": kind, "state": "outage" if i % 97 == 0 else "active", "expected_interval_seconds": 300})
    requirement_rows = []
    requirements_by_zone: dict[str, dict] = {}
    for zone in zone_rows:
        cold = zone["zone_type"] == "cold-chain"
        requirement = {"requirement_id": f"REQ-{zone['zone_id']}-01", "zone_id": zone["zone_id"], "product_type": "frozen" if cold else "ambient", "min_temp_c": -25 if cold else 15, "max_temp_c": -12 if cold else 25, "min_humidity_pct": 30, "max_humidity_pct": 70}
        requirement_rows.append(requirement)
        requirements_by_zone[zone["zone_id"]] = requirement
    lot_rows = []
    for i in range(1, lots + 1):
        zone = zone_rows[(i * 13) % len(zone_rows)]
        arrival = now - timedelta(days=rng.randint(1, 45), hours=rng.randint(0, 23))
        departure = arrival + timedelta(hours=rng.randint(12, 240))
        lot_rows.append({"lot_id": f"LOT-2026-{i:06d}", "zone_id": zone["zone_id"], "requirement_id": f"REQ-{zone['zone_id']}-01", "product_type": "frozen" if zone["zone_type"] == "cold-chain" else "ambient", "arrival_timestamp": iso(arrival), "departure_timestamp": iso(departure), "dwell_time_hours": round((departure - arrival).total_seconds() / 3600, 2), "state": "in-storage" if departure > now else "shipped"})

    reading_rows = []
    temp_sensors = [s for s in sensor_rows if s["sensor_type"] == "TEMP"]
    step = max(1, readings // max(1, len(temp_sensors)))
    for i in range(readings):
        sensor = temp_sensors[i % len(temp_sensors)]
        zone = next(z for z in zone_rows if z["zone_id"] == sensor["zone_id"])
        timestamp = now - timedelta(minutes=(readings - i) * 5)
        value = float(zone["baseline_temp_c"]) + (rng.random() - 0.5) * 1.8
        if i == readings // 2:
            value = float(zone["baseline_temp_c"]) + 15
        reading_rows.append({"reading_id": f"RDG-{sensor['sensor_id']}-{timestamp.strftime('%Y%m%dT%H%M')}", "sensor_id": sensor["sensor_id"], "zone_id": zone["zone_id"], "timestamp": iso(timestamp), "value": round(value, 2), "unit": "C"})

    door_rows = []
    door_zones = [z for z in zone_rows if any(s["zone_id"] == z["zone_id"] and s["sensor_type"] == "DOOR" for s in sensor_rows)] or zone_rows
    for i in range(max(4, round(500 * scale))):
        zone = door_zones[i % len(door_zones)]
        opened = now - timedelta(hours=i % 240)
        closed = opened + timedelta(minutes=3 + (i % 38))
        door_sensor = next(s["sensor_id"] for s in sensor_rows if s["zone_id"] == zone["zone_id"] and s["sensor_type"] == "DOOR")
        door_rows.append({"door_event_id": f"DOOR-{i + 1:06d}", "zone_id": zone["zone_id"], "sensor_id": door_sensor, "open_timestamp": iso(opened), "close_timestamp": iso(closed), "duration_seconds": int((closed - opened).total_seconds())})

    alarm_rows, link_rows = [], []
    for i, reading in enumerate(reading_rows):
        requirement = requirements_by_zone[reading["zone_id"]]
        value = float(reading["value"])
        if value < float(requirement["min_temp_c"]) or value > float(requirement["max_temp_c"]):
            alarm_id = f"ALM-{i + 1:06d}"
            severity = "critical" if abs(float(reading["value"])) > 30 else "high"
            alarm_rows.append({"alarm_id": alarm_id, "zone_id": reading["zone_id"], "sensor_id": reading["sensor_id"], "reading_id": reading["reading_id"], "rule_code": "TEMP_OUT_OF_RANGE", "severity": severity, "state": "open", "triggered_at": reading["timestamp"], "summary": "Temperature outside storage requirement"})
            matching = [l for l in lot_rows if l["zone_id"] == reading["zone_id"]][:3]
            for lot in matching:
                link_rows.append({"alarm_id": alarm_id, "lot_id": lot["lot_id"]})
            if alarm_rows[-1]["alarm_id"] == "ALM-000001":
                link_rows = []

    inspection_rows, remediation_rows = [], []
    for i, alarm in enumerate(alarm_rows):
        inspected = datetime.fromisoformat(alarm["triggered_at"]) + timedelta(hours=4)
        inspection_id = f"INSP-{i + 1:06d}"
        inspection_rows.append({"inspection_id": inspection_id, "alarm_id": alarm["alarm_id"], "status": "completed", "scheduled_at": iso(inspected), "completed_at": iso(inspected + timedelta(hours=2)), "finding": "Confirmed excursion"})
        remediation_rows.append({"remediation_id": f"REM-{i + 1:06d}", "inspection_id": inspection_id, "status": "resolved", "opened_at": iso(inspected + timedelta(hours=2)), "resolved_at": iso(inspected + timedelta(days=1)), "action": "Adjusted refrigeration set point"})

    data = {"warehouses": warehouse_rows, "zones": zone_rows, "sensors": sensor_rows, "storage_requirements": requirement_rows, "inventory_lots": lot_rows, "sensor_readings": reading_rows, "door_events": door_rows, "alarms": alarm_rows, "alarm_lots": link_rows, "inspections": inspection_rows, "remediations": remediation_rows}
    ground_truth = [
        {"case_id": "GT-001", "record_id": lot_rows[0]["lot_id"], "issue_type": "incompatible_zone_assignment", "ground_truth": "Frozen goods must not be stored in ambient zone"},
        {"case_id": "GT-002", "record_id": sensor_rows[0]["sensor_id"], "issue_type": "unrationalized_multi_zone_sensor", "ground_truth": "Effective-dated bridge rationale required"},
        {"case_id": "GT-003", "record_id": temp_sensors[0]["sensor_id"], "issue_type": "sensor_outage_misread", "ground_truth": "Gap is an outage, not a steady value"},
        {"case_id": "GT-004", "record_id": alarm_rows[0]["alarm_id"] if alarm_rows else "ALM-000001", "issue_type": "unlinked_alarm", "ground_truth": "Alarm must link every overlapping lot"},
    ]
    return data, ground_truth


def export_sql(data: dict[str, list[dict]], ground_truth: list[dict], path: Path) -> None:
    if path.exists():
        path.unlink()
    connection = sqlite3.connect(path)
    for name, rows in {**data, "ground_truth": ground_truth}.items():
        if not rows:
            continue
        columns = list(rows[0])
        connection.execute(f"CREATE TABLE IF NOT EXISTS {name} ({', '.join(f'{c} TEXT' for c in columns)})")
        connection.executemany(f"INSERT INTO {name} ({','.join(columns)}) VALUES ({','.join('?' for _ in columns)})", [[str(row[c]) for c in columns] for row in rows])
    connection.commit()
    connection.close()


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--scale", type=float, default=0.01)
    parser.add_argument("--output", type=Path, default=ROOT / "output")
    args = parser.parse_args()
    data, truth = make_dataset(args.scale)
    for name, rows in data.items():
        write_rows(args.output / "csv" / f"{name}.csv", rows)
        (args.output / "json").mkdir(parents=True, exist_ok=True)
        (args.output / "json" / f"{name}.json").write_text(json.dumps(rows, indent=2))
    write_rows(args.output / "ground_truth.csv", truth)
    (args.output / "ground_truth.json").write_text(json.dumps(truth, indent=2))
    export_sql(data, truth, args.output / "warehouse.db")
    checksums = {name: hashlib.sha256(json.dumps(rows, sort_keys=True).encode()).hexdigest() for name, rows in data.items()}
    (args.output / "validation_summary.json").write_text(json.dumps({"seed": SEED, "scale": args.scale, "row_counts": {k: len(v) for k, v in data.items()}, "checksums": checksums}, indent=2))
    print(json.dumps({"output": str(args.output), "row_counts": {k: len(v) for k, v in data.items()}}, indent=2))


if __name__ == "__main__":
    main()
