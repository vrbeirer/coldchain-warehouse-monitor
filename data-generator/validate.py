from __future__ import annotations
import csv
from pathlib import Path

ROOT = Path(__file__).resolve().parent / "output" / "csv"


def rows(name: str) -> list[dict]:
    with (ROOT / f"{name}.csv").open(encoding="utf-8", newline="") as handle:
        return list(csv.DictReader(handle))


def main() -> None:
    warehouses, zones, sensors = rows("warehouses"), rows("zones"), rows("sensors")
    assert len({r["warehouse_id"] for r in warehouses}) == len(warehouses)
    warehouse_ids = {r["warehouse_id"] for r in warehouses}
    zone_ids = {r["zone_id"] for r in zones}
    assert all(r["warehouse_id"] in warehouse_ids for r in zones)
    assert all(r["zone_id"] in zone_ids for r in sensors)
    for name in ["inventory_lots", "sensor_readings", "door_events", "alarms", "inspections", "remediations"]:
        assert len(rows(name)) == len({str(r) for r in rows(name)})
    print("validation: PASS")


if __name__ == "__main__":
    main()
