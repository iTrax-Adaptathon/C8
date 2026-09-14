"""Database engine, session factory and Base for the hospital platform.

SQLite is used deliberately: it serialises writes, which makes the
"no double-booking" guarantee simple to trust.  WAL mode is enabled so
reads (polling dashboard) never block a concurrent allocation write.
"""
import os
from pathlib import Path

from sqlalchemy import create_engine, event
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


def drop_db() -> None:
    """Drop all tables (used by seed.py and tests)."""
    from backend.models import db_models  # noqa: F401

    Base.metadata.drop_all(bind=engine)


def get_db():
    """FastAPI dependency that yields a scoped session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
