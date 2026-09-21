(function () {
  "use strict";

  const $ = selector => document.querySelector(selector);
  const $$ = selector => [...document.querySelectorAll(selector)];
  const storage = new DodoStorage.StorageManager(localStorage);
  const data = storage.load();
  let tasks = data.tasks;
  let settings = data.settings;
  let focusId = sessionStorage.getItem("dodo.focusId") || null;
  let currentView = "now";
  let previewState = "calm";
  let todayCategory = "全部";
  let statusTimer = null;
  let focusFrame = null;
  let focusSecond = null;
  let toastTimer = null;

  const characters = { brand: null, now: null, focus: null, island: null, preview: null, danger: null, done: null };
  const notificationManager = new DodoNotifications.NotificationManager({
    serverUrl: settings.pushServerUrl || $("meta[name='dodo-push-server']").content
  });

  function escapeHTML(value) {
    return String(value).replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[character]);
  }

  function when(date) {
    return new Date(date).toLocaleString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });
  }

  function words(milliseconds) {
    const overdue = milliseconds < 0;
    const minutes = Math.floor(Math.abs(milliseconds) / 60000);
    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;
    return `${overdue ? "超时 " : ""}${hours ? `${hours}小时 ` : ""}${rest}分钟`;
  }

  function clock(milliseconds) {
    const negative = milliseconds < 0;
    const seconds = Math.floor(Math.abs(milliseconds) / 1000);
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const rest = seconds % 60;
    return `${negative ? "-" : ""}${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
  }

  function showToast(message, duration = 3000) {
    clearTimeout(toastTimer);
    $("#toast").textContent = message;
    $("#toast").classList.remove("hidden");
    toastTimer = setTimeout(() => $("#toast").classList.add("hidden"), duration);
  }

  function saveTasks() {
    tasks = storage.setTasks(tasks);
  }

  function saveSettings() {
    settings = storage.setSettings(settings);
  }

  function primary() {
    return DodoUrgency.primaryTask(tasks);
  }

  function mountCharacter(slot, container, options) {
    characters[slot] = DodoCharacter({ mount: container, ...options });
    return characters[slot];
  }

  function disposeCharactersWithin(root) {
    root.querySelectorAll(".dodoCharacter").forEach(node => {
      const mount = node.parentElement;
      if (mount && mount._dodoCharacter) mount._dodoCharacter.destroy();
    });
  }

  function renderBrand() {
    mountCharacter("brand", $("#brandDodo"), { state: "calm", size: 44, interactive: false, idle: false, label: "小待" });
  }

  function stateCopy(state) {
    return {
      calm: "慢下来，<br>一件件来。",
      notice: "差不多可以<br>开始啦 ♡",
      urgent: "现在开始，<br>时间比较稳。",
      danger: "先做这件事。",
      done: "完成啦！"
    }[state];
  }

  function renderNow() {
    const root = $("#nowRoot");
    const task = primary();
    if (!task) {
      if (root.dataset.taskId !== "none") {
        root.dataset.taskId = "none";
        root.dataset.state = "calm";
        disposeCharactersWithin(root);
        root.innerHTML = `<div class="empty"><div id="nowDodo"></div><h2>今天暂时没有事情</h2><p>有新的任务时，小待会帮你看着时间。</p></div>`;
        mountCharacter("now", $("#nowDodo"), { state: "calm", size: 190, interactive: true, idle: true, label: "平静的小待" });
      }
      return;
    }

    const state = DodoUrgency.stateForTask(task);
    const taskChanged = root.dataset.taskId !== task.id;
    if (taskChanged) {
      root.dataset.taskId = task.id;
      root.dataset.state = state;
      disposeCharactersWithin(root);
      root.innerHTML = `<div class="hero">
        <div class="stage"><div class="whisper" id="nowWhisper">${stateCopy(state)}</div><div id="nowDodo"></div></div>
        <div class="card">
          <span class="tag">${escapeHTML(task.category)}</span>
          <div class="title">${escapeHTML(task.title)}</div>
          <div class="meta">◷ ${when(task.deadline)} 截止 · 预计 ${task.duration} 分钟</div>
          <div class="remain">${DodoUrgency.isOverdue(task) ? "已经" : "还有"} <strong id="nowRemaining">${words(Date.parse(task.deadline) - Date.now())}</strong></div>
          <button class="primary wide" id="startPrimary" type="button">▶ 开始任务</button>
        </div>
        <div class="quote">“每一个小小的开始，<br>都会让你更靠近想要的自己。”</div>
      </div>`;
      mountCharacter("now", $("#nowDodo"), { state, size: 240, interactive: true, idle: true, label: `${state} 状态的小待` });
      $("#startPrimary").addEventListener("click", () => startFocus(task.id));
      return;
    }

    if (root.dataset.state !== state) {
      root.dataset.state = state;
      characters.now.setState(state);
      $("#nowWhisper").innerHTML = stateCopy(state);
    }
    const remaining = $("#nowRemaining");
    if (remaining) remaining.textContent = words(Date.parse(task.deadline) - Date.now());
  }

  function renderToday(force = false) {
    const root = $("#todayList");
    const filtered = todayCategory === "全部" ? tasks : tasks.filter(task => task.category === todayCategory);
    const signature = `${todayCategory}|${filtered.map(task => `${task.id}:${task.status}:${DodoUrgency.stateForTask(task)}`).join("|")}`;
    if (!force && root.dataset.signature === signature) return;
    root.dataset.signature = signature;
    disposeCharactersWithin(root);
    if (!filtered.length) {
      root.innerHTML = `<div class="empty"><p>这个分类还没有任务。</p></div>`;
      return;
    }
    root.innerHTML = filtered.slice().sort((a, b) => Date.parse(a.deadline) - Date.parse(b.deadline)).map(task => `
      <article class="taskRow ${task.status === "completed" ? "completed" : ""}" data-task-id="${escapeHTML(task.id)}">
        <div class="taskIcon" data-character-for="${escapeHTML(task.id)}"></div>
        <div><strong>${escapeHTML(task.title)}</strong><div class="sub">${task.status === "completed" ? "已完成" : when(task.deadline)} · ${escapeHTML(task.category)}</div></div>
        <button class="play" type="button" ${task.status === "completed" ? "disabled" : ""} aria-label="${task.status === "completed" ? "已完成" : "开始任务"}">${task.status === "completed" ? "✓" : "▶"}</button>
      </article>`).join("");
    filtered.forEach(task => {
      const container = root.querySelector(`[data-character-for="${CSS.escape(task.id)}"]`);
      if (container) DodoCharacter({ mount: container, state: DodoUrgency.stateForTask(task), size: 54, interactive: false, idle: false, label: `${task.title}的状态` });
    });
  }

  function focusElapsed(task, now = Date.now()) {
    const prior = Math.max(0, Number(task.elapsedFocusMs) || 0);
    if (task.isPaused || !task.focusStartedAt) return prior;
    return prior + Math.max(0, now - Date.parse(task.focusStartedAt));
  }

  function focusRemaining(task, now = Date.now()) {
    return Number(task.duration) * 60000 - focusElapsed(task, now);
  }

  function renderFocus() {
    const root = $("#focusRoot");
    const task = tasks.find(item => item.id === focusId && item.status !== "completed");
    if (!task) {
      if (root.dataset.taskId !== "none") {
        root.dataset.taskId = "none";
        disposeCharactersWithin(root);
        root.innerHTML = `<div class="empty"><div id="focusDodo"></div><h2>还没有开始任务</h2><p>从“现在”或“今天”选择一件事开始。</p></div>`;
        mountCharacter("focus", $("#focusDodo"), { state: "calm", size: 185, interactive: true, idle: true, label: "等待任务的小待" });
      }
      stopFocusAnimation();
      return;
    }

    const state = DodoUrgency.stateForTask(task);
    if (root.dataset.taskId !== task.id) {
      root.dataset.taskId = task.id;
      root.dataset.state = state;
      disposeCharactersWithin(root);
      root.innerHTML = `<div class="focusCard">
        <div class="focusTitle">专注中</div>
        <div class="meta">${escapeHTML(task.title)} · ${escapeHTML(task.category)}</div>
        <div class="focusStage"><div id="focusDodo"></div></div>
        <div class="ring" id="focusRing"><div class="ringInner"><div><div class="focusTime" id="focusTimer">00:00:00</div><div class="meta" id="focusStatus">${task.isPaused ? "已暂停" : "专注进行中"}</div><div class="focusEncourage">你可以的！♡</div></div></div></div>
        <div class="focusActions">
          <button class="circleBtn" id="leaveFocus" type="button" aria-label="退出专注">×</button>
          <button class="circleBtn main" id="pauseFocus" type="button" aria-label="${task.isPaused ? "继续" : "暂停"}">${task.isPaused ? "▶" : "Ⅱ"}</button>
          <button class="circleBtn" id="finishFocus" type="button" aria-label="完成任务">✓</button>
        </div>
      </div>`;
      mountCharacter("focus", $("#focusDodo"), { state, size: 205, interactive: true, idle: true, label: `专注中的小待，${state} 状态` });
      $("#leaveFocus").addEventListener("click", leaveFocus);
      $("#pauseFocus").addEventListener("click", toggleFocusPause);
      $("#finishFocus").addEventListener("click", () => completeTask(task.id));
    } else if (root.dataset.state !== state) {
      root.dataset.state = state;
      characters.focus.setState(state);
    }
    updateFocusClock();
    if (currentView === "focus" && !document.hidden) startFocusAnimation();
  }

  function updateFocusClock() {
    const task = tasks.find(item => item.id === focusId && item.status !== "completed");
    if (!task) return;
    const remaining = focusRemaining(task);
    const timer = $("#focusTimer");
    const ring = $("#focusRing");
    const status = $("#focusStatus");
    const pause = $("#pauseFocus");
    if (timer) timer.textContent = clock(remaining);
    if (ring) ring.style.setProperty("--progress", `${Math.max(8, Math.min(100, focusElapsed(task) / (task.duration * 60000) * 100))}%`);
    if (status) status.textContent = task.isPaused ? "已暂停" : remaining <= 0 ? "已达到预计时长" : "专注进行中";
    if (pause) { pause.textContent = task.isPaused ? "▶" : "Ⅱ"; pause.setAttribute("aria-label", task.isPaused ? "继续" : "暂停"); }
  }

  function startFocusAnimation() {
    if (focusFrame) return;
    const frame = timestamp => {
      if (document.hidden || currentView !== "focus") { focusFrame = null; return; }
      const second = Math.floor(timestamp / 1000);
      if (second !== focusSecond) { focusSecond = second; updateFocusClock(); }
      focusFrame = requestAnimationFrame(frame);
    };
    focusFrame = requestAnimationFrame(frame);
  }

  function stopFocusAnimation() {
    if (focusFrame) cancelAnimationFrame(focusFrame);
    focusFrame = null;
    focusSecond = null;
  }

  function renderIsland() {
    const root = $("#island");
    const task = primary();
    if (!settings.island || !task) {
      root.classList.add("hidden");
      root.dataset.taskId = "";
      if (characters.island) { characters.island.destroy(); characters.island = null; }
      return;
    }
    const state = DodoUrgency.stateForTask(task);
    if (root.dataset.taskId !== task.id) {
      root.dataset.taskId = task.id;
      root.dataset.state = state;
      disposeCharactersWithin(root);
      root.innerHTML = `<div class="islandMini" id="islandDodo"></div><strong>${escapeHTML(task.title)}</strong><span id="islandRemain"></span>`;
      mountCharacter("island", $("#islandDodo"), { state, size: 31, interactive: false, idle: false, label: `${state} 状态的小待` });
    } else if (root.dataset.state !== state) {
      root.dataset.state = state;
      characters.island.setState(state);
    }
    $("#islandRemain").textContent = words(Date.parse(task.deadline) - Date.now());
    root.classList.remove("hidden");
  }

  function updateEngineLog() {
    if (!characters.preview) return;
    $("#engineState").textContent = characters.preview.state;
    $("#engineEmotion").textContent = characters.preview.emotion;
    $("#engineAction").textContent = characters.preview.action;
  }

  function renderCharacterLab() {
    const labels = { calm: "Calm", notice: "Notice", urgent: "Urgent", danger: "Danger", done: "Done" };
    const buttons = $("#charButtons");
    if (!buttons.children.length) {
      buttons.innerHTML = DodoCharacter.STATES.map(state => `<button class="charBtn" type="button" data-state="${state}">${labels[state]}</button>`).join("");
      buttons.addEventListener("click", event => {
        const button = event.target.closest("button[data-state]");
        if (!button) return;
        previewState = button.dataset.state;
        characters.preview.setState(previewState);
        $$("#charButtons button").forEach(item => item.classList.toggle("active", item.dataset.state === previewState));
        updateEngineLog();
      });
    }
    $$("#charButtons button").forEach(item => item.classList.toggle("active", item.dataset.state === previewState));
    if (!characters.preview || !characters.preview.el.isConnected) {
      mountCharacter("preview", $("#charPreview"), { state: previewState, size: 220, interactive: true, idle: true, label: "角色状态测试小待" });
      $("#charPreview").addEventListener("dodochange", updateEngineLog);
    } else {
      characters.preview.setState(previewState);
    }
    updateEngineLog();
  }

  function updateNotificationStatus() {
    const status = notificationManager.capability();
    const pill = $("#notificationStatus");
    pill.textContent = status.label;
    pill.classList.toggle("ok", status.code === "granted");
    pill.classList.toggle("warn", ["install-required", "denied"].includes(status.code));
  }

  function renderSettings() {
    $("#toggleIsland").checked = settings.island;
    $("#toggleDanger").checked = settings.danger;
    $("#pushServerUrl").value = settings.pushServerUrl || "";
    $("#lockPreviewTime").textContent = new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false });
    renderCharacterLab();
    updateNotificationStatus();
  }

  function renderAll(forceToday = false) {
    renderNow();
    renderToday(forceToday);
    renderFocus();
    renderIsland();
    if (currentView === "settings") renderSettings();
  }

  function updateVisibleClocks() {
    const task = primary();
    if (task) {
      const remaining = $("#nowRemaining");
      if (remaining) remaining.textContent = words(Date.parse(task.deadline) - Date.now());
      const islandRemaining = $("#islandRemain");
      if (islandRemaining) islandRemaining.textContent = words(Date.parse(task.deadline) - Date.now());
    }
  }

  function dangerKey(task) {
    return `v54danger.${task.id}.${Date.parse(task.deadline)}.${task.snoozeUntil || "ready"}`;
  }

  function maybeDanger(force = false) {
    const task = primary();
    if (!task || (!settings.danger && !force)) { $("#dangerScreen").classList.add("hidden"); return; }
    const state = DodoUrgency.stateForTask(task);
    if (!force && state !== "danger") { $("#dangerScreen").classList.add("hidden"); return; }
    if (!force && focusId === task.id) { $("#dangerScreen").classList.add("hidden"); return; }
    const key = dangerKey(task);
    if (!force && sessionStorage.getItem(key)) return;
    if (!force) sessionStorage.setItem(key, "1");
    $("#dangerTitle").textContent = task.title;
    $("#dangerMeta").textContent = `${when(task.deadline)} 截止 · ${DodoUrgency.isOverdue(task) ? "已经" : "还有"} ${words(Date.parse(task.deadline) - Date.now())}`;
    mountCharacter("danger", $("#dangerDodo"), { state: "danger", size: 250, interactive: true, idle: false, label: "坚定提醒的小待" });
    characters.danger.play("firm");
    $("#dangerStart").onclick = () => { $("#dangerScreen").classList.add("hidden"); startFocus(task.id); };
    $("#dangerLater").onclick = () => {
      task.snoozeUntil = new Date(Date.now() + 15 * 60000).toISOString();
      saveTasks();
      $("#dangerScreen").classList.add("hidden");
      renderAll(true);
      showToast("小待会在 15 分钟后再次提醒你");
    };
    $("#dangerScreen").classList.remove("hidden");
  }

  function startFocus(id) {
    const task = tasks.find(item => item.id === id && item.status !== "completed");
    if (!task) return;
    focusId = id;
    sessionStorage.setItem("dodo.focusId", id);
    if (!task.startedAt) task.startedAt = new Date().toISOString();
    if (task.isPaused || !task.focusStartedAt) task.focusStartedAt = new Date().toISOString();
    task.isPaused = false;
    saveTasks();
    $("#dangerScreen").classList.add("hidden");
    switchView("focus");
  }

  function pauseTask(task) {
    if (!task || task.isPaused) return;
    task.elapsedFocusMs = focusElapsed(task);
    task.focusStartedAt = null;
    task.isPaused = true;
  }

  function toggleFocusPause() {
    const task = tasks.find(item => item.id === focusId && item.status !== "completed");
    if (!task) return;
    if (task.isPaused) {
      task.focusStartedAt = new Date().toISOString();
      task.isPaused = false;
      if (characters.focus) characters.focus.play("acknowledge");
    } else {
      pauseTask(task);
      if (characters.focus) characters.focus.play("halfBlink");
    }
    saveTasks();
    updateFocusClock();
  }

  function leaveFocus() {
    const task = tasks.find(item => item.id === focusId && item.status !== "completed");
    pauseTask(task);
    saveTasks();
    focusId = null;
    sessionStorage.removeItem("dodo.focusId");
    stopFocusAnimation();
    switchView("now");
  }

  async function completeTask(id) {
    const task = tasks.find(item => item.id === id);
    if (!task) return;
    pauseTask(task);
    task.status = "completed";
    task.completedAt = new Date().toISOString();
    saveTasks();
    focusId = null;
    sessionStorage.removeItem("dodo.focusId");
    stopFocusAnimation();
    mountCharacter("done", $("#doneDodo"), { state: "done", size: 255, interactive: true, idle: false, label: "庆祝完成的小待" });
    $("#doneFlash").classList.remove("hidden");
    characters.done.play("celebrate");
    if (settings.pushServerUrl) notificationManager.cancelTask(task.id).catch(() => undefined);
    setTimeout(() => { $("#doneFlash").classList.add("hidden"); switchView("now"); }, 2100);
  }

  function switchView(view) {
    currentView = view;
    $$(".view").forEach(node => node.classList.toggle("active", node.id === `view-${view}`));
    $$(".tab").forEach(node => node.classList.toggle("active", node.dataset.view === view));
    renderAll();
    updateVisibleClocks();
    if (view === "focus") startFocusAnimation(); else stopFocusAnimation();
  }

  function openModal() {
    const target = new Date(Date.now() + 2 * 3600000);
    target.setSeconds(0, 0);
    $("#deadline").value = new Date(target.getTime() - target.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    $("#modal").classList.remove("hidden");
    document.body.classList.add("modalOpen");
    requestAnimationFrame(() => $("#title").focus());
  }

  function closeModal() {
    $("#modal").classList.add("hidden");
    document.body.classList.remove("modalOpen");
  }

  function scheduleStatusTick(immediate = false) {
    clearTimeout(statusTimer);
    if (document.hidden) return;
    statusTimer = setTimeout(() => {
      updateVisibleClocks();
      renderNow();
      renderToday();
      renderFocus();
      renderIsland();
      maybeDanger(false);
      scheduleStatusTick();
    }, immediate ? 0 : 5000);
  }

  async function enableNotifications() {
    try {
      await notificationManager.requestPermission();
      updateNotificationStatus();
      showToast(settings.pushServerUrl ? "通知已开启，并已连接 Web Push Server" : "通知已开启；现在可以发送即时测试通知");
    } catch (error) {
      updateNotificationStatus();
      showToast(error.message, 4800);
    }
  }

  async function testNotification() {
    if (characters.preview) characters.preview.play("notification");
    try {
      await notificationManager.sendTest(primary());
      showToast(settings.pushServerUrl ? "测试推送已排程，约 10～15 秒后到达；请现在锁屏" : "即时测试通知已发送；请到锁屏或通知中心查看");
    } catch (error) {
      showToast(error.message, 4800);
    }
  }

  async function syncNotifications() {
    try {
      const results = await notificationManager.syncTasks(tasks);
      showToast(`已同步 ${results.length} 个任务的 Notice / Urgent / Danger 提醒`);
    } catch (error) {
      showToast(error.message, 4800);
    }
  }

  function savePushServer() {
    const value = $("#pushServerUrl").value.trim().replace(/\/+$/, "");
    if (value) {
      try {
        const url = new URL(value);
        if (url.protocol !== "https:" && url.hostname !== "localhost") throw new Error();
      } catch (_) {
        showToast("请输入有效的 HTTPS Push Server 地址");
        return;
      }
    }
    settings.pushServerUrl = value;
    saveSettings();
    notificationManager.setServerUrl(value);
    showToast(value ? "Push Server 地址已保存" : "已切换为仅即时测试通知");
  }

  function bindEvents() {
    $("#addTask").addEventListener("click", openModal);
    $("#addTask2").addEventListener("click", openModal);
    $("#closeModal").addEventListener("click", closeModal);
    $("#modal").addEventListener("click", event => { if (event.target.id === "modal") closeModal(); });
    document.addEventListener("keydown", event => { if (event.key === "Escape" && !$("#modal").classList.contains("hidden")) closeModal(); });

    $("#form").addEventListener("submit", event => {
      event.preventDefault();
      const task = DodoStorage.makeTask(
        $("#title").value.trim(), 60, Number($("#duration").value), $("#category").value, $("#priority").value, "user"
      );
      task.deadline = new Date($("#deadline").value).toISOString();
      tasks.push(task);
      saveTasks();
      event.currentTarget.reset();
      $("#duration").value = 45;
      closeModal();
      renderAll(true);
      if (settings.pushServerUrl && typeof Notification !== "undefined" && Notification.permission === "granted") {
        notificationManager.syncTasks([task]).catch(() => undefined);
      }
      showToast("任务已交给小待");
    });

    $$(".tab").forEach(button => button.addEventListener("click", () => switchView(button.dataset.view)));
    $("#todayList").addEventListener("click", event => {
      const button = event.target.closest("button.play");
      const row = event.target.closest("[data-task-id]");
      if (button && row && !button.disabled) startFocus(row.dataset.taskId);
    });
    $("#categoryFilters").addEventListener("click", event => {
      const button = event.target.closest("button[data-category]");
      if (!button) return;
      todayCategory = button.dataset.category;
      $$("#categoryFilters button").forEach(item => item.classList.toggle("active", item === button));
      renderToday(true);
    });

    $("#toggleIsland").addEventListener("change", event => { settings.island = event.target.checked; saveSettings(); renderIsland(); });
    $("#toggleDanger").addEventListener("change", event => { settings.danger = event.target.checked; saveSettings(); });
    $("#demoDanger").addEventListener("click", () => maybeDanger(true));
    $("#resetDemo").addEventListener("click", () => {
      tasks = storage.refreshDemo();
      focusId = null;
      sessionStorage.removeItem("dodo.focusId");
      renderAll(true);
      showToast("演示任务已刷新，你创建的任务已保留");
    });

    $("#enableNotifications").addEventListener("click", enableNotifications);
    $("#testNotification").addEventListener("click", testNotification);
    $("#scheduleNotifications").addEventListener("click", syncNotifications);
    $("#savePushServer").addEventListener("click", savePushServer);

    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        clearTimeout(statusTimer);
        statusTimer = null;
        stopFocusAnimation();
      } else {
        renderAll();
        scheduleStatusTick(true);
        if (currentView === "focus") startFocusAnimation();
      }
    });
  }

  async function boot() {
    if (focusId && !tasks.some(task => task.id === focusId && task.status !== "completed")) {
      focusId = null;
      sessionStorage.removeItem("dodo.focusId");
    }
    bindEvents();
    renderBrand();
    renderAll(true);
    updateVisibleClocks();
    updateNotificationStatus();
    scheduleStatusTick();
    notificationManager.register().catch(error => console.info("Dodo service worker:", error.message));

    const params = new URLSearchParams(location.search);
    const notificationTask = params.get("task");
    if (notificationTask && tasks.some(task => task.id === notificationTask && task.status !== "completed")) startFocus(notificationTask);
  }

  boot().catch(error => {
    console.error(error);
    showToast(`小待启动失败：${error.message}`, 6000);
  });
})();
