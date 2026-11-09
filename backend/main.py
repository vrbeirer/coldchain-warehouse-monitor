from __future__ import annotations

import csv
import os
import sqlite3
from pathlib import Path
from typing import Any

from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware

ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = Path(os.getenv("WAREHOUSE_DATA_DIR", str(ROOT / "data-generator" / "output")))
DB_PATH = DATA_DIR / "warehouse.db"
app = FastAPI(title="Warehouse Zone Monitoring API", version="1.0.0")
app.add_middleware(CORSMiddleware, allow_origins=["http://localhost:5173"], allow_methods=["*"], allow_headers=["*"])

TABLES = {
    "warehouses": "warehouses", "zones": "zones", "sensors": "sensors",
    "readings": "sensor_readings", "door-events": "door_events",
    "storage-requirements": "storage_requirements", "alarms": "alarms",
    "alarm-lots": "alarm_lots", "inspections": "inspections",
    "remediations": "remediations", "lots": "inventory_lots", "ground-truth": "ground_truth",
}


def load_rows(table: str, offset: int, limit: int, zone_id: str | None = None) -> list[dict[str, Any]]:
    if not DB_PATH.exists():
        csv_path = DATA_DIR / ("ground_truth.csv" if table == "ground_truth" else f"csv/{table}.csv")
        if not csv_path.exists():
            return []
        with csv_path.open(encoding="utf-8", newline="") as handle:
            rows = list(csv.DictReader(handle))
        if zone_id:
            rows = [row for row in rows if row.get("zone_id") == zone_id]
        return rows[offset:offset + limit]
    with sqlite3.connect(DB_PATH) as connection:
        connection.row_factory = sqlite3.Row
        query = f"SELECT * FROM {table}"
        parameters: list[Any] = []
        if zone_id:
            query += " WHERE zone_id = ?"
            parameters.append(zone_id)
        query += " LIMIT ? OFFSET ?"
        parameters.extend([limit, offset])
        return [dict(row) for row in connection.execute(query, parameters).fetchall()]


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok", "service": "warehouse-monitoring"}


@app.get("/api/summary")
async def summary() -> dict[str, int]:
    with sqlite3.connect(DB_PATH) as connection:
        return {name: int(connection.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0]) for name, table in TABLES.items() if name != "ground-truth"}


@app.get("/api/readings/series")
async def readings_series(
    zone_id: str = Query(..., min_length=1),
    page: int = Query(1, ge=1),
    page_size: int = Query(288, ge=1, le=1000),
    bucket_minutes: int = Query(5, ge=1, le=1440),
) -> dict[str, Any]:
    """Return bounded time buckets instead of shipping raw sensor readings."""
    if not DB_PATH.exists():
        return {"items": [], "page": page, "page_size": page_size, "bucket_minutes": bucket_minutes}
    offset = (page - 1) * page_size
    with sqlite3.connect(DB_PATH) as connection:
        connection.row_factory = sqlite3.Row
        rows = connection.execute(
            """SELECT
                strftime('%Y-%m-%dT%H:%M:00Z', timestamp,
                    printf('-%d minutes', CAST(strftime('%M', timestamp) AS INTEGER) % ?)
                ) AS bucket,
                ROUND(AVG(value), 2) AS average_value,
                ROUND(MIN(value), 2) AS minimum_value,
                ROUND(MAX(value), 2) AS maximum_value,
                COUNT(*) AS sample_count
            FROM sensor_readings
            WHERE zone_id = ?
            GROUP BY bucket
            ORDER BY bucket DESC
            LIMIT ? OFFSET ?""",
            (bucket_minutes, zone_id, page_size, offset),
        ).fetchall()
    return {"items": [dict(row) for row in reversed(rows)], "page": page, "page_size": page_size, "bucket_minutes": bucket_minutes}


def register_entity(name: str, table: str) -> None:
    async def endpoint(page: int = Query(1, ge=1), page_size: int = Query(50, ge=1, le=500), zone_id: str | None = None):
        return {"items": load_rows(table, (page - 1) * page_size, page_size, zone_id), "page": page, "page_size": page_size}
    endpoint.__name__ = f"get_{name.replace('-', '_')}"
    app.get(f"/api/{name}")(endpoint)


for entity, table in TABLES.items():
    register_entity(entity, table)
