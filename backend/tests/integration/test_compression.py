"""API cevaplari gzip ile sikistirilir (buyuk listeler mobil agda hizli insin)."""

from fastapi.testclient import TestClient

GZIP = {"Accept-Encoding": "gzip"}


def test_large_responses_are_gzipped(client: TestClient) -> None:
    # OpenAPI semasi buyuk ve girissiz: buyuk bir liste cevabinin yerine gecer
    response = client.get("/openapi.json", headers=GZIP)

    assert response.status_code == 200
    assert response.headers["content-encoding"] == "gzip"


def test_small_responses_are_sent_as_is(client: TestClient) -> None:
    response = client.get("/api/v1/health", headers=GZIP)

    assert "content-encoding" not in response.headers


def test_clients_without_gzip_get_plain_responses(client: TestClient) -> None:
    response = client.get("/openapi.json", headers={"Accept-Encoding": "identity"})

    assert "content-encoding" not in response.headers
