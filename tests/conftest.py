"""Test configuration: point the app at a throwaway SQLite file.

This runs before any backend module is imported, so backend.database picks
up the test path instead of the real hospital.db.
"""
import os
import tempfile
from pathlib import Path

_TEST_DB = Path(tempfile.gettempdir()) / "hospital_test.db"
for _suffix in ("", "-wal", "-shm"):
    _p = Path(str(_TEST_DB) + _suffix)
    if _p.exists():
        _p.unlink()

os.environ["HOSPITAL_DB_PATH"] = str(_TEST_DB)
