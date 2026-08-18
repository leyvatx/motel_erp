"""Prueba de carga HTTP mínima, sin dependencias externas.

Uso:
  MOTEL_ERP_TOKENS="jwt_motel_1,jwt_motel_2" python scripts/load_smoke.py
"""

from __future__ import annotations

import json
import os
import statistics
import time
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed

BASE_URL = os.getenv("MOTEL_ERP_BASE_URL", "http://localhost:8000").rstrip("/")
TOKENS = [value.strip() for value in os.getenv("MOTEL_ERP_TOKENS", "").split(",") if value.strip()]
REQUESTS = int(os.getenv("MOTEL_ERP_REQUESTS", "500"))
CONCURRENCY = int(os.getenv("MOTEL_ERP_CONCURRENCY", "25"))
TIMEOUT = float(os.getenv("MOTEL_ERP_TIMEOUT", "10"))


def request_once(index: int) -> tuple[float, int]:
    token = TOKENS[index % len(TOKENS)]
    request = urllib.request.Request(
        f"{BASE_URL}/api/v1/frontdesk/rooms/summary/",
        headers={"Authorization": f"Bearer {token}"},
    )
    started = time.perf_counter()
    try:
        with urllib.request.urlopen(request, timeout=TIMEOUT) as response:
            response.read()
            status = response.status
    except urllib.error.HTTPError as exc:
        status = exc.code
    except Exception:
        status = 0
    return (time.perf_counter() - started) * 1000, status


def percentile(values: list[float], fraction: float) -> float:
    if not values:
        return 0
    return sorted(values)[min(int(len(values) * fraction), len(values) - 1)]


def main() -> None:
    if not TOKENS:
        raise SystemExit("Define MOTEL_ERP_TOKENS con uno o más JWT separados por coma.")
    started = time.perf_counter()
    results = []
    with ThreadPoolExecutor(max_workers=CONCURRENCY) as executor:
        futures = [executor.submit(request_once, index) for index in range(REQUESTS)]
        for future in as_completed(futures):
            results.append(future.result())
    elapsed = time.perf_counter() - started
    latencies = [latency for latency, _ in results]
    statuses: dict[int, int] = {}
    for _, status in results:
        statuses[status] = statuses.get(status, 0) + 1
    output = {
        "requests": REQUESTS,
        "concurrency": CONCURRENCY,
        "requests_per_second": round(REQUESTS / elapsed, 2),
        "latency_ms": {
            "mean": round(statistics.mean(latencies), 2),
            "p50": round(percentile(latencies, 0.50), 2),
            "p95": round(percentile(latencies, 0.95), 2),
            "p99": round(percentile(latencies, 0.99), 2),
        },
        "statuses": statuses,
    }
    print(json.dumps(output, indent=2))
    if statuses.get(200, 0) != REQUESTS:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
