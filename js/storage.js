(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.DodoStorage = api;
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";

  const DATA_VERSION = 6;
  const DATA_KEY = "dodo.data.v6";
  const LEGACY_TASK_KEY = "dodo.v53.tasks";
  const LEGACY_SETTINGS_KEY = "dodo.v53.settings";
  const DEMO_SIGNATURES = Object.freeze([
    ["英语演讲预习", 45, "学习"],
    ["整理房间", 35, "生活"],
    ["项目方案修改", 60, "工作"],
    ["阅读 30 分钟", 30, "生活"],
    ["买生日礼物", 20, "生活"]
  ]);
  const DEMO_OFFSETS = Object.freeze({ "英语演讲预习": 135, "整理房间": 260, "项目方案修改": 1440, "阅读 30 分钟": 390, "买生日礼物": 520 });

  function uid() {
    if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  }

  function makeTask(title, minutesFromNow, duration, category, priority = "normal", source = "demo", now = Date.now()) {
    return {
      id: uid(),
      title,
      deadline: new Date(now + minutesFromNow * 60000).toISOString(),
      duration,
      category,
      priority,
      status: "active",
      source,
      startedAt: null,
      focusStartedAt: null,
      elapsedFocusMs: 0,
      isPaused: false,
      snoozeUntil: null,
      completedAt: null
    };
  }

  function seedTasks(now = Date.now()) {
    const demo = [
      makeTask("英语演讲预习", 135, 45, "学习", "important", "demo", now),
      makeTask("整理房间", 260, 35, "生活", "normal", "demo", now),
      makeTask("项目方案修改", 1440, 60, "工作", "important", "demo", now),
      makeTask("阅读 30 分钟", 390, 30, "生活", "normal", "demo", now),
      makeTask("买生日礼物", 520, 20, "生活", "normal", "demo", now)
    ];
    demo[4].status = "completed";
    demo[4].completedAt = new Date(now).toISOString();
    return demo;
  }

  function isDemoSignature(task) {
    return DEMO_SIGNATURES.some(([title, duration, category]) =>
      task && task.title === title && Number(task.duration) === duration && task.category === category
    );
  }

  function sanitizeTask(task, sourceHint) {
    if (!task || typeof task !== "object" || !String(task.title || "").trim()) return null;
    const deadline = Date.parse(task.deadline || "");
    if (!Number.isFinite(deadline)) return null;
    const status = task.status === "completed" ? "completed" : "active";
    return {
      id: String(task.id || uid()),
      title: String(task.title).trim().slice(0, 80),
      deadline: new Date(deadline).toISOString(),
      duration: Math.min(720, Math.max(5, Number(task.duration) || 30)),
      category: ["学习", "工作", "生活"].includes(task.category) ? task.category : "生活",
      priority: ["normal", "important", "mustDo"].includes(task.priority) ? task.priority : "normal",
      status,
      source: task.source === "demo" || sourceHint === "demo" ? "demo" : "user",
      startedAt: task.startedAt || null,
      focusStartedAt: task.focusStartedAt || task.startedAt || null,
      elapsedFocusMs: Math.max(0, Number(task.elapsedFocusMs) || 0),
      isPaused: Boolean(task.isPaused),
      snoozeUntil: task.snoozeUntil || null,
      completedAt: task.completedAt || null
    };
  }

  function defaultSettings(settings) {
    return Object.assign({ island: true, danger: true, pushServerUrl: "" }, settings && typeof settings === "object" ? settings : {});
  }

  function migrateLegacy(legacyTasks, legacySettings, now = Date.now()) {
    const source = Array.isArray(legacyTasks) ? legacyTasks : [];
    // V5.3 did not label demo tasks. Recognize the batch by its shared seed time,
    // not by title alone: a real task may have the same title and duration.
    const candidates = source.map((task, index) => ({ task, index }))
      .filter(({ task }) => task && task.source !== "user" && isDemoSignature(task) && Number.isFinite(Date.parse(task.deadline)))
      .map(({ task, index }) => ({ index, title: task.title, seedTime: Date.parse(task.deadline) - DEMO_OFFSETS[task.title] * 60000 }));
    const demoIndices = new Set(source.map((task, index) => task && task.source === "demo" ? index : -1).filter(index => index >= 0));
    for (const anchor of candidates) {
      const matching = candidates.filter(candidate => Math.abs(candidate.seedTime - anchor.seedTime) <= 10000);
      if (new Set(matching.map(candidate => candidate.title)).size >= 3) matching.forEach(candidate => demoIndices.add(candidate.index));
    }
    const userTasks = source
      .filter((task, index) => !demoIndices.has(index))
      .map(task => sanitizeTask(task, "user"))
      .filter(Boolean);
    const tasks = userTasks.concat(seedTasks(now));
    return { version: DATA_VERSION, tasks, settings: defaultSettings(legacySettings), migratedAt: new Date(now).toISOString() };
  }

  class StorageManager {
    constructor(storage) {
      this.storage = storage;
      this.data = null;
    }

    _parse(key, fallback) {
      try { return JSON.parse(this.storage.getItem(key) || "") || fallback; }
      catch (_) { return fallback; }
    }

    load(now = Date.now()) {
      const current = this._parse(DATA_KEY, null);
      if (current && current.version === DATA_VERSION && Array.isArray(current.tasks)) {
        this.data = {
          version: DATA_VERSION,
          tasks: current.tasks.map(task => sanitizeTask(task, task.source)).filter(Boolean),
          settings: defaultSettings(current.settings),
          migratedAt: current.migratedAt || new Date(now).toISOString()
        };
      } else if (current && Array.isArray(current.tasks)) {
        // Never discard task records merely because a future/unknown version was seen.
        const preserved = current.tasks.map(task => sanitizeTask(task, task.source)).filter(Boolean);
        this.data = {
          version: DATA_VERSION,
          tasks: preserved,
          settings: defaultSettings(current.settings),
          migratedAt: current.migratedAt || new Date(now).toISOString()
        };
      } else {
        this.data = migrateLegacy(this._parse(LEGACY_TASK_KEY, []), this._parse(LEGACY_SETTINGS_KEY, {}), now);
      }
      this.save();
      return this.data;
    }

    save() {
      if (!this.data) return;
      this.storage.setItem(DATA_KEY, JSON.stringify(this.data));
    }

    setTasks(tasks) {
      this.data.tasks = (Array.isArray(tasks) ? tasks : []).map(task => sanitizeTask(task, task.source)).filter(Boolean);
      this.save();
      return this.data.tasks;
    }

    setSettings(settings) {
      this.data.settings = defaultSettings(settings);
      this.save();
      return this.data.settings;
    }

    refreshDemo(now = Date.now()) {
      const userTasks = this.data.tasks.filter(task => task.source !== "demo");
      this.data.tasks = userTasks.concat(seedTasks(now));
      this.save();
      return this.data.tasks;
    }
  }

  return { DATA_VERSION, DATA_KEY, LEGACY_TASK_KEY, LEGACY_SETTINGS_KEY, DEMO_SIGNATURES, uid, makeTask, seedTasks, isDemoSignature, sanitizeTask, migrateLegacy, StorageManager };
});
