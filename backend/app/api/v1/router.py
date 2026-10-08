"""
API v1 root router aggregating all resource sub-routers.
"""
from fastapi import APIRouter
from backend.app.api.v1.fleet import router as fleet_router
from backend.app.api.v1.assets import router as assets_router
from backend.app.api.v1.simulation import router as simulation_router
from backend.app.api.v1.events import router as events_router

api_v1_router = APIRouter()

api_v1_router.include_router(fleet_router)
api_v1_router.include_router(assets_router)
api_v1_router.include_router(simulation_router)
api_v1_router.include_router(events_router)

