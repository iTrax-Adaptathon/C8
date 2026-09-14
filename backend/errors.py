"""Domain-level errors mapped to HTTP status codes in backend/main.py."""
from typing import Optional


class AppError(Exception):
    status_code = 400

    def __init__(self, detail: str, status_code: Optional[int] = None):
        self.detail = detail
        if status_code is not None:
            self.status_code = status_code
        super().__init__(detail)


class NotFoundError(AppError):
    status_code = 404


class ConflictError(AppError):
    status_code = 409


class UnprocessableError(AppError):
    status_code = 422
