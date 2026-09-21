(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.DodoUrgency = api;
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";

  const STATES = Object.freeze(["calm", "notice", "urgent", "danger", "done"]);
  const RANKS = Object.freeze({ done: -1, calm: 0, notice: 1, urgent: 2, danger: 3 });

  function priorityMultiplier(priority) {
    if (priority === "mustDo") return 1.25;
    if (priority === "important") return 1.15;
    return 1;
  }

  function durationSeconds(task) {
    return Math.max(Number(task && task.duration) * 60 || 0, 60);
  }

  function thresholds(task) {
    const duration = durationSeconds(task);
    const multiplier = priorityMultiplier(task && task.priority);
    return {
      notice: Math.max(duration * 2.5, 3600) * multiplier,
      urgent: Math.max(duration * 1.75, 1800) * multiplier,
      danger: Math.max(duration * 1.1, 900) * multiplier
    };
  }

  function stateForTask(task, now = Date.now()) {
    if (!task || task.status === "completed") return "done";
    const snooze = Date.parse(task.snoozeUntil || "");
    if (Number.isFinite(snooze) && snooze > now) return "calm";
    const deadline = Date.parse(task.deadline || "");
    if (!Number.isFinite(deadline)) return "calm";
    const secondsLeft = (deadline - now) / 1000;
    const limits = thresholds(task);
    if (secondsLeft <= limits.danger) return "danger";
    if (secondsLeft <= limits.urgent) return "urgent";
    if (secondsLeft <= limits.notice) return "notice";
    return "calm";
  }

  function isOverdue(task, now = Date.now()) {
    const deadline = Date.parse(task && task.deadline || "");
    return Boolean(task && task.status !== "completed" && Number.isFinite(deadline) && deadline <= now);
  }

  function risk(task, now = Date.now()) {
    const deadline = Date.parse(task && task.deadline || "");
    if (!Number.isFinite(deadline)) return Number.POSITIVE_INFINITY;
    return (deadline - now) / Math.max(durationSeconds(task) * 1000, 60000);
  }

  function primaryTask(tasks, now = Date.now()) {
    return (Array.isArray(tasks) ? tasks : [])
      .filter(task => task && task.status !== "completed")
      .slice()
      .sort((a, b) => {
        const aState = stateForTask(a, now);
        const bState = stateForTask(b, now);
        if (RANKS[aState] !== RANKS[bState]) return RANKS[bState] - RANKS[aState];
        const aPriority = priorityMultiplier(a.priority);
        const bPriority = priorityMultiplier(b.priority);
        if (aPriority !== bPriority) return bPriority - aPriority;
        return risk(a, now) - risk(b, now);
      })[0] || null;
  }

  function notificationTimes(task) {
    const deadline = Date.parse(task && task.deadline || "");
    if (!Number.isFinite(deadline)) return null;
    const limits = thresholds(task);
    return {
      noticeTime: new Date(deadline - limits.notice * 1000).toISOString(),
      urgentTime: new Date(deadline - limits.urgent * 1000).toISOString(),
      dangerTime: new Date(deadline - limits.danger * 1000).toISOString()
    };
  }

  return { STATES, RANKS, priorityMultiplier, thresholds, stateForTask, isOverdue, risk, primaryTask, notificationTimes };
});
