from fastapi import APIRouter, Depends
from fastapi.testclient import TestClient
from app.api.deps import require_roles
from app.main import app
from app.models.user import User, UserRole

# Temporary test router to verify role guard dependencies in isolation
permission_router = APIRouter(prefix="/test-permissions")


@permission_router.get("/organizer-only")
def organizer_endpoint(user: User = Depends(require_roles(UserRole.ORGANIZER, UserRole.ADMIN))):
    return {"message": f"Welcome organizer {user.username}"}


@permission_router.get("/admin-only")
def admin_endpoint(user: User = Depends(require_roles(UserRole.ADMIN))):
    return {"message": f"Welcome admin {user.username}"}


# Mount test router on the app
app.include_router(permission_router)


def test_permission_role_enforcement(client: TestClient, create_user, auth_headers):
    player = create_user(username="standard_player", email="player@gamerbrac.com", role=UserRole.PLAYER)
    organizer = create_user(username="tourney_org", email="org@gamerbrac.com", role=UserRole.ORGANIZER)
    admin = create_user(username="sys_admin", email="admin@gamerbrac.com", role=UserRole.ADMIN)

    # 1. Player attempts access -> both forbidden (403)
    p_org_res = client.get("/test-permissions/organizer-only", headers=auth_headers(player))
    assert p_org_res.status_code == 403
    assert "access denied" in p_org_res.json()["detail"].lower()

    p_admin_res = client.get("/test-permissions/admin-only", headers=auth_headers(player))
    assert p_admin_res.status_code == 403

    # 2. Organizer attempts access -> organizer-only allowed (200), admin-only forbidden (403)
    o_org_res = client.get("/test-permissions/organizer-only", headers=auth_headers(organizer))
    assert o_org_res.status_code == 200

    o_admin_res = client.get("/test-permissions/admin-only", headers=auth_headers(organizer))
    assert o_admin_res.status_code == 403

    # 3. Admin attempts access -> both allowed (200)
    a_org_res = client.get("/test-permissions/organizer-only", headers=auth_headers(admin))
    assert a_org_res.status_code == 200

    a_admin_res = client.get("/test-permissions/admin-only", headers=auth_headers(admin))
    assert a_admin_res.status_code == 200
