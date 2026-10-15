import pytest
from typing import Callable, Generator
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from app.main import app
from app.core.database import get_db
from app.core.security import create_access_token, get_password_hash
from app.models import Base, User, UserRole, PlayerProfile

# Use an in-memory SQLite database for testing
TEST_SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"

engine = create_engine(
    TEST_SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture(scope="session", autouse=True)
def setup_test_db():
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture(autouse=True)
def clean_rate_limits():
    from app.core.rate_limit import reset_rate_limits
    reset_rate_limits()
    yield
    reset_rate_limits()


@pytest.fixture
def db_session() -> Generator[Session, None, None]:
    connection = engine.connect()
    transaction = connection.begin()
    session = TestingSessionLocal(bind=connection)

    yield session

    session.close()
    transaction.rollback()
    connection.close()


@pytest.fixture
def client(db_session: Session) -> Generator[TestClient, None, None]:
    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.fixture
def create_user(db_session: Session) -> Callable:
    def _create_user(
        username: str = "testplayer",
        email: str = "testplayer@gamerbrac.com",
        password: str = "GamerBrac#2026",
        role: UserRole = UserRole.PLAYER,
        is_verified: bool = True,
    ) -> User:
        user = User(
            username=username.lower(),
            email=email.lower(),
            hashed_password=get_password_hash(password),
            role=role,
            is_active=True,
            is_verified=is_verified,
        )
        db_session.add(user)
        db_session.flush()

        profile = PlayerProfile(user_id=user.id, display_name=username)
        db_session.add(profile)
        db_session.flush()

        return user

    return _create_user


@pytest.fixture
def auth_headers(create_user: Callable) -> Callable:
    def _auth_headers(user: User = None) -> dict:
        if user is None:
            user = create_user()
        token, _, _ = create_access_token(subject=user.id, role=user.role.value)
        return {"Authorization": f"Bearer {token}"}

    return _auth_headers
