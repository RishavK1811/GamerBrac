from fastapi import APIRouter
from app.api.v1.endpoints import (
    admin,
    auth,
    health,
    matches,
    notifications,
    players,
    submissions,
    teams,
    tournaments,
)

api_router = APIRouter()
api_router.include_router(health.router)
api_router.include_router(auth.router)
api_router.include_router(players.router)
api_router.include_router(teams.router)
api_router.include_router(tournaments.router)
api_router.include_router(matches.router)
api_router.include_router(submissions.router)
api_router.include_router(notifications.router)
api_router.include_router(admin.router)
