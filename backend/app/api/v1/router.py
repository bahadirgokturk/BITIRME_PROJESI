from fastapi import APIRouter

from app.api.v1 import (
    admin,
    attachments,
    auth,
    case_interactions,
    cases,
    health,
    locations,
    lookups,
    manager,
    tasks,
)

api_router = APIRouter()
api_router.include_router(health.router)
api_router.include_router(auth.router)
api_router.include_router(locations.router)
api_router.include_router(cases.router)
api_router.include_router(attachments.router)
api_router.include_router(case_interactions.router)
api_router.include_router(tasks.router)
api_router.include_router(manager.router)
api_router.include_router(lookups.router)
api_router.include_router(admin.router)
