"""Domain layer: bed classification and care-path transfer rules.

Beds are typed by their name prefix (`ICU B...` vs `Ward B...`), which is how
the rest of the system already distinguishes them (see `seed.py`).

Care path:
    ward bed  -> discharge only
    ICU bed   -> discharge, or step down to a ward bed
    theatre   -> step down to an ICU bed
"""
from typing import Optional

from backend.models.db_models import Resource


def bed_kind(resource: Resource) -> Optional[str]:
    """Return "icu" | "ward" for bed resources, otherwise None."""
    if resource.type != "bed":
        return None
    return "icu" if resource.name.strip().lower().startswith("icu") else "ward"


def transfer_target_kind(source: Resource) -> Optional[str]:
    """The bed kind a patient must move to when stepping down from `source`.

    Returns None for resources that can only be discharged (e.g. ward beds).
    """
    if source.type == "theatre":
        return "icu"
    if source.type == "bed" and bed_kind(source) == "icu":
        return "ward"
    return None


def is_valid_transfer_target(source: Resource, target: Resource) -> bool:
    kind = transfer_target_kind(source)
    return kind is not None and target.type == "bed" and bed_kind(target) == kind
