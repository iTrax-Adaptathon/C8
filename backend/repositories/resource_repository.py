"""Repository layer: all raw SQL / ORM access for resources.

The atomic conditional UPDATE lives here and is the anchor of the
no-double-booking guarantee across available, reserved, and committed states.
"""
from typing import List, Optional

from sqlalchemy import or_, select, update
from sqlalchemy.orm import Session

from backend.models.db_models import Resource, utcnow


def list_resources(db: Session, resource_type: Optional[str] = None) -> List[Resource]:
    stmt = select(Resource)
    if resource_type:
        stmt = stmt.where(Resource.type == resource_type)
    return list(db.scalars(stmt.order_by(Resource.type, Resource.name)))


def list_available(db: Session, resource_type: Optional[str] = None) -> List[Resource]:
    stmt = select(Resource).where(Resource.status == "available")
    if resource_type:
        stmt = stmt.where(Resource.type == resource_type)
    return list(db.scalars(stmt.order_by(Resource.type, Resource.name)))


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


def try_reserve(db: Session, resource_id: int, patient_id: Optional[int] = None) -> bool:
    """Atomic conditional reservation: available -> reserved.

    Guarantees no two concurrent requests can reserve the same resource.
    """
    stmt = (
        update(Resource)
        .where(Resource.id == resource_id, Resource.status == "available")
        .values(
            status="reserved",
            reserved_for_patient_id=patient_id,
            version=Resource.version + 1,
            updated_at=utcnow(),
        )
    )
    result = db.execute(stmt)
    return result.rowcount == 1


def try_cancel_reservation(db: Session, resource_id: int, patient_id: Optional[int] = None) -> bool:
    """Atomic conditional cancellation: reserved -> available."""
    conditions = [Resource.id == resource_id, Resource.status == "reserved"]
    if patient_id is not None:
        conditions.append(Resource.reserved_for_patient_id == patient_id)

    stmt = (
        update(Resource)
        .where(*conditions)
        .values(
            status="available",
            reserved_for_patient_id=None,
            version=Resource.version + 1,
            updated_at=utcnow(),
        )
    )
    result = db.execute(stmt)
    return result.rowcount == 1


def try_commit(db: Session, resource_id: int, patient_id: Optional[int] = None) -> bool:
    """Atomic conditional commit.

    Commits from 'available', or from 'reserved' if reserved for this patient.
    Guarantees that a resource can never be double-booked.
    """
    if patient_id is not None:
        status_filter = or_(
            Resource.status == "available",
            (Resource.status == "reserved") & (Resource.reserved_for_patient_id == patient_id),
        )
    else:
        status_filter = or_(
            Resource.status == "available",
            Resource.status == "reserved",
        )

    stmt = (
        update(Resource)
        .where(Resource.id == resource_id, status_filter)
        .values(
            status="committed",
            version=Resource.version + 1,
            updated_at=utcnow(),
        )
    )
    result = db.execute(stmt)
    return result.rowcount == 1


def try_release(db: Session, resource_id: int) -> bool:
    """Atomic conditional release: committed/reserved -> available."""
    stmt = (
        update(Resource)
        .where(
            Resource.id == resource_id,
            or_(Resource.status == "committed", Resource.status == "reserved"),
        )
        .values(
            status="available",
            reserved_for_patient_id=None,
            version=Resource.version + 1,
            updated_at=utcnow(),
        )
    )
    result = db.execute(stmt)
    return result.rowcount == 1
