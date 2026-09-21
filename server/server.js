"use strict";

require("dotenv").config();
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const express = require("express");
const cors = require("cors");
const webpush = require("web-push");
const { dueReminderPlan } = require("./reminder-policy");

const required = ["VAPID_SUBJECT", "VAPID_PUBLIC_KEY", "VAPID_PRIVATE_KEY"];
const missing = required.filter(name => !process.env[name]);
if (missing.length) {
  console.error(`Missing environment variables: ${missing.join(", ")}`);
  process.exit(1);
}

const PORT = Number(process.env.PORT) || 8787;
const allowedOrigins = String(process.env.ALLOWED_ORIGINS || "").split(",").map(value => value.trim()).filter(Boolean);
const dataDirectory = process.env.DODO_DATA_DIRECTORY ? path.resolve(process.env.DODO_DATA_DIRECTORY) : path.join(__dirname, "data");
const dataFile = path.join(dataDirectory, "schedules.json");
const temporaryDataFile = path.join(dataDirectory, "schedules.tmp.json");

webpush.setVapidDetails(process.env.VAPID_SUBJECT, process.env.VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY);

function blankDatabase() {
  return { version: 1, subscriptions: {}, schedules: [], testReminders: [] };
}

function loadDatabase() {
  try {
    const parsed = JSON.parse(fs.readFileSync(dataFile, "utf8"));
    if (parsed && parsed.version === 1 && parsed.subscriptions && Array.isArray(parsed.schedules)) {
      if (!Array.isArray(parsed.testReminders)) parsed.testReminders = [];
      return parsed;
    }
  } catch (_) {}
  return blankDatabase();
}

let database = loadDatabase();

function persist() {
  fs.mkdirSync(dataDirectory, { recursive: true });
  fs.writeFileSync(temporaryDataFile, JSON.stringify(database, null, 2));
  fs.renameSync(temporaryDataFile, dataFile);
}

function subscriptionId(subscription) {
  return crypto.createHash("sha256").update(subscription.endpoint).digest("hex").slice(0, 24);
}

function validSubscription(subscription) {
  return Boolean(subscription && typeof subscription.endpoint === "string" && subscription.endpoint.startsWith("https://") && subscription.keys && subscription.keys.p256dh && subscription.keys.auth);
}

function saveSubscription(subscription) {
  if (!validSubscription(subscription)) throw new Error("Invalid PushSubscription");
  const id = subscriptionId(subscription);
  database.subscriptions[id] = subscription;
  return id;
}

function parseTime(value, label) {
  const timestamp = Date.parse(value || "");
  if (!Number.isFinite(timestamp)) throw new Error(`${label} is invalid`);
  return new Date(timestamp).toISOString();
}

function reminderCopy(kind) {
  if (kind === "danger") return "时间已经很紧了，先做这件事。";
  if (kind === "urgent") return "现在开始，时间会比较稳。";
  return "差不多可以开始啦。";
}

function remainingCopy(deadline) {
  const milliseconds = Date.parse(deadline) - Date.now();
  if (milliseconds <= 0) return "任务已到截止时间。";
  const minutes = Math.max(1, Math.round(milliseconds / 60000));
  if (minutes >= 60) return `距离截止还有 ${Math.floor(minutes / 60)} 小时 ${minutes % 60} 分钟。`;
  return `距离截止还有 ${minutes} 分钟。`;
}

function payloadFor(schedule, reminder) {
  return JSON.stringify({
    title: "小待 Dodo",
    body: `💡 ${schedule.title}\n${reminderCopy(reminder.kind)} ${remainingCopy(schedule.deadline)}`,
    icon: "./dodo-v53-icon-192.png",
    badge: "./dodo-v53-icon-192.png",
    silent: true,
    tag: `dodo-${schedule.taskId}-${reminder.kind}`,
    data: { url: "./", taskId: schedule.taskId, kind: reminder.kind }
  });
}

