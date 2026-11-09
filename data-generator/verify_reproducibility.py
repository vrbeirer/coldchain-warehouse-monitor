import hashlib
import json
import tempfile
from pathlib import Path
from generate import make_dataset


def fingerprint(data):
    return {key: hashlib.sha256(json.dumps(value, sort_keys=True).encode()).hexdigest() for key, value in data.items()}


first, _ = make_dataset(0.01)
second, _ = make_dataset(0.01)
assert fingerprint(first) == fingerprint(second)
print("reproducibility: PASS")
