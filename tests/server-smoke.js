"use strict";

const { spawn } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const webpush = require("../server/node_modules/web-push");

const root = path.resolve(__dirname, "..");
const temporaryData = path.join(__dirname, ".push-server-smoke-data");
const port = 8788;
const baseUrl = `http://127.0.0.1:${port}`;
const delay = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));

async function waitForServer() {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const response = await fetch(`${baseUrl}/health`);
      if (response.ok) return response.json();
    } catch (_) {}
    await delay(150);
  }
  throw new Error("Push Server did not start");
}

async function post(pathname, body) {
  const response = await fetch(`${baseUrl}${pathname}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Origin": "http://127.0.0.1:4173" },
    body: JSON.stringify(body)
  });
  const result = await response.json();
  if (!response.ok) throw new Error(`${pathname}: ${result.error || response.status}`);
  return result;
}

async function main() {
  if (!temporaryData.startsWith(path.join(root, "tests") + path.sep)) throw new Error("Unsafe test data path");
  fs.rmSync(temporaryData, { recursive: true, force: true });
  const keys = webpush.generateVAPIDKeys();
  const child = spawn(process.execPath, [path.join(root, "server", "server.js")], {
    cwd: path.join(root, "server"),
    env: {
      ...process.env,
      PORT: String(port),
      VAPID_SUBJECT: "mailto:test@example.com",
      VAPID_PUBLIC_KEY: keys.publicKey,
      VAPID_PRIVATE_KEY: keys.privateKey,
      ALLOWED_ORIGINS: "http://127.0.0.1:4173",
      DODO_DATA_DIRECTORY: temporaryData
    },
    stdio: ["ignore", "pipe", "pipe"]
  });
  let stderr = "";
  child.stderr.on("data", chunk => { stderr += chunk; });
  try {
    await waitForServer();
    const subscription = { endpoint: "https://push.example.test/subscription-id", keys: { p256dh: "test-p256dh", auth: "test-auth" } };
    const subscribed = await post("/subscribe", { subscription });
    if (!subscribed.ok || !subscribed.subscriptionId) throw new Error("Subscription endpoint failed");

    const deadline = Date.now() + 4 * 3600000;
    const scheduled = await post("/schedule", {
      subscription,
      taskId: "smoke-task",
      title: "Push Server 冒烟测试",
      deadline: new Date(deadline).toISOString(),
      noticeTime: new Date(deadline - 3 * 3600000).toISOString(),
      urgentTime: new Date(deadline - 2 * 3600000).toISOString(),
      dangerTime: new Date(deadline - 1 * 3600000).toISOString()
    });
    if (!scheduled.ok || scheduled.reminders.length !== 3) throw new Error("Schedule endpoint failed");

    const partial = await post("/schedule", {
      subscription,
      taskId: "future-only",
      title: "未来提醒筛选",
      deadline: new Date(deadline).toISOString(),
      noticeTime: new Date(Date.now() - 60000).toISOString(),
      urgentTime: new Date(deadline - 2 * 3600000).toISOString(),
      dangerTime: new Date(deadline - 1 * 3600000).toISOString()
    });
    if (partial.reminders.length !== 2 || partial.reminders.some(reminder => reminder.kind === "notice")) throw new Error("Past reminder was scheduled");

    const delayedTest = await post("/send-test", { subscription, task: { title: "锁屏测试" }, delaySeconds: 10 });
    if (!delayedTest.ok || Date.parse(delayedTest.scheduledAt) <= Date.now()) throw new Error("Delayed test was not queued");
    const persistedData = JSON.parse(fs.readFileSync(path.join(temporaryData, "schedules.json"), "utf8"));
    if (persistedData.testReminders.length !== 1 || persistedData.testReminders[0].sentAt) throw new Error("Delayed test queue was not persisted");

    const health = await fetch(`${baseUrl}/health`).then(response => response.json());
    if (!health.ok || health.schedules !== 2) throw new Error("Schedule was not persisted");
    const cancelled = await post("/cancel", { subscription, taskId: "smoke-task" });
    if (!cancelled.ok || cancelled.removed !== 1) throw new Error("Cancel endpoint failed");

    const config = await fetch(`${baseUrl}/config`).then(response => response.json());
    if (config.vapidPublicKey !== keys.publicKey) throw new Error("Config endpoint failed");
    console.log(JSON.stringify({ subscribe: true, schedule: true, futureOnly: true, delayedTest: true, persisted: true, cancel: true, config: true }, null, 2));
  } finally {
    child.kill("SIGTERM");
    await Promise.race([new Promise(resolve => child.once("exit", resolve)), delay(2000)]);
    fs.rmSync(temporaryData, { recursive: true, force: true });
  }
  if (stderr) throw new Error(stderr.trim());
}

main().catch(error => { console.error(error); process.exitCode = 1; });