async function send(subscription, payload) {
  return webpush.sendNotification(subscription, payload, { TTL: 3600, urgency: "normal" });
}

function removeSubscription(id) {
  delete database.subscriptions[id];
  database.schedules = database.schedules.filter(schedule => schedule.subscriptionId !== id);
  database.testReminders = database.testReminders.filter(reminder => reminder.subscriptionId !== id);
}

let processing = false;
async function processDueReminders() {
  if (processing) return;
  processing = true;
  let changed = false;
  try {
    const now = Date.now();
    for (const schedule of database.schedules) {
      const subscription = database.subscriptions[schedule.subscriptionId];
      if (!subscription) continue;
      const plan = dueReminderPlan(schedule, now);
      for (const skipped of plan.skipped) {
        skipped.skippedAt = new Date(now).toISOString();
        changed = true;
      }
      const reminder = plan.latest;
      if (!reminder || Number(reminder.nextAttemptAt || 0) > now) continue;
      try {
        await send(subscription, payloadFor(schedule, reminder));
        reminder.sentAt = new Date().toISOString();
        reminder.lastError = null;
        changed = true;
      } catch (error) {
        if (error.statusCode === 404 || error.statusCode === 410) {
          removeSubscription(schedule.subscriptionId);
        } else {
          reminder.attempts = Number(reminder.attempts || 0) + 1;
          reminder.nextAttemptAt = now + Math.min(3600000, 30000 * (2 ** Math.min(reminder.attempts, 6)));
          reminder.lastError = String(error.message || error).slice(0, 300);
        }
        changed = true;
      }
    }
    for (const reminder of database.testReminders) {
      if (reminder.sentAt || Date.parse(reminder.at) > now || Date.parse(reminder.at) <= now - 10 * 60000 || Number(reminder.nextAttemptAt || 0) > now) continue;
      const subscription = database.subscriptions[reminder.subscriptionId];
      if (!subscription) continue;
      try {
        await send(subscription, reminder.payload);
        reminder.sentAt = new Date().toISOString();
      } catch (error) {
        if (error.statusCode === 404 || error.statusCode === 410) {
          removeSubscription(reminder.subscriptionId);
        } else {
          reminder.attempts = Number(reminder.attempts || 0) + 1;
          reminder.nextAttemptAt = now + Math.min(3600000, 30000 * (2 ** Math.min(reminder.attempts, 6)));
          reminder.lastError = String(error.message || error).slice(0, 300);
        }
      }
      changed = true;
    }
    const beforePrune = database.schedules.length + database.testReminders.length;
    database.schedules = database.schedules.filter(schedule => Date.parse(schedule.deadline) > now);
    database.testReminders = database.testReminders.filter(reminder => !reminder.sentAt && Date.parse(reminder.at) > now - 10 * 60000);
    if (database.schedules.length + database.testReminders.length !== beforePrune) changed = true;
    if (changed) persist();
  } finally {
    processing = false;
  }
}

const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "128kb" }));
app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes("*") || allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error("Origin is not allowed"));
  }
}));

app.get("/health", (_request, response) => response.json({ ok: true, schedules: database.schedules.length }));
app.get("/config", (_request, response) => response.json({ vapidPublicKey: process.env.VAPID_PUBLIC_KEY }));

app.post("/subscribe", (request, response) => {
  try {
    const id = saveSubscription(request.body.subscription);
    persist();
    response.status(201).json({ ok: true, subscriptionId: id });
  } catch (error) {
    response.status(400).json({ error: error.message });
  }
});

