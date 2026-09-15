"""Business/domain layer: legal state transitions for patients and resources.

Patient:  en_route -> arrived -> waiting -> reserved -> admitted -> discharge_pending -> discharged
Resource: available <-> reserved -> committed -> available
"""
from typing import Tuple

PATIENT_TRANSITIONS: Tuple[Tuple[str, str], ...] = (
    # Flow
    ("en_route", "arrived"),
    ("en_route", "discharged"),  # cancelled / diverted
    ("arrived", "waiting"),
    ("waiting", "reserved"),
    ("reserved", "admitted"),
    ("admitted", "discharge_pending"),
    ("discharge_pending", "discharged"),
    ("admitted", "discharged"),  # direct discharge
    ("discharge_pending", "admitted"),  # discharge revoked
    # Backward compatibility & direct operations
    ("waiting", "admitted"),
    ("waiting", "discharged"),
    ("arrived", "admitted"),
    ("en_route", "reserved"),  # pre-reserving bed for incoming ambulance
    ("reserved", "waiting"),   # reservation released/cancelled
    ("admitted", "waiting"),   # allocation released back to queue
)

RESOURCE_TRANSITIONS: Tuple[Tuple[str, str], ...] = (
    ("available", "reserved"),
    ("reserved", "committed"),
    ("reserved", "available"),  # cancelled reservation
    ("available", "committed"),  # direct commitment
    ("committed", "available"),  # release or discharge
)


class TransitionError(ValueError):
    """Raised when an illegal state transition is attempted."""


def can_transition_patient(current: str, new: str) -> bool:
    return (current, new) in PATIENT_TRANSITIONS


def can_transition_resource(current: str, new: str) -> bool:
    return (current, new) in RESOURCE_TRANSITIONS


def assert_patient_transition(current: str, new: str) -> None:
    if not can_transition_patient(current, new):
        raise TransitionError(f"illegal patient transition: {current} -> {new}")


def assert_resource_transition(current: str, new: str) -> None:
    if not can_transition_resource(current, new):
        raise TransitionError(f"illegal resource transition: {current} -> {new}")
