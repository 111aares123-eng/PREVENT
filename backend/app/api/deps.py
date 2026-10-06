"""
API dependencies and dependency injection providers.
"""
from typing import Generator
from fastapi import Depends
from sqlalchemy.orm import Session
from backend.app.db.session import get_db
from backend.app.services.risk_engine import RiskEngine

# Re-export get_db for cleaner imports in endpoints
__all__ = ["get_db", "get_risk_engine"]


def get_risk_engine() -> RiskEngine:
    """Dependency providing a configured RiskEngine singleton or instance."""
    return RiskEngine()
