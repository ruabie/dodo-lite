"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const urgency = require("../js/urgency-engine.js");
const storage = require("../js/storage.js");

test("urgency state follows deadline thresholds", () => {
  const now = Date.parse("2026-09-20T10:00:00.000Z");
  const task = { status: "active", duration: 30, priority: "normal", deadline: new Date(now + 4 * 3600000).toISOString() };
  assert.equal(urgency.stateForTask(task, now), "calm");
  task.deadline = new Date(now + 60 * 60000).toISOString();
  assert.equal(urgency.stateForTask(task, now), "notice");
  task.deadline = new Date(now + 40 * 60000).toISOString();
  assert.equal(urgency.stateForTask(task, now), "urgent");
  task.deadline = new Date(now + 10 * 60000).toISOString();
  assert.equal(urgency.stateForTask(task, now), "danger");
  task.status = "completed";
  assert.equal(urgency.stateForTask(task, now), "done");
});

test("notification schedule is ordered Notice, Urgent, Danger", () => {
  const task = { status: "active", duration: 45, priority: "important", deadline: "2026-09-21T10:00:00.000Z" };
  const times = urgency.notificationTimes(task);
  assert.ok(Date.parse(times.noticeTime) < Date.parse(times.urgentTime));
  assert.ok(Date.parse(times.urgentTime) < Date.parse(times.dangerTime));
  assert.ok(Date.parse(times.dangerTime) < Date.parse(task.deadline));
});

test("legacy demo data is reseeded instead of becoming hours overdue", () => {
  const oldNow = Date.parse("2026-01-01T00:00:00.000Z");
  const newNow = Date.parse("2026-09-20T10:00:00.000Z");
  const legacy = storage.seedTasks(oldNow).map(task => {
    const copy = { ...task };
    delete copy.source;
    return copy;
  });
  const migrated = storage.migrateLegacy(legacy, {}, newNow);
  assert.equal(migrated.version, 6);
  assert.ok(migrated.tasks.every(task => task.source === "demo"));
  assert.ok(Math.min(...migrated.tasks.map(task => Date.parse(task.deadline))) >= newNow);
});

test("real user tasks survive migration", () => {
  const now = Date.parse("2026-09-20T10:00:00.000Z");
  const userTask = storage.makeTask("我的真实任务", 90, 25, "工作", "important", "user", now);
  delete userTask.source;
  const migrated = storage.migrateLegacy([userTask], {}, now);
  const restored = migrated.tasks.find(task => task.title === "我的真实任务");
  assert.ok(restored);
  assert.equal(restored.source, "user");
});

test("mixed legacy demo and user tasks refresh only the demo", () => {
  const oldNow = Date.parse("2026-01-01T00:00:00.000Z");
  const newNow = Date.parse("2026-09-20T10:00:00.000Z");
  const legacyDemo = storage.seedTasks(oldNow);
  const userTask = storage.makeTask("我自己的项目", 90, 50, "工作", "important", "user", oldNow);
  legacyDemo.forEach(task => { delete task.source; });
  delete userTask.source;
  const migrated = storage.migrateLegacy([...legacyDemo, userTask], {}, newNow);
  assert.equal(migrated.tasks.length, 6);
  assert.equal(migrated.tasks.find(task => task.title === "我自己的项目").deadline, userTask.deadline);
  assert.ok(migrated.tasks.filter(task => task.source === "demo").every(task => Date.parse(task.deadline) >= newNow));
});

test("a user task sharing a demo title is preserved", () => {
  const oldNow = Date.parse("2026-01-01T00:00:00.000Z");
  const newNow = Date.parse("2026-09-20T10:00:00.000Z");
  const legacyDemo = storage.seedTasks(oldNow);
  const sameTitleUserTask = storage.makeTask("英语演讲预习", 90, 45, "学习", "important", "user", oldNow + 24 * 3600000);
  legacyDemo.forEach(task => { delete task.source; });
  delete sameTitleUserTask.source;
  const migrated = storage.migrateLegacy([...legacyDemo, sameTitleUserTask], {}, newNow);
  assert.equal(migrated.tasks.length, 6);
  assert.ok(migrated.tasks.some(task => task.id === sameTitleUserTask.id && task.source === "user"));
});
