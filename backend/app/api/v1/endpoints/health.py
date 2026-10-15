from fastapi import APIRouter
from app.core.config import settings
from app.core.database import check_db_connection
from app.schemas.health import HealthCheckResponse

router = APIRouter()


@router.get("/health", response_model=HealthCheckResponse, tags=["Health"])
def get_health() -> HealthCheckResponse:
    """Returns application health status, database connectivity, and supported esports titles."""
    db_ok = check_db_connection()
    status = "healthy" if db_ok else "degraded"
    db_status = "connected" if db_ok else "unavailable"

    return HealthCheckResponse(
        status=status,
        app_name=settings.PROJECT_NAME,
        version=settings.VERSION,
        environment=settings.ENVIRONMENT,
        database=db_status,
        supported_games=["Free Fire MAX", "BGMI", "VALORANT"],
    )
