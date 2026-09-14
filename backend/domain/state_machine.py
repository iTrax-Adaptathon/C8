"""Business/domain layer: legal state transitions for patients and resources.

Patient:  waiting -> admitted -> discharged   (+ release: admitted -> waiting)
Resource: available <-> committed
"""
from typing import Tuple

PATIENT_TRANSITIONS: Tuple[Tuple[str, str], ...] = (
    ("waiting", "admitted"),
    ("admitted", "discharged"),
    ("waiting", "discharged"),
    ("admitted", "waiting"),  # a released allocation returns the patient to queue
)

RESOURCE_TRANSITIONS: Tuple[Tuple[str, str], ...] = (
    ("available", "committed"),
    ("committed", "available"),
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
