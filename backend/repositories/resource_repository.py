"""Repository layer: all raw SQL / ORM access for resources.

The atomic conditional UPDATE lives here and is the anchor of the
no-double-booking guarantee.
"""
from typing import List, Optional

from sqlalchemy import select, update
from sqlalchemy.orm import Session

from backend.models.db_models import Resource, utcnow


def list_resources(db: Session) -> List[Resource]:
    return list(db.scalars(select(Resource).order_by(Resource.type, Resource.name)))


def list_available(db: Session) -> List[Resource]:
    stmt = (
        select(Resource)
        .where(Resource.status == "available")
        .order_by(Resource.type, Resource.name)
    )
    return list(db.scalars(stmt))


def first_available(db: Session, resource_type: str) -> Optional[Resource]:
    stmt = (
        select(Resource)
        .where(Resource.status == "available", Resource.type == resource_type)
        .order_by(Resource.name)
        .limit(1)
    )
    return db.scalars(stmt).first()


def get_resource(db: Session, resource_id: int) -> Optional[Resource]:
    return db.get(Resource, resource_id)


def try_commit(db: Session, resource_id: int) -> bool:
    """Atomic conditional commit. Returns True iff exactly one row changed.

    This is a single statement (no check-then-update), so two concurrent
    requests can never both see 'available' and both commit.
    """
    stmt = (
        update(Resource)
        .where(Resource.id == resource_id, Resource.status == "available")
        .values(
            status="committed",
            version=Resource.version + 1,
            updated_at=utcnow(),
        )
    )
    result = db.execute(stmt)
    return result.rowcount == 1


def try_release(db: Session, resource_id: int) -> bool:
    """Atomic conditional release (committed -> available)."""
    stmt = (
        update(Resource)
        .where(Resource.id == resource_id, Resource.status == "committed")
        .values(
            status="available",
            version=Resource.version + 1,
            updated_at=utcnow(),
        )
    )
    result = db.execute(stmt)
    return result.rowcount == 1
