from fastapi.testclient import TestClient


def test_root_endpoint(client: TestClient):
    response = client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert "message" in data
    assert "GamerBrac" in data["message"]
    assert "docs" in data
    assert "health" in data


def test_health_check_endpoint(client: TestClient):
    response = client.get("/api/v1/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] in ["healthy", "degraded"]
    assert data["database"] in ["connected", "unavailable"]
    assert "Free Fire MAX" in data["supported_games"]
    assert "BGMI" in data["supported_games"]
    assert "VALORANT" in data["supported_games"]
    assert data["version"] == "0.1.0"
