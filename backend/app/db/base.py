"""
Declarative base class for all SQLAlchemy ORM models.
"""
from datetime import datetime
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column
from sqlalchemy import DateTime


class Base(DeclarativeBase):
    """Base class for all database models with common timestamp helpers."""
    pass
