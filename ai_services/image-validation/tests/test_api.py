from fastapi.testclient import TestClient

from app.main import app


client = TestClient(app)


def test_health_endpoint():
    response = client.get("/health")

    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_invalid_base64_returns_policy_block_response():
    response = client.post(
        "/validate-image",
        json={
            "imageBase64": "not-base64",
            "mimeType": "image/jpeg",
            "width": 500,
            "height": 500,
            "bytes": 20,
            "source": "upload",
            "outfitMode": "single",
            "itemRoles": ["shoes"],
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["allowed"] is False
    assert payload["reasonCode"] == "IMAGE_POLICY_BLOCKED"
