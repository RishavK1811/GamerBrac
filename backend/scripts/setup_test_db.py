import os
import sys
from datetime import datetime, timezone, timedelta

# Ensure backend root is on sys.path
backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, backend_dir)

os.environ["DATABASE_URL"] = os.environ.get("DATABASE_URL", "sqlite:///./test_e2e.db")

from sqlalchemy.orm import Session
from app.models import (
    Base,
    User,
    UserRole,
    PlayerProfile,
    Tournament,
    TournamentFormat,
    TournamentStatus,
)
from app.core.database import engine, SessionLocal
from app.core.security import get_password_hash


def init_db():
    db_file = os.path.join(backend_dir, "test_e2e.db")
    if os.path.exists(db_file):
        try:
            os.remove(db_file)
        except OSError:
            pass
    Base.metadata.create_all(bind=engine)

    # Seed deterministic test accounts
    session: Session = SessionLocal()
    try:
        # 1. Admin
        admin = User(
            id="admin-seed-id",
            username="e2e_admin",
            email="admin@gamerbrac.com",
            hashed_password=get_password_hash("AdminPass123!"),
            role=UserRole.ADMIN,
            is_active=True,
            is_verified=True,
        )
        session.add(admin)

        # 2. Verified Organizer
        verified_org = User(
            id="org-seed-id",
            username="e2e_verified_org",
            email="org@gamerbrac.com",
            hashed_password=get_password_hash("OrgPass123!"),
            role=UserRole.ORGANIZER,
            is_active=True,
            is_verified=True,
        )
        session.add(verified_org)

        # 3. Unverified Organizer (used for admin approval test)
        unverified_org = User(
            id="org-unverified-id",
            username="e2e_unverified_org",
            email="unverified@gamerbrac.com",
            hashed_password=get_password_hash("OrgPass123!"),
            role=UserRole.ORGANIZER,
            is_active=True,
            is_verified=False,
        )
        session.add(unverified_org)

        # 3b. Dedicated Unverified Organizer (used for organizer verification guard test)
        pending_org = User(
            id="org-pending-id",
            username="e2e_pending_org",
            email="pending_org@gamerbrac.com",
            hashed_password=get_password_hash("OrgPass123!"),
            role=UserRole.ORGANIZER,
            is_active=True,
            is_verified=False,
        )
        session.add(pending_org)

        # 4. Deterministic initial tournaments for browsing & directory tests
        now = datetime.now(timezone.utc)
        tourney_ff = Tournament(
            id="tourney-e2e-ff",
            title="E2E Free Fire MAX Open",
            game_title="Free Fire MAX",
            format=TournamentFormat.SOLO,
            status=TournamentStatus.REGISTRATION_OPEN,
            max_participants=48,
            current_participants=0,
            registration_deadline=now + timedelta(days=5),
            start_datetime=now + timedelta(days=6),
            organizer_id=verified_org.id,
            is_free_entry=True,
            rules="Fair play only. Screenshot verification required.",
            prize_pool_description="E-Certificate & Verified National Points",
        )
        session.add(tourney_ff)

        tourney_bgmi = Tournament(
            id="tourney-e2e-bgmi",
            title="E2E BGMI Battlegrounds Series",
            game_title="BGMI",
            format=TournamentFormat.SQUAD,
            status=TournamentStatus.CHECK_IN,
            max_participants=20,
            current_participants=0,
            registration_deadline=now + timedelta(hours=2),
            check_in_deadline=now + timedelta(hours=1),
            start_datetime=now + timedelta(hours=3),
            organizer_id=verified_org.id,
            is_free_entry=True,
            rules="Custom 4-player squad match.",
            prize_pool_description="GamerBrac Championship Trophy",
        )
        session.add(tourney_bgmi)

        session.commit()
        print("Test E2E database initialized and seeded successfully.")
    finally:
        session.close()


if __name__ == "__main__":
    init_db()
