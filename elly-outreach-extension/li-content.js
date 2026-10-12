// Runs on www.linkedin.com. Pure DOM: navigates to each queued profile, reads the
// profile's own primary action button to decide what state the relationship is in
// (Connect / Pending / Message / Follow-only), acts accordingly, confirms via DOM,
// reports the outcome back to the ELLY backend via background.js, waits a randomized
// delay, repeats. Storage keys are "li"-prefixed since this extension's single
// chrome.storage.local namespace is shared with wa-content.js (WhatsApp runs on its
// own tabs). Pacing is deliberately more conservative than the WhatsApp side: a
// banned LinkedIn profile is a rep's professional identity, not a replaceable number.
(() => {
  const DEFAULTS = { cap: 8, h1: 9, h2: 18, campaignId: "" };
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const todayStr = () => new Date().toISOString().slice(0, 10);

  async function store(keys) { return chrome.storage.local.get(keys); }
  async function setStore(obj) { return chrome.storage.local.set(obj); }
  const loadRun = async () =>
    (await store("liRunState")).liRunState || { running: false, log: [], fails: 0, queueCache: [] };
  const saveRun = (st) => setStore({ liRunState: st });

  function bg(msg) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(msg, (res) => {
        if (!res) return reject(new Error("no response from background"));
        if (!res.ok) return reject(new Error(res.error));
        resolve(res.data);
      });
    });
  }

  async function doneTodayCount() {
    const { liDoneLog = [] } = await store("liDoneLog");
    const today = todayStr();
    return liDoneLog.filter((s) => s.slice(0, 10) === today).length;
  }
  async function recordDone() {
    const { liDoneLog = [] } = await store("liDoneLog");
    liDoneLog.push(new Date().toISOString());
    await setStore({ liDoneLog: liDoneLog.slice(-500) });
  }

  // --- DOM helpers (LinkedIn's own classes are obfuscated/unstable; match by visible text) --
  function isActuallyVisible(b) {
    if (typeof b.checkVisibility === "function") {
      if (!b.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })) return false;
    } else if (b.offsetParent === null) {
      return false;
    }
    const rect = b.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return false;
    // A closed dropdown's items can still report non-zero size and "visible" CSS
    // (e.g. positioned off-screen, or clipped by an ancestor's overflow/height rather
    // than display:none). Hit-test the button's own center point - an item that isn't
    // really reachable there (behind other content, off-screen, clipped) fails this,
    // which is what actually matters: can a real click land on it.
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    if (cx < 0 || cy < 0 || cx > window.innerWidth || cy > window.innerHeight) return false;
    const hit = document.elementFromPoint(cx, cy);
    if (!hit || !(hit === b || b.contains(hit) || hit.contains(b))) return false;
    return true;
  }
  function visibleButtons(root) {
    // Message in particular sometimes renders as a plain <a> with no role="button" -
    // match any button/div/a that looks clickable, not just ones with an explicit role.
    return Array.from((root || document).querySelectorAll('button, div[role="button"], a[role="button"], a'))
      .filter(isActuallyVisible);
  }
  function buttonByText(regex, root) {
    return visibleButtons(root).find((b) => regex.test((b.innerText || b.getAttribute("aria-label") || "").trim()));
  }
  function profileScope() {
    // <main> also contains the "More profiles for you" sidebar, whose suggested-people
    // Follow/Following buttons match our exact-text regexes just as well as the real
    // target's own buttons. Scope to the top-card only: climb a few levels up from the
    // profile name heading, short of the point where sidebar modules share an ancestor.
    const h1 = document.querySelector("main h1");
    if (h1) {
      let el = h1;
      for (let i = 0; i < 4 && el.parentElement; i++) el = el.parentElement;
      return el;
    }
    return document.querySelector("main") || document.body;
  }
  function connectBtn() { return buttonByText(/^connect$/i, profileScope()) || buttonByText(/invite.*to connect/i, profileScope()); }
  function pendingBtn() { return buttonByText(/^pending$/i, profileScope()); }
  function messageBtn() { return buttonByText(/^message$/i, profileScope()); }
  function followBtn() { return buttonByText(/^follow$/i, profileScope()); }

  function activeDialog() {
    return Array.from(document.querySelectorAll('div[role="dialog"]')).find((d) => d.offsetParent !== null);
  }

  function setComposerText(el, text) {
    el.focus();
    document.execCommand("selectAll", false, null);
    document.execCommand("insertText", false, text);
    el.dispatchEvent(new Event("input", { bubbles: true }));
  }

  function messageComposer() {
    // Overlay message window LinkedIn opens bottom-right of the page.
    return Array.from(document.querySelectorAll('div[contenteditable="true"]'))
      .find((el) => el.offsetParent !== null && /message|reply/i.test(el.getAttribute("aria-label") || el.getAttribute("placeholder") || ""));
  }
  function messageSendBtn() {
    const composer = messageComposer();
    const container = composer ? composer.closest("form, div") : document;
    return buttonByText(/^send$/i, container) || buttonByText(/^send$/i, document);
  }

  // --- UI ------------------------------------------------------------------------------------
  let st, panel, statusEl, logEl, queueEl, timer;

  function buildPanel() {
    if (document.getElementById("elly-li-panel")) { panel = document.getElementById("elly-li-panel"); return; }
    panel = document.createElement("div");
    panel.id = "elly-li-panel";
    panel.style.cssText =
      "position:fixed;right:12px;bottom:12px;z-index:99999;width:320px;background:#fff;color:#111;" +
      "border:1px solid #0a66c2;border-radius:10px;padding:10px;font:12px system-ui;box-shadow:0 4px 16px #0003";
    panel.innerHTML =
      '<b>ELLY LinkedIn Automation</b><div id="el-status" style="margin:6px 0;color:#065"></div>' +
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
    store("liAutoStart").then((r) => { autoCb.checked = !!r.liAutoStart; });
    autoCb.onchange = () => setStore({ liAutoStart: autoCb.checked });
  }

  function render() {
    statusEl.textContent = st.running ? (st.rehearse ? "Rehearsal running" : "Running") : "Idle";
    logEl.innerHTML = st.log.slice(-8).map((l) => `<div>${l}</div>`).join("");
  }

  async function refreshQueueLabel() {
    const { liSettings = DEFAULTS } = await store("liSettings");
    const s = { ...DEFAULTS, ...liSettings };
    const doneToday = await doneTodayCount();
    const pending = (st.queueCache || []).length;
    queueEl.textContent = `Cached: ${pending} pending. Actions today ${doneToday}/${s.cap}.`;
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
    const { liSettings = DEFAULTS } = await store("liSettings");
    const s = { ...DEFAULTS, ...liSettings };
    const h = new Date().getHours();
    if (h < s.h1 || h >= s.h2) return stop(`Finished: outside ${s.h1}:00-${s.h2}:00`);
    const doneToday = await doneTodayCount();
    const remaining = s.cap - doneToday;
    if (remaining <= 0) return stop(`Finished: daily cap of ${s.cap} reached`);

    if (!st.queueCache || st.queueCache.length === 0) {
      await log("Fetching queue from ELLY...");
      try {
        const data = await bg({ type: "FETCH_QUEUE", channel: "linkedin", campaignId: s.campaignId || null, limit: 20 });
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
    location.href = job.linkedin_url;
  }

  async function reportAndDelay(setFields, status, note) {
    const j = st.current;
    try {
      await bg({ type: "REPORT", channel: "linkedin", campaignContactId: j.campaign_contact_id, set: setFields, result: status, note });
    } catch (err) {
      await log(`Warning: could not report result to ELLY (${err.message})`);
    }
    if (status === "ok") await recordDone();
    // Conservative pacing: a real connect/message send waits 3-8 min; a cheap
    // "already pending/unavailable" check waits much less since no action was taken.
    const cheap = note && /already pending|unavailable|follow-only/i.test(note);
    const delay = cheap ? 20000 + Math.random() * 20000 : 180000 + Math.random() * 300000;
    return Math.round(delay);
  }

  async function finish(setFields, status, note) {
    const j = st.current;
    const delayMs = await reportAndDelay(setFields, status, note);
    st.fails = status === "failed" ? st.fails + 1 : status === "ok" ? 0 : st.fails;
    st.current = null;
    await log(`${status}: ${j.name}${note ? " - " + note : ""}`);
    refreshQueueLabel();
    if (st.fails >= 3) return stop("3 failures in a row - stopped. Check LinkedIn manually.");
    st.waitUntil = Date.now() + delayMs;
    await saveRun(st);
    timer = setTimeout(nextJob, delayMs);
    statusEl.textContent = `Waiting ${Math.round(delayMs / 1000)}s before next`;
  }

  async function waitForProfileLoad() {
    const t0 = Date.now();
    while (Date.now() - t0 < 30000) {
      if (connectBtn() || pendingBtn() || messageBtn() || followBtn()) {
        // LinkedIn renders the action-button bar progressively (e.g. Follow before
        // Message) - give the rest of the bar a moment to finish mounting before
        // the caller reads button state, or an early button can hide a later one.
        await sleep(2500);
        return true;
      }
      await sleep(800);
    }
    return false;
  }

  async function doConnect(job) {
    // On some accounts LinkedIn sends the invite the instant Connect is clicked,
    // with no confirmation dialog at all - the click itself is the send, so in
    // rehearse mode we must never click it. Detect and log only.
    if (st.rehearse) {
      await log("Rehearsal OK: Connect button detected, NOT clicked - clicking it can send " +
        "immediately with no confirmation dialog on some accounts, so rehearsal can't safely " +
        "click it. Would send to: " + job.linkedin_url);
      return "rehearsed";
    }
    connectBtn().click();
    await sleep(1200 + Math.random() * 800);
    const dialog = activeDialog();
    if (!dialog) {
      // This account's UI sends the request instantly with no modal - already sent above.
      await sleep(1000);
    } else if (job.connection_note) {
      const addNote = buttonByText(/add a (free )?note/i, dialog);
      if (addNote) {
        addNote.click();
        await sleep(600);
        const textarea = dialog.querySelector("textarea");
        if (textarea) setComposerText(textarea, job.connection_note.slice(0, 300));
      }
      const sendBtn = buttonByText(/^send( invitation)?$/i, dialog) || buttonByText(/^send$/i, dialog);
      if (!sendBtn) return "failed: no send button in connect dialog";
      sendBtn.click();
    } else {
      const sendWithoutNote = buttonByText(/send without a note/i, dialog) || buttonByText(/^send$/i, dialog);
      if (!sendWithoutNote) return "failed: no send-without-note button in connect dialog";
      sendWithoutNote.click();
    }
    // Confirm: the button should change to "Pending".
    const t0 = Date.now();
    while (Date.now() - t0 < 15000) {
      if (pendingBtn()) return "sent";
      await sleep(800);
    }
    return "failed: could not confirm Pending state after sending connect request";
  }

  async function doMessage(job) {
    messageBtn().click();
    const t0 = Date.now();
    let composer = null;
    while (Date.now() - t0 < 15000) {
      composer = messageComposer();
      if (composer) break;
      await sleep(700);
    }
    if (!composer) {
      const all = Array.from(document.querySelectorAll('div[contenteditable="true"], textarea'))
        .filter((el) => el.offsetParent !== null)
        .map((el) => `${el.tagName}[aria-label="${el.getAttribute("aria-label") || ""}" placeholder="${el.getAttribute("placeholder") || ""}"]`);
      const dialogs = Array.from(document.querySelectorAll('div[role="dialog"]')).filter((d) => d.offsetParent !== null).length;
      await log("Debug: visible editable fields = " + JSON.stringify(all) + ", open dialogs = " + dialogs);
      return "failed: message composer did not open";
    }
    setComposerText(composer, job.first_message);
    await sleep(800 + Math.random() * 600);
    if (st.rehearse) {
      await log("Rehearsal OK: message typed, NOT sent. Clear it from the composer.");
      return "rehearsed";
    }
    const sendBtn = messageSendBtn();
    if (!sendBtn) return "failed: no send button found in message composer";
    const before = composer.innerText.trim();
    sendBtn.click();
    for (let i = 0; i < 12; i++) {
      await sleep(1000);
      const c = messageComposer();
      if (!c || c.innerText.trim() === "" || c.innerText.trim() !== before) return "sent";
    }
    return "failed: could not confirm the message was sent";
  }

  async function handleCurrent() {
    const job = st.current;
    st.phase = "handling";
    await saveRun(st);

    const loaded = await waitForProfileLoad();
    if (!loaded) return finish([], "failed", "profile did not load or no recognizable action button");

    const seen = visibleButtons(profileScope())
      .map((b) => (b.innerText || b.getAttribute("aria-label") || "").trim())
      .filter((t) => /connect|pending|message|follow/i.test(t));
    await log("Debug: visible action buttons = " + JSON.stringify(seen));

    if (!job.state.connection_sent || !job.state.connection_accepted) {
      if (connectBtn()) {
        const result = await doConnect(job);
        if (result === "rehearsed") { st.running = false; st.current = null; await saveRun(st); return render(); }
        if (result === "sent") return finish(["linkedin_connection_sent"], "ok", "connect request sent");
        return finish([], "failed", result);
      }
      if (pendingBtn()) return finish(["linkedin_connection_sent"], "ok", "already pending");
    }

    if (messageBtn()) {
      if (!job.state.connection_accepted) {
        // Message button visible implies the connection is live even if our records lagged.
        if (!job.state.first_message_sent) {
          const result = await doMessage(job);
          if (result === "rehearsed") { st.running = false; st.current = null; await saveRun(st); return render(); }
          if (result === "sent") return finish(["linkedin_connection_sent", "linkedin_connection_accepted", "linkedin_first_message_sent"], "ok", "connection accepted, first message sent");
          return finish(["linkedin_connection_sent", "linkedin_connection_accepted"], "failed", result);
        }
        return finish(["linkedin_connection_sent", "linkedin_connection_accepted"], "ok", "already connected, no message needed");
      }
      if (!job.state.first_message_sent) {
        const result = await doMessage(job);
        if (result === "rehearsed") { st.running = false; st.current = null; await saveRun(st); return render(); }
        if (result === "sent") return finish(["linkedin_first_message_sent"], "ok", "first message sent");
        return finish([], "failed", result);
      }
    }

    if (followBtn() && !connectBtn() && !messageBtn()) {
      return finish([], "unavailable", "follow-only profile, no Connect/Message action possible");
    }

    return finish([], "unavailable", "no actionable Connect/Message/Pending button found");
  }

  async function maybeAutoStart() {
    const { liAutoStart, liAutoStartDate } = await store(["liAutoStart", "liAutoStartDate"]);
    if (!liAutoStart || st.running) return;
    const today = todayStr();
    if (liAutoStartDate === today) return;
    const { liSettings = DEFAULTS } = await store("liSettings");
    const s = { ...DEFAULTS, ...liSettings };
    const h = new Date().getHours();
    if (h < s.h1 || h >= s.h2) return;
    await setStore({ liAutoStartDate: today });
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
    if (st.current && st.phase === "handling") return handleCurrent(); // page reloaded mid-handle
    const left = (st.waitUntil || 0) - Date.now();
    if (left > 0) { timer = setTimeout(nextJob, left); statusEl.textContent = `Waiting ${Math.round(left / 1000)}s before next`; }
    else nextJob();
  })();
})();
