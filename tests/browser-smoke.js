"use strict";

const { spawn } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const chromePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const root = path.resolve(__dirname, "..");
const profile = path.join(root, ".chrome-cdp-smoke");
const qaDirectory = path.join(root, "qa");
const port = 9333;
const delay = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));

async function waitForAppServer() {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const response = await fetch("http://127.0.0.1:4173/");
      if (response.ok) return;
    } catch (_) {}
    await delay(150);
  }
  throw new Error("Local PWA server did not start");
}

async function waitForTarget() {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const targets = await fetch(`http://127.0.0.1:${port}/json/list`).then(response => response.json());
      const page = targets.find(target => target.type === "page");
      if (page) return page;
    } catch (_) {}
    await delay(150);
  }
  throw new Error("Chrome DevTools target did not start");
}

class CDP {
  constructor(url) {
    this.url = url;
    this.id = 0;
    this.pending = new Map();
    this.events = new Map();
  }
  async open() {
    this.socket = new WebSocket(this.url);
    await new Promise((resolve, reject) => {
      this.socket.addEventListener("open", resolve, { once: true });
      this.socket.addEventListener("error", reject, { once: true });
    });
    this.socket.addEventListener("message", event => {
      const message = JSON.parse(event.data);
      if (message.id && this.pending.has(message.id)) {
        const { resolve, reject } = this.pending.get(message.id);
        this.pending.delete(message.id);
        if (message.error) reject(new Error(message.error.message)); else resolve(message.result);
      }
      if (message.method && this.events.has(message.method)) this.events.get(message.method).forEach(listener => listener(message.params));
    });
  }
  on(method, listener) {
    const listeners = this.events.get(method) || [];
    listeners.push(listener);
    this.events.set(method, listeners);
  }
  send(method, params = {}) {
    const id = ++this.id;
    this.socket.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve, reject) => this.pending.set(id, { resolve, reject }));
  }
  async evaluate(expression) {
    const result = await this.send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.text || "Runtime evaluation failed");
    return result.result.value;
  }
  close() { this.socket.close(); }
}

async function screenshot(cdp, filename) {
  const result = await cdp.send("Page.captureScreenshot", { format: "png", fromSurface: true, captureBeyondViewport: false });
  fs.mkdirSync(qaDirectory, { recursive: true });
  fs.writeFileSync(path.join(qaDirectory, filename), Buffer.from(result.data, "base64"));
}

