SEED = 20261022
TARGETS = {
    "warehouses": 10,
    "zones": 100,
    "sensors": 500,
    "readings": 1_000_000,
    "lots": 10_000,
}

ZONE_STATES = ["active", "under-maintenance", "decommissioned"]
SENSOR_STATES = ["active", "outage", "decommissioned"]
LOT_STATES = ["in-storage", "moved", "shipped"]
ALARM_STATES = ["open", "acknowledged", "closed"]
SEVERITIES = ["critical", "high", "medium", "low"]
