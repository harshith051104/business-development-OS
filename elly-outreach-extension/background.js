// Service worker: all network I/O to the ELLY backend happens here, never in a
// content script, so the target sites' own CSP can't interfere with it. Shared
// by both channels — each call carries msg.channel ("whatsapp" | "linkedin") to
// pick the right backend path.

const DEFAULT_API_BASE = "http://127.0.0.1:8001";

const QUEUE_BASE = {
  whatsapp: "/api/business-development/whatsapp-automation",
  linkedin: "/api/business-development/linkedin-automation",
};

async function getConfig() {
  const stored = await chrome.storage.local.get(["apiBase", "token", "userEmail"]);
  return {
    apiBase: stored.apiBase || DEFAULT_API_BASE,
    token: stored.token || null,
    userEmail: stored.userEmail || null,
  };
}

async function apiFetch(path, options = {}) {
  const { apiBase, token } = await getConfig();
  const res = await fetch(`${apiBase}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch (_) { data = text; }
  if (!res.ok) {
    const detail = (data && data.detail) ? data.detail : res.statusText;
    throw new Error(`${res.status}: ${detail}`);
  }
  return data;
}

async function login(apiBase, email, password) {
  await chrome.storage.local.set({ apiBase });
  const data = await apiFetch("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  await chrome.storage.local.set({ token: data.access_token, userEmail: data.user?.email || email });
  return { email: data.user?.email || email, name: data.user?.name || null };
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  (async () => {
    try {
      switch (msg.type) {
        case "LOGIN": {
          const result = await login(msg.apiBase, msg.email, msg.password);
          sendResponse({ ok: true, data: result });
          break;
        }
        case "FETCH_QUEUE": {
          const base = QUEUE_BASE[msg.channel];
          if (!base) throw new Error(`Unknown channel: ${msg.channel}`);
          const qs = new URLSearchParams();
          if (msg.campaignId) qs.set("campaign_id", msg.campaignId);
          qs.set("limit", msg.limit || 20);
          const data = await apiFetch(`${base}/queue?${qs}`);
          sendResponse({ ok: true, data });
          break;
        }
        case "REPORT": {
          const base = QUEUE_BASE[msg.channel];
          if (!base) throw new Error(`Unknown channel: ${msg.channel}`);
          const body = msg.channel === "linkedin"
            ? { set: msg.set || [], result: msg.result, note: msg.note || null }
            : { result: msg.result, note: msg.note || null };
          const data = await apiFetch(`${base}/queue/${msg.campaignContactId}/report`, {
            method: "POST",
            body: JSON.stringify(body),
          });
          sendResponse({ ok: true, data });
          break;
        }
        case "GET_CONFIG": {
          const cfg = await getConfig();
          sendResponse({ ok: true, data: cfg });
          break;
        }
        case "REQUEST_HOST_PERMISSION": {
          const granted = await chrome.permissions.request({ origins: [msg.origin] });
          sendResponse({ ok: true, data: { granted } });
          break;
        }
        default:
          sendResponse({ ok: false, error: `Unknown message type: ${msg.type}` });
      }
    } catch (err) {
      sendResponse({ ok: false, error: err.message || String(err) });
    }
  })();
  return true; // keep the message channel open for the async response
});
