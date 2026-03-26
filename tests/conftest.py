import os
import tempfile

os.environ["PULLPILOT_TESTING"] = "1"
os.environ["AUTH_USER"] = ""
os.environ["AUTH_PASS"] = ""
os.environ.setdefault("SESSION_SECRET", "pullpilot-test-session-secret")
if "DATA_DIR" not in os.environ:
    os.environ["DATA_DIR"] = tempfile.mkdtemp(prefix="pullpilot_test_")

import pytest
from fastapi.testclient import TestClient

from server.app import app


@pytest.fixture()
def client() -> TestClient:
    with TestClient(app) as c:
        yield c
