import pytest

import app as appmod

CODE = "def f(n):\n    s = 0\n    for i in range(n):\n        s += 2 * 3\n    return s\n"


@pytest.fixture()
def client():
    appmod.app.testing = True
    return appmod.app.test_client()


def _optimize(client):
    r = client.post("/api/optimize", json={"code": CODE, "filename": "t.py", "settings": {}})
    assert r.status_code == 200
    return r.get_json()["report_id"]


@pytest.mark.parametrize("lang", ["en", "ur", "sd", "hi", "ar", "es", "fr", "de", "tr", "zh", "ja", "ru"])
def test_all_languages_build(client, lang):
    rid = _optimize(client)
    r = client.post("/api/final_report", json={"report_id": rid, "lang": lang})
    assert r.status_code == 200 and f'lang="{lang}"' in r.get_data(as_text=True)


def test_unknown_report_404(client):
    assert client.post("/api/final_report", json={"report_id": "nope"}).status_code == 404


def test_unknown_route_keeps_http_status(client):
    response = client.get("/route-that-does-not-exist")
    assert response.status_code == 404
    assert response.get_json()["kind"] == "http"


def test_unexpected_error_is_logged_without_leaking_details(client, monkeypatch, caplog):
    def fail(*args, **kwargs):
        raise RuntimeError("private server detail")

    monkeypatch.setattr(appmod.pipeline, "analyze", fail)
    with caplog.at_level("ERROR"):
        response = client.post("/api/analyze", json={"code": "x = 1"})

    assert response.status_code == 500
    assert response.get_json()["error"] == "An unexpected server error occurred."
    assert "private server detail" not in response.get_data(as_text=True)
    assert "Unhandled request error" in caplog.text


def test_html_is_escaped_and_images_sanitised(client):
    rid = _optimize(client)
    evil = "<script>alert(1)</script>"
    r = client.post("/api/final_report", json={
        "report_id": rid, "lang": "en",
        "meta": {"student": evil},
        "images": {"cfg": 'x" onerror="alert(1)', "city": "data:image/png;base64,AAAA"},
        "lesson": [{"title": evil, "say": evil}], "conclusion": evil})
    html = r.get_data(as_text=True)
    assert evil not in html and 'onerror="alert(1)' not in html
    assert "data:image/png;base64,AAAA" in html
