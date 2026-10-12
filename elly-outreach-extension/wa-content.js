// Runs on web.whatsapp.com. Pure DOM: opens each chat via /send?phone=&text= (text pre-filled),
// clicks Send, confirms it landed, reports the outcome back to the ELLY backend via background.js,
// waits a randomized delay, repeats. Storage keys are "wa"-prefixed since this extension's single
// chrome.storage.local namespace is shared with li-content.js (LinkedIn runs on its own tabs).
(() => {
  const DEFAULTS = { cap: 15, h1: 9, h2: 20, campaignId: "" };
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const $ = (s) => document.querySelector(s);
  const composer = () => $('footer div[contenteditable="true"]') || $('div[contenteditable="true"][data-tab="10"]');
  const sendBtn = () => {
    const icon = $('footer span[data-icon="send"]') || $('span[data-icon="send"]');
    return (icon && icon.closest('button, [role="button"]')) || $('footer button[aria-label="Send"]');
  };
  const isInvalid = () => /phone number shared via url is invalid|is not on whatsapp/i.test(document.body.innerText);
  const outCount = () => document.querySelectorAll("div.message-out").length;
  const todayStr = () => new Date().toISOString().slice(0, 10);

  async function store(keys) {
    return chrome.storage.local.get(keys);
  }
  async function setStore(obj) {
    return chrome.storage.local.set(obj);
  }
  const loadRun = async () =>
    (await store("waRunState")).waRunState || { running: false, log: [], fails: 0, queueCache: [] };
  const saveRun = (st) => setStore({ waRunState: st });

  function bg(msg) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(msg, (res) => {
        if (!res) return reject(new Error("no response from background"));
        if (!res.ok) return reject(new Error(res.error));
        resolve(res.data);
      });
    });
  }

  async function sentTodayCount() {
    const { waSentLog = [] } = await store("waSentLog");
    const today = todayStr();
    return waSentLog.filter((s) => s.slice(0, 10) === today).length;
  }
  async function recordSent() {
    const { waSentLog = [] } = await store("waSentLog");
    waSentLog.push(new Date().toISOString());
    await setStore({ waSentLog: waSentLog.slice(-500) });
  }

  // --- UI ------------------------------------------------------------------------------------
  let st, panel, statusEl, logEl, queueEl, timer;

  function buildPanel() {
    if (document.getElementById("elly-wa-panel")) { panel = document.getElementById("elly-wa-panel"); return; }
    panel = document.createElement("div");
    panel.id = "elly-wa-panel";
    panel.style.cssText =
      "position:fixed;right:12px;bottom:12px;z-index:99999;width:320px;background:#fff;color:#111;" +
      "border:1px solid #0a7;border-radius:10px;padding:10px;font:12px system-ui;box-shadow:0 4px 16px #0003";
    panel.innerHTML =
      '<b>ELLY WhatsApp Automation</b><div id="el-status" style="margin:6px 0;color:#065"></div>' +
      '<button id="el-start">Start</button> <button id="el-rehearse">Rehearse (no send)</button> ' +
      '<button id="el-stop">Stop</button><br>' +
      '<label style="display:block;margin-top:6px"><input type="checkbox" id="el-auto"> ' +
      'Auto-start each day when this tab opens</label>' +
      '<div id="el-queue" style="margin-top:6px;color:#333"></div>' +
      '<div id="el-log" style="margin-top:6px;max-height:110px;overflow:auto;color:#444"></div>' +
      '<div style="margin-top:4px;color:#888">Configure cap/hours/campaign from the extension icon.</div>';
    document.body.appendChild(panel);
    statusEl = panel.querySelector("#el-status");
    logEl = panel.querySelector("#el-log");
    queueEl = panel.querySelector("#el-queue");
    panel.querySelector("#el-start").onclick = () => start(false);
    panel.querySelector("#el-rehearse").onclick = () => start(true);
    panel.querySelector("#el-stop").onclick = () => stop("Stopped by you");
    const autoCb = panel.querySelector("#el-auto");
    store("waAutoStart").then((r) => { autoCb.checked = !!r.waAutoStart; });
    autoCb.onchange = () => setStore({ waAutoStart: autoCb.checked });
  }

  function render() {
    statusEl.textContent = st.running ? (st.rehearse ? "Rehearsal running" : "Running") : "Idle";
    logEl.innerHTML = st.log.slice(-8).map((l) => `<div>${l}</div>`).join("");
  }

  async function refreshQueueLabel() {
    const { waSettings = DEFAULTS } = await store("waSettings");
    const s = { ...DEFAULTS, ...waSettings };
    const sentToday = await sentTodayCount();
    const pending = (st.queueCache || []).length;
    queueEl.textContent = `Cached: ${pending} pending. Sent today ${sentToday}/${s.cap}.`;
  }

  async function log(msg) {
    st.log.push(`${new Date().toLocaleTimeString()} ${msg}`);
    st.log = st.log.slice(-30);
    await saveRun(st);
    render();
  }

  async function stop(why) {
    clearTimeout(timer);
    st.running = false;
    st.current = null;
    st.waitUntil = 0;
    await log(why);
    refreshQueueLabel();
  }

  async function start(rehearse) {
    st = { running: true, rehearse, log: st.log, fails: 0, current: null, waitUntil: 0, queueCache: st.queueCache || [] };
    await log(rehearse ? "Rehearsal started" : "Started");
    nextJob();
  }

  async function nextJob() {
    const { waSettings = DEFAULTS } = await store("waSettings");
    const s = { ...DEFAULTS, ...waSettings };
    const h = new Date().getHours();
    if (h < s.h1 || h >= s.h2) return stop(`Finished: outside ${s.h1}:00-${s.h2}:00`);
    const sentToday = await sentTodayCount();
    const remaining = s.cap - sentToday;
    if (remaining <= 0) return stop(`Finished: daily cap of ${s.cap} reached`);

    if (!st.queueCache || st.queueCache.length === 0) {
      await log("Fetching queue from ELLY...");
      try {
        const data = await bg({ type: "FETCH_QUEUE", channel: "whatsapp", campaignId: s.campaignId || null, limit: 20 });
        st.queueCache = data.items || [];
        await saveRun(st);
      } catch (err) {
        return stop(`Finished: could not fetch queue (${err.message})`);
      }
      if (st.queueCache.length === 0) return stop("Finished: no pending leads assigned to you right now");
    }

    const job = st.queueCache.shift();
    st.current = job;
    st.phase = "navigating";
    st.waitUntil = 0;
    await saveRun(st);
    await log(`Opening ${job.name} (${remaining} left today)`);
    location.href = `https://web.whatsapp.com/send?phone=${job.phone}&text=${encodeURIComponent(job.message)}`;
  }

  async function reportAndDelay(status, note) {
    const j = st.current;
    try {
      await bg({ type: "REPORT", channel: "whatsapp", campaignContactId: j.campaign_contact_id, result: status, note });
    } catch (err) {
      await log(`Warning: could not report result to ELLY (${err.message})`);
    }
    if (status === "sent") await recordSent();
    const delay = status === "invalid" ? 15000 + Math.random() * 15000 : 90000 + Math.random() * 150000;
    return Math.round(delay);
  }

  async function finish(status, note) {
    const j = st.current;
    const delayMs = await reportAndDelay(status, note);
    st.fails = status === "failed" ? st.fails + 1 : status === "sent" ? 0 : st.fails;
    st.current = null;
    await log(`${status}: ${j.name}${note ? " - " + note : ""}`);
    refreshQueueLabel();
    if (st.fails >= 3) return stop("3 failures in a row - stopped. Check WhatsApp Web.");
    st.waitUntil = Date.now() + delayMs;
    await saveRun(st);
    timer = setTimeout(nextJob, delayMs);
    statusEl.textContent = `Waiting ${Math.round(delayMs / 1000)}s before next`;
  }

  async function handleCurrent() {
    st.phase = "handling";
    await saveRun(st);
    const t0 = Date.now();
    let ready = false;
    while (Date.now() - t0 < 90000) {
      if (isInvalid()) return finish("invalid", "number is not on WhatsApp");
      const c = composer();
      if (c && sendBtn() && c.innerText.trim().length > 0) { ready = true; break; }
      await sleep(1000);
    }
    if (!ready) return finish("failed", "chat did not load or message was not pre-filled");
    await sleep(1500 + Math.random() * 1500);
    if (st.rehearse) {
      await log("Rehearsal OK: message typed, NOT sent. Clear it from the chat box.");
      st.running = false;
      st.current = null;
      await saveRun(st);
      return render();
    }
    const before = outCount();
    sendBtn().click();
    for (let i = 0; i < 15; i++) {
      await sleep(1000);
      const c = composer();
      if (outCount() > before || (c && c.innerText.trim() === "")) return finish("sent", "");
    }
    return finish("failed", "could not confirm the message was sent");
  }

  async function maybeAutoStart() {
    const { waAutoStart, waAutoStartDate } = await store(["waAutoStart", "waAutoStartDate"]);
    if (!waAutoStart || st.running) return;
    const today = todayStr();
    if (waAutoStartDate === today) return;
    const { waSettings = DEFAULTS } = await store("waSettings");
    const s = { ...DEFAULTS, ...waSettings };
    const h = new Date().getHours();
    if (h < s.h1 || h >= s.h2) return;
    await setStore({ waAutoStartDate: today });
    await log("Auto-start: beginning today's run");
    start(false);
  }

  (async () => {
    st = await loadRun();
    buildPanel();
    render();
    refreshQueueLabel();
    if (!st.running) return maybeAutoStart();
    if (st.current && st.phase === "navigating") return handleCurrent();
    const left = (st.waitUntil || 0) - Date.now();
    if (left > 0) { timer = setTimeout(nextJob, left); statusEl.textContent = `Waiting ${Math.round(left / 1000)}s before next`; }
    else nextJob();
  })();
})();
