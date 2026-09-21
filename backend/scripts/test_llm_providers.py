import os, httpx, dotenv
dotenv.load_dotenv()
nvidia_key = os.getenv("NVIDIA_NIM_API_KEY", "").strip()

r = httpx.get("https://integrate.api.nvidia.com/v1/models", headers={"Authorization": f"Bearer {nvidia_key}"})
if r.status_code == 200:
    for m in r.json().get("data", []):
        mid = m["id"]
        # Test a 3-second ping
        try:
            res = httpx.post(
                "https://integrate.api.nvidia.com/v1/chat/completions",
                headers={"Authorization": f"Bearer {nvidia_key}", "Content-Type": "application/json"},
                json={"model": mid, "messages": [{"role": "user", "content": "hi"}], "max_tokens": 5},
                timeout=4.0
            )
            if res.status_code == 200:
                print("WORKING NVIDIA MODEL:", mid)
                break
        except Exception:
            continue
