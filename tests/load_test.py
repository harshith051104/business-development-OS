"""
Load test script for ELLY BD OS.
Simulates 30-40 concurrent users performing typical BD operations.

Usage:
    cd backend
    python tests/load_test.py [--users 30] [--duration 60]

Requires: pip install locust (optional, falls back to threading-based test)
"""
import argparse
import time
import threading
import statistics
from dataclasses import dataclass, field
from typing import List, Optional
import httpx


@dataclass
class TestResult:
    endpoint: str
    status_code: int
    latency_ms: float
    success: bool
    error: Optional[str] = None


@dataclass
class UserSession:
    user_id: int
    token: str
    base_url: str
    results: List[TestResult] = field(default_factory=list)
    client: httpx.Client = field(default_factory=lambda: httpx.Client(timeout=30.0))


def login(base_url: str, email: str, password: str) -> Optional[str]:
    """Login and get JWT token."""
    with httpx.Client(timeout=10.0) as client:
        try:
            resp = client.post(f"{base_url}/auth/login", json={"email": email, "password": password})
            if resp.status_code == 200:
                return resp.json().get("access_token")
        except Exception as e:
            print(f"Login failed for {email}: {e}")
    return None


def run_user_scenario(session: UserSession, duration_seconds: int):
    """Run a realistic BD user scenario for the given duration."""
    headers = {"Authorization": f"Bearer {session.token}"}
    base = session.base_url
    deadline = time.time() + duration_seconds

    endpoints = [
        ("GET", "/api/business-development/organizations?owner_scope=mine&page=1&page_size=10"),
        ("GET", "/api/business-development/contacts?owner_scope=mine&page=1&page_size=10"),
        ("GET", "/api/business-development/followups?owner_scope=mine&page=1&page_size=10"),
        ("GET", "/api/business-development/meetings?owner_scope=mine&page=1&page_size=10"),
        ("GET", "/api/business-development/campaigns"),
        ("GET", "/api/business-development/dashboard"),
        ("GET", "/api/analytics/overview"),
    ]

    while time.time() < deadline:
        for method, path in endpoints:
            if time.time() >= deadline:
                break
            start = time.time()
            try:
                if method == "GET":
                    resp = session.client.get(f"{base}{path}", headers=headers)
                else:
                    resp = session.client.post(f"{base}{path}", headers=headers, json={})
                latency = (time.time() - start) * 1000
                session.results.append(TestResult(
                    endpoint=path,
                    status_code=resp.status_code,
                    latency_ms=latency,
                    success=200 <= resp.status_code < 500,
                ))
            except Exception as e:
                latency = (time.time() - start) * 1000
                session.results.append(TestResult(
                    endpoint=path,
                    status_code=0,
                    latency_ms=latency,
                    success=False,
                    error=str(e)[:100],
                ))
            time.sleep(0.1)  # Think time between requests


def run_load_test(num_users: int, duration_seconds: int, base_url: str):
    """Run the load test with concurrent users."""
    print(f"\n{'='*60}")
    print(f"ELLY BD OS Load Test")
    print(f"Users: {num_users} | Duration: {duration_seconds}s | Target: {base_url}")
    print(f"{'='*60}\n")

    # Login all users
    sessions = []
    for i in range(num_users):
        email = "bd@test.local"
        password = "password123"
        token = login(base_url, email, password)
        if token:
            sessions.append(UserSession(user_id=i, token=token, base_url=base_url))
        else:
            print(f"Warning: Could not login user {i}")

    if not sessions:
        print("ERROR: No users logged in. Aborting.")
        return

    print(f"Logged in: {len(sessions)}/{num_users} users")

    # Run concurrent scenarios
    threads = []
    start_time = time.time()
    for session in sessions:
        t = threading.Thread(target=run_user_scenario, args=(session, duration_seconds))
        threads.append(t)
        t.start()

    for t in threads:
        t.join()

    total_time = time.time() - start_time

    # Aggregate results
    all_results = []
    for s in sessions:
        all_results.extend(s.results)

    if not all_results:
        print("No results collected.")
        return

    latencies = [r.latency_ms for r in all_results]
    successes = [r for r in all_results if r.success]
    failures = [r for r in all_results if not r.success]

    print(f"\n{'='*60}")
    print(f"RESULTS")
    print(f"{'='*60}")
    print(f"Total requests:  {len(all_results)}")
    print(f"Successful:      {len(successes)} ({len(successes)/len(all_results)*100:.1f}%)")
    print(f"Failed:          {len(failures)} ({len(failures)/len(all_results)*100:.1f}%)")
    print(f"Duration:        {total_time:.1f}s")
    print(f"Requests/sec:    {len(all_results)/total_time:.1f}")

    print(f"\nLatency (ms):")
    print(f"  Mean:    {statistics.mean(latencies):.0f}")
    print(f"  Median:  {statistics.median(latencies):.0f}")
    print(f"  P95:     {sorted(latencies)[int(len(latencies)*0.95)]:.0f}")
    print(f"  P99:     {sorted(latencies)[int(len(latencies)*0.99)]:.0f}")
    print(f"  Max:     {max(latencies):.0f}")

    # Per-endpoint breakdown
    print(f"\nPer-endpoint breakdown:")
    endpoint_stats = {}
    for r in all_results:
        ep = r.endpoint.split("?")[0]
        if ep not in endpoint_stats:
            endpoint_stats[ep] = {"count": 0, "success": 0, "latencies": []}
        endpoint_stats[ep]["count"] += 1
        if r.success:
            endpoint_stats[ep]["success"] += 1
        endpoint_stats[ep]["latencies"].append(r.latency_ms)

    for ep, stats in sorted(endpoint_stats.items(), key=lambda x: -x[1]["count"]):
        avg_lat = statistics.mean(stats["latencies"])
        success_rate = stats["success"] / stats["count"] * 100
        print(f"  {ep:50s} | {stats['count']:4d} reqs | {success_rate:5.1f}% ok | {avg_lat:6.0f}ms avg")

    if failures:
        print(f"\nSample errors (first 5):")
        for f in failures[:5]:
            print(f"  {f.endpoint} -> {f.status_code}: {f.error}")

    print(f"\n{'='*60}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="ELLY BD OS Load Test")
    parser.add_argument("--users", type=int, default=10, help="Number of concurrent users")
    parser.add_argument("--duration", type=int, default=30, help="Test duration in seconds")
    parser.add_argument("--url", type=str, default="http://127.0.0.1:8001", help="Backend URL")
    args = parser.parse_args()

    run_load_test(args.users, args.duration, args.url)
