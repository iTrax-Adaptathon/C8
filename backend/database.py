"""Database engine, session factory and Base for the hospital platform.

SQLite is used deliberately: it serialises writes, which makes the
"no double-booking" guarantee simple to trust.  WAL mode is enabled so
reads (polling dashboard) never block a concurrent allocation write.
"""
import os
from pathlib import Path

from sqlalchemy import create_engine, event, inspect, text
from sqlalchemy.orm import declarative_base, sessionmaker

try:  # optional: pick up HOSPITAL_DB_PATH / DATABASE_URL from a local .env
    from dotenv import load_dotenv

    load_dotenv()
except ImportError:  # pragma: no cover
    pass

BASE_DIR = Path(__file__).resolve().parent
DEFAULT_DB_PATH = BASE_DIR / "hospital.db"

# Override with HOSPITAL_DB_PATH (see .env.example).
DB_PATH = os.getenv("HOSPITAL_DB_PATH", str(DEFAULT_DB_PATH))
DATABASE_URL = os.getenv("DATABASE_URL", f"sqlite:///{DB_PATH}")

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False, "timeout": 30},
    future=True,
)


@event.listens_for(engine, "connect")
def _set_sqlite_pragma(dbapi_connection, _connection_record):
    """Enable WAL, foreign keys and a busy timeout on every connection."""
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA journal_mode=WAL")
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.execute("PRAGMA busy_timeout=30000")
    cursor.close()


SessionLocal = sessionmaker(
    bind=engine, autoflush=False, autocommit=False, future=True
)
Base = declarative_base()


def init_db() -> None:
    """Create all tables if they do not exist (idempotent)."""
    from backend.models import db_models  # noqa: F401  (register mappings)

    Base.metadata.create_all(bind=engine)
    _upgrade_existing_schema()


def _upgrade_existing_schema() -> None:
    """Add fields introduced after the original MVP without replacing user data."""
    additions = {
        "patients": {
            "age": "INTEGER",
            "estimated_treatment_minutes": "INTEGER",
            "created_at": "DATETIME",
            "updated_at": "DATETIME",
        },
        "ambulances": {"patient_name": "VARCHAR(120)"},
        "events": {
            "previous_state": "VARCHAR(80)",
            "new_state": "VARCHAR(80)",
            "actor": "VARCHAR(120)",
        },
    }
    with engine.begin() as conn:
        inspector = inspect(conn)
        for table, columns in additions.items():
            existing = {column["name"] for column in inspector.get_columns(table)}
            for name, definition in columns.items():
                if name not in existing:
                    conn.execute(text(f'ALTER TABLE {table} ADD COLUMN "{name}" {definition}'))
                    if table == "patients" and name in {"created_at", "updated_at"}:
                        conn.execute(
                            text(f'UPDATE patients SET "{name}" = CURRENT_TIMESTAMP WHERE "{name}" IS NULL')
                        )


def drop_db() -> None:
    """Drop all tables (used by seed.py and tests)."""
    from backend.models import db_models  # noqa: F401

    with engine.begin() as conn:
        conn.exec_driver_sql("PRAGMA foreign_keys=OFF")
        Base.metadata.drop_all(bind=conn)
        conn.exec_driver_sql("PRAGMA foreign_keys=ON")


def get_db():
    """FastAPI dependency that yields a scoped session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