async function main() {
  if (!fs.existsSync(chromePath)) throw new Error("Chrome is not installed");
  const appServer = spawn(process.execPath, [path.join(__dirname, "serve-smoke.js")], { cwd: root, stdio: "ignore" });
  await waitForAppServer();
  const browser = spawn(chromePath, [
    "--headless=new", "--disable-gpu", "--hide-scrollbars", "--no-first-run",
    `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, "about:blank"
  ], { stdio: "ignore" });
  let cdp;
  try {
    const target = await waitForTarget();
    cdp = new CDP(target.webSocketDebuggerUrl);
    await cdp.open();
    const exceptions = [];
    const consoleErrors = [];
    cdp.on("Runtime.exceptionThrown", event => exceptions.push(event.exceptionDetails.text || "Uncaught exception"));
    cdp.on("Runtime.consoleAPICalled", event => {
      if (event.type === "error") consoleErrors.push(event.args.map(argument => argument.value || argument.description || "").join(" "));
    });
    await cdp.send("Page.enable");
    await cdp.send("Runtime.enable");
    await cdp.send("Emulation.setDeviceMetricsOverride", {
      width: 390, height: 844, deviceScaleFactor: 3, mobile: true,
      screenWidth: 390, screenHeight: 844, positionX: 0, positionY: 0
    });
    await cdp.send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 });
    await cdp.send("Page.navigate", { url: "http://127.0.0.1:4173" });
    await delay(3500);
    await cdp.evaluate(`(() => { localStorage.clear(); sessionStorage.clear(); return true; })()`);
    await cdp.send("Page.reload", { ignoreCache: true });
    await delay(800);

    const initial = await cdp.evaluate(`(() => ({
      innerWidth,
      innerHeight,
      scrollWidth: document.documentElement.scrollWidth,
      hasTask: document.body.innerText.includes("英语演讲预习"),
      hasDodo: Boolean(document.querySelector("#nowDodo .dodoCharacter")),
      activeView: document.querySelector(".view.active")?.id,
      tabbarInsideViewport: (() => { const r=document.querySelector(".tabbar").getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth && r.bottom <= innerHeight; })()
    }))()`);
    await screenshot(cdp, "mobile-now-390x844@3x.png");

    const interaction = await cdp.evaluate(`(async () => {
      document.querySelector('[data-view="settings"]').click();
      await new Promise(resolve => setTimeout(resolve, 250));
      const clickCharacter = count => {
        const node = document.querySelector('#charPreview .dodoCharacter');
        const rect = node.getBoundingClientRect();
        for (let index=0; index<count; index+=1) node.dispatchEvent(new MouseEvent('click',{bubbles:true,clientX:rect.left+rect.width*.55,clientY:rect.top+rect.height*.48}));
        return node;
      };
      document.querySelector('#charButtons [data-state="calm"]').click();
      let node = clickCharacter(10);
      const calmAfterTen = node.dataset.state;
      document.querySelector('#charButtons [data-state="notice"]').click();
      node = clickCharacter(10);
      const noticeAfterTen = node.dataset.state;
      const states = {};
      for (const state of ['calm','notice','urgent','danger','done']) {
        document.querySelector('#charButtons [data-state="'+state+'"]').click();
        states[state] = document.querySelector('#charPreview .dodoCharacter').dataset.state;
      }
      const views = {};
      for (const view of ['now','today','focus','settings']) {
        document.querySelector('[data-view="'+view+'"]').click();
        views[view] = document.querySelector('.view.active')?.id;
      }
      const island = document.querySelector('#island');
      return {
        calmAfterTen, noticeAfterTen, states, views,
        finalState: document.querySelector('#charPreview .dodoCharacter').dataset.state,
        islandText: island.innerText,
        islandHTML: island.innerHTML,
        islandColor: getComputedStyle(island).color,
        addButtonText: document.querySelector('#addTask').innerText
      };
    })()`);
    await delay(500);
    await screenshot(cdp, "mobile-settings-390x844@3x.png");
    const serviceWorker = await cdp.evaluate(`navigator.serviceWorker.ready.then(registration => ({ active: Boolean(registration.active), scope: registration.scope }))`);

    const created = await cdp.evaluate(`(() => {
      document.querySelector('#addTask').click();
      const modalOpen = !document.querySelector('#modal').classList.contains('hidden');
      document.querySelector('#title').value = '浏览器验收任务';
      const future = new Date(Date.now() + 80 * 60000);
      document.querySelector('#deadline').value = new Date(future.getTime() - future.getTimezoneOffset() * 60000).toISOString().slice(0,16);
      document.querySelector('#duration').value = '25';
      document.querySelector('#category').value = '工作';
      document.querySelector('#priority').value = 'important';
      document.querySelector('#form').requestSubmit();
      const task = JSON.parse(localStorage.getItem('dodo.data.v6')).tasks.find(item => item.title === '浏览器验收任务');
      return { modalOpen, modalClosed: document.querySelector('#modal').classList.contains('hidden'), taskId: task?.id, source: task?.source, category: task?.category, priority: task?.priority };
    })()`);
    await cdp.send("Page.reload", { ignoreCache: true });
    await delay(700);
    const persisted = await cdp.evaluate(`(() => {
      const task = JSON.parse(localStorage.getItem('dodo.data.v6')).tasks.find(item => item.title === '浏览器验收任务');
      document.querySelector('[data-view="today"]').click();
      document.querySelector('#categoryFilters [data-category="工作"]').click();
      const rows = [...document.querySelectorAll('#todayList .taskRow')];
      const filtered = rows.every(row => row.innerText.includes('工作'));
      const row = rows.find(item => item.dataset.taskId === task.id);
      row.querySelector('button.play').click();
      return { exists: Boolean(task), filtered, focusView: document.querySelector('.view.active')?.id, focusTitle: document.querySelector('.focusCard .meta')?.innerText, taskId: task.id };
    })()`);
    const focus = await cdp.evaluate(`(async () => {
      document.querySelector('#pauseFocus').click();
      const paused = document.querySelector('#focusStatus').innerText;
      const first = document.querySelector('#focusTimer').innerText;
      await new Promise(resolve => setTimeout(resolve, 1200));
      const second = document.querySelector('#focusTimer').innerText;
      document.querySelector('#pauseFocus').click();
      const resumed = document.querySelector('#focusStatus').innerText;
      await new Promise(resolve => setTimeout(resolve, 1200));
      const third = document.querySelector('#focusTimer').innerText;
      document.querySelector('#finishFocus').click();
      const doneVisible = !document.querySelector('#doneFlash').classList.contains('hidden');
      const doneState = document.querySelector('#doneDodo .dodoCharacter')?.dataset.state;
      return { paused, first, second, resumed, third, doneVisible, doneState };
    })()`);
    await delay(2300);
    const completed = await cdp.evaluate(`(() => {
      const task = JSON.parse(localStorage.getItem('dodo.data.v6')).tasks.find(item => item.title === '浏览器验收任务');
      return { status: task.status, overlayClosed: document.querySelector('#doneFlash').classList.contains('hidden') };
    })()`);
    const danger = await cdp.evaluate(`(() => {
      document.querySelector('[data-view="settings"]').click();
      document.querySelector('#demoDanger').click();
      const shown = !document.querySelector('#dangerScreen').classList.contains('hidden');
      const title = document.querySelector('#dangerTitle').innerText;
      document.querySelector('#dangerLater').click();
      const snoozed = JSON.parse(localStorage.getItem('dodo.data.v6')).tasks.find(item => item.title === title)?.snoozeUntil;
      const hiddenAfterLater = document.querySelector('#dangerScreen').classList.contains('hidden');
      document.querySelector('#demoDanger').click();
      const secondShown = !document.querySelector('#dangerScreen').classList.contains('hidden');
      document.querySelector('#dangerStart').click();
      return { shown, title, snoozed: Date.parse(snoozed) > Date.now(), hiddenAfterLater, secondShown, startView: document.querySelector('.view.active')?.id };
    })()`);
    const demoReset = await cdp.evaluate(`(() => {
      document.querySelector('[data-view="settings"]').click();
      document.querySelector('#resetDemo').click();
      const tasks = JSON.parse(localStorage.getItem('dodo.data.v6')).tasks;
      return { userTaskPreserved: tasks.some(task => task.title === '浏览器验收任务' && task.status === 'completed' && task.source === 'user'), demoCount: tasks.filter(task => task.source === 'demo').length };
    })()`);
    await cdp.send("Browser.grantPermissions", { origin: "http://127.0.0.1:4173", permissions: ["notifications"] });
    const notification = await cdp.evaluate(`(async () => {
      document.querySelector('#testNotification').click();
      await new Promise(resolve => setTimeout(resolve, 500));
      const registration = await navigator.serviceWorker.ready;
      const notifications = await registration.getNotifications({ tag: 'dodo-v54-test' });
      return { permission: Notification.permission, shown: notifications.length > 0, silent: notifications[0]?.silent, title: notifications[0]?.title };
    })()`);
    await cdp.send("Emulation.setDeviceMetricsOverride", { width: 320, height: 640, deviceScaleFactor: 3, mobile: true, screenWidth: 320, screenHeight: 640, positionX: 0, positionY: 0 });
    const smallScreen = await cdp.evaluate(`(() => {
      document.querySelector('#addTask').click();
      const sheet = document.querySelector('.sheet').getBoundingClientRect();
      const modalOpen = !document.querySelector('#modal').classList.contains('hidden');
      document.querySelector('#closeModal').click();
      return { width: innerWidth, scrollWidth: document.documentElement.scrollWidth, sheetWithinViewport: sheet.left >= 0 && sheet.right <= innerWidth && sheet.top >= 0 && sheet.bottom <= innerHeight, modalOpen, modalClosed: document.querySelector('#modal').classList.contains('hidden') };
    })()`);

    const idleObservation = await cdp.evaluate(`(async () => {
      document.querySelector('#charButtons [data-state="calm"]').click();
      const node = document.querySelector('#charPreview .dodoCharacter');
      const started = performance.now();
      const actions = [];
      node.addEventListener('dodochange', event => {
        if (event.detail.action !== 'idle') actions.push({ at: Math.round(performance.now() - started), action: event.detail.action, state: event.detail.state });
      });
      await new Promise(resolve => setTimeout(resolve, 30000));
      const starts = actions.map(item => item.at);
      const gaps = starts.slice(1).map((time, index) => time - starts[index]);
      return { state: node.dataset.state, actions, gaps, nonFixedGaps: new Set(gaps.map(gap => Math.round(gap / 250))).size > 1 };
    })()`);

    const result = { initial, interaction, serviceWorker, created, persisted, focus, completed, danger, demoReset, notification, smallScreen, idleObservation, exceptions, consoleErrors };
    console.log(JSON.stringify(result, null, 2));
    const statesMatch = Object.entries(interaction.states).every(([button, state]) => button === state);
    const viewsWork = Object.entries(interaction.views).every(([tab, view]) => view === `view-${tab}`);
    const workflowWorks = created.modalOpen && created.modalClosed && created.source === "user" && created.category === "工作" && created.priority === "important" && persisted.exists && persisted.filtered && persisted.focusView === "view-focus" && focus.paused === "已暂停" && focus.first === focus.second && focus.resumed === "专注进行中" && focus.third !== focus.second && focus.doneVisible && focus.doneState === "done" && completed.status === "completed" && completed.overlayClosed && danger.shown && danger.snoozed && danger.hiddenAfterLater && danger.secondShown && danger.startView === "view-focus" && demoReset.userTaskPreserved && demoReset.demoCount === 5 && notification.permission === "granted" && notification.shown && notification.silent && smallScreen.width === 320 && smallScreen.scrollWidth <= 320 && smallScreen.sheetWithinViewport && smallScreen.modalOpen && smallScreen.modalClosed;
    if (initial.innerWidth !== 390 || initial.scrollWidth > 390 || !initial.hasTask || !initial.hasDodo || !initial.tabbarInsideViewport || interaction.calmAfterTen !== "calm" || interaction.noticeAfterTen !== "notice" || !statesMatch || !viewsWork || !serviceWorker.active || !workflowWorks || idleObservation.state !== "calm" || idleObservation.actions.length < 2 || idleObservation.actions.some(item => item.state !== "calm") || !idleObservation.nonFixedGaps || exceptions.length || consoleErrors.length) process.exitCode = 1;
  } finally {
    if (cdp) cdp.close();
    browser.kill();
    appServer.kill();
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
