const $ = (id) => document.getElementById(id);

function bg(msg) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(msg, (res) => {
      if (!res) return reject(new Error("no response from background"));
      if (!res.ok) return reject(new Error(res.error));
      resolve(res.data);
    });
  });
}

function setStatus(text, isError) {
  const el = $("status");
  el.textContent = text;
  el.style.color = isError ? "#a00" : "#065";
}

async function load() {
  const { apiBase, userEmail, waSettings = {}, liSettings = {} } =
    await chrome.storage.local.get(["apiBase", "userEmail", "waSettings", "liSettings"]);
  $("apiBase").value = apiBase || "http://127.0.0.1:8001";
  $("email").value = userEmail || "";

  $("waCap").value = waSettings.cap ?? 15;
  $("waH1").value = waSettings.h1 ?? 9;
  $("waH2").value = waSettings.h2 ?? 20;
  $("waCampaignId").value = waSettings.campaignId || "";

  $("liCap").value = liSettings.cap ?? 8;
  $("liH1").value = liSettings.h1 ?? 9;
  $("liH2").value = liSettings.h2 ?? 18;
  $("liCampaignId").value = liSettings.campaignId || "";

  if (userEmail) setStatus(`Logged in as ${userEmail}`);
}

async function ensureHostPermission(apiBase) {
  try {
    const url = new URL(apiBase);
    const origin = `${url.protocol}//${url.host}/*`;
    const already = await chrome.permissions.contains({ origins: [origin] });
    if (already) return true;
    const result = await bg({ type: "REQUEST_HOST_PERMISSION", origin });
    return result.granted;
  } catch (e) {
    return false;
  }
}

$("loginBtn").onclick = async () => {
  const apiBase = $("apiBase").value.trim().replace(/\/$/, "");
  const email = $("email").value.trim();
  const password = $("password").value;
  if (!apiBase || !email || !password) return setStatus("Fill in backend URL, email, and password.", true);

  setStatus("Requesting permission for that backend URL...");
  const granted = await ensureHostPermission(apiBase);
  if (!granted) return setStatus("Permission denied — the extension can't reach that URL without it.", true);

  setStatus("Logging in...");
  try {
    const data = await bg({ type: "LOGIN", apiBase, email, password });
    setStatus(`Logged in as ${data.email}`);
    $("password").value = "";
  } catch (err) {
    setStatus(`Login failed: ${err.message}`, true);
  }
};

$("waSaveBtn").onclick = async () => {
  const waSettings = {
    cap: Math.max(1, parseInt($("waCap").value, 10) || 15),
    h1: Math.min(23, Math.max(0, parseInt($("waH1").value, 10) || 9)),
    h2: Math.min(23, Math.max(0, parseInt($("waH2").value, 10) || 20)),
    campaignId: $("waCampaignId").value.trim(),
  };
  await chrome.storage.local.set({ waSettings });
  setStatus("WhatsApp settings saved. Open web.whatsapp.com to run.");
};

$("liSaveBtn").onclick = async () => {
  const liSettings = {
    cap: Math.max(1, parseInt($("liCap").value, 10) || 8),
    h1: Math.min(23, Math.max(0, parseInt($("liH1").value, 10) || 9)),
    h2: Math.min(23, Math.max(0, parseInt($("liH2").value, 10) || 18)),
    campaignId: $("liCampaignId").value.trim(),
  };
  await chrome.storage.local.set({ liSettings });
  setStatus("LinkedIn settings saved. Open linkedin.com to run.");
};

load();