app.post("/schedule", (request, response) => {
  try {
    const { subscription, taskId, title, deadline, noticeTime, urgentTime, dangerTime } = request.body;
    if (!taskId || !String(title || "").trim()) throw new Error("taskId and title are required");
    const id = saveSubscription(subscription);
    const normalizedDeadline = parseTime(deadline, "deadline");
    if (Date.parse(normalizedDeadline) <= Date.now()) throw new Error("deadline must be in the future");
    const requested = [
      { kind: "notice", at: parseTime(noticeTime, "noticeTime") },
      { kind: "urgent", at: parseTime(urgentTime, "urgentTime") },
      { kind: "danger", at: parseTime(dangerTime, "dangerTime") }
    ];
    const existing = database.schedules.find(schedule => schedule.subscriptionId === id && schedule.taskId === String(taskId));
    const reminders = requested.filter(reminder => Date.parse(reminder.at) > Date.now() && Date.parse(reminder.at) < Date.parse(normalizedDeadline)).map(reminder => {
      const previous = existing && existing.reminders.find(item => item.kind === reminder.kind && item.at === reminder.at);
      return previous || { ...reminder, sentAt: null, attempts: 0, nextAttemptAt: 0, lastError: null };
    });
    const schedule = { subscriptionId: id, taskId: String(taskId), title: String(title).trim().slice(0, 80), deadline: normalizedDeadline, reminders, updatedAt: new Date().toISOString() };
    database.schedules = database.schedules.filter(item => !(item.subscriptionId === id && item.taskId === schedule.taskId));
    database.schedules.push(schedule);
    persist();
    response.status(201).json({ ok: true, taskId: schedule.taskId, reminders: schedule.reminders.map(({ kind, at }) => ({ kind, at })) });
    processDueReminders().catch(error => console.error("scheduler", error));
  } catch (error) {
    response.status(400).json({ error: error.message });
  }
});

app.post("/cancel", (request, response) => {
  try {
    const { subscription, taskId } = request.body;
    if (!validSubscription(subscription) || !taskId) throw new Error("subscription and taskId are required");
    const id = subscriptionId(subscription);
    const before = database.schedules.length;
    database.schedules = database.schedules.filter(schedule => !(schedule.subscriptionId === id && schedule.taskId === String(taskId)));
    persist();
    response.json({ ok: true, removed: before - database.schedules.length });
  } catch (error) {
    response.status(400).json({ error: error.message });
  }
});

app.post("/send-test", async (request, response) => {
  try {
    const subscription = request.body.subscription;
    if (!validSubscription(subscription)) throw new Error("Invalid PushSubscription");
    const task = request.body.task || {};
    const payload = JSON.stringify({
      title: "小待 Dodo",
      body: `💡 ${String(task.title || "英语演讲预习").slice(0, 80)}\n差不多可以开始啦。测试通知发送成功。`,
      icon: "./dodo-v53-icon-192.png",
      badge: "./dodo-v53-icon-192.png",
      silent: true,
      tag: "dodo-v54-server-test",
      data: { url: "./", taskId: task.id || null, kind: "test" }
    });
    const delaySeconds = Math.max(0, Math.min(120, Number(request.body.delaySeconds) || 0));
    if (delaySeconds >= 5) {
      const id = saveSubscription(subscription);
      if (database.testReminders.filter(reminder => reminder.subscriptionId === id).length >= 3) throw new Error("Too many pending test notifications");
      const at = new Date(Date.now() + delaySeconds * 1000).toISOString();
      database.testReminders.push({ id: crypto.randomUUID(), subscriptionId: id, payload, at, attempts: 0, nextAttemptAt: 0 });
      persist();
      response.status(202).json({ ok: true, scheduledAt: at });
      return;
    }
    await send(subscription, payload);
    response.json({ ok: true, sent: true });
  } catch (error) {
    response.status(error.statusCode || 400).json({ error: error.message });
  }
});

app.use((error, _request, response, _next) => response.status(403).json({ error: error.message }));

const server = app.listen(PORT, () => console.log(`Dodo Push Server listening on :${PORT}`));
const scheduler = setInterval(() => processDueReminders().catch(error => console.error("scheduler", error)), 5000);
scheduler.unref();
processDueReminders().catch(error => console.error("scheduler", error));

function shutdown() {
  clearInterval(scheduler);
  server.close(() => process.exit(0));
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
