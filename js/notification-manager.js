(function (root, factory) {
  const api = factory(root);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.DodoNotifications = api;
})(typeof window !== "undefined" ? window : globalThis, function (root) {
  "use strict";

  function normalizeServerUrl(value) {
    return String(value || "").trim().replace(/\/+$/, "");
  }

  function urlBase64ToUint8Array(value) {
    const padding = "=".repeat((4 - value.length % 4) % 4);
    const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
    const raw = atob(base64);
    return Uint8Array.from([...raw].map(character => character.charCodeAt(0)));
  }

  class NotificationManager {
    constructor({ serverUrl = "", serviceWorkerUrl = "./sw.js" } = {}) {
      this.serverUrl = normalizeServerUrl(serverUrl);
      this.serviceWorkerUrl = serviceWorkerUrl;
      this.registration = null;
      this.subscription = null;
    }

    setServerUrl(value) {
      this.serverUrl = normalizeServerUrl(value);
      this.subscription = null;
    }

    isStandalone() {
      return Boolean(root.matchMedia && root.matchMedia("(display-mode: standalone)").matches) || Boolean(root.navigator && root.navigator.standalone);
    }

    isIOS() {
      return /iPad|iPhone|iPod/.test(root.navigator && root.navigator.userAgent || "") || (root.navigator && root.navigator.platform === "MacIntel" && root.navigator.maxTouchPoints > 1);
    }

    capability() {
      if (!("serviceWorker" in navigator)) return { ok: false, label: "不支持 Service Worker", code: "no-service-worker" };
      if (!("Notification" in root)) return { ok: false, label: "当前浏览器不支持", code: "no-notification" };
      if (this.isIOS() && !this.isStandalone()) return { ok: false, label: "请先添加到主屏幕", code: "install-required" };
      if (Notification.permission === "granted") return { ok: true, label: "通知已开启", code: "granted" };
      if (Notification.permission === "denied") return { ok: false, label: "通知已拒绝", code: "denied" };
      return { ok: true, label: "等待授权", code: "default" };
    }

    async register() {
      if (!("serviceWorker" in navigator)) throw new Error("当前浏览器不支持 Service Worker");
      if (!root.isSecureContext && location.hostname !== "localhost") throw new Error("系统通知需要 HTTPS");
      this.registration = await navigator.serviceWorker.register(this.serviceWorkerUrl, { scope: "./" });
      await navigator.serviceWorker.ready;
      return this.registration;
    }

    async requestPermission() {
      const capability = this.capability();
      if (capability.code === "install-required") throw new Error("iPhone 请先用 Safari 添加到主屏幕，再从主屏幕启动小待");
      if (!("Notification" in root)) throw new Error("当前浏览器不支持系统通知");
      const permission = await Notification.requestPermission();
      if (permission !== "granted") throw new Error(permission === "denied" ? "通知权限已被拒绝，请到系统设置中开启" : "通知权限尚未开启");
      await this.register();
      if (this.serverUrl) await this.subscribeForPush();
      return permission;
    }

    async _request(path, body) {
      if (!this.serverUrl) throw new Error("尚未配置 Web Push Server");
      const response = await fetch(`${this.serverUrl}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || `Push Server 请求失败 (${response.status})`);
      return result;
    }

    async subscribeForPush() {
      if (!this.serverUrl) return null;
      const registration = this.registration || await this.register();
      if (!("pushManager" in registration)) throw new Error("当前浏览器不支持 Web Push");
      const configResponse = await fetch(`${this.serverUrl}/config`);
      if (!configResponse.ok) throw new Error("无法读取 Push Server 配置");
      const config = await configResponse.json();
      if (!config.vapidPublicKey) throw new Error("Push Server 缺少 VAPID_PUBLIC_KEY");
      this.subscription = await registration.pushManager.getSubscription() || await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(config.vapidPublicKey)
      });
      await this._request("/subscribe", { subscription: this.subscription.toJSON() });
      return this.subscription;
    }

    async getSubscription() {
      if (this.subscription) return this.subscription;
      const registration = this.registration || await this.register();
      this.subscription = await registration.pushManager.getSubscription();
      if (!this.subscription && this.serverUrl) this.subscription = await this.subscribeForPush();
      return this.subscription;
    }

    notificationContent(task, state = "notice") {
      const title = task && task.title || "英语演讲预习";
      const copy = {
        notice: "差不多可以开始啦。",
        urgent: "现在开始，时间会比较稳。",
        danger: "时间已经很紧了，先做这件事。"
      }[state] || "差不多可以开始啦。";
      const remaining = task && task.deadline ? formatRemaining(Date.parse(task.deadline) - Date.now()) : "距离截止还有 45 分钟。";
      return { title: "小待 Dodo", body: `💡 ${title}\n${copy}${remaining ? ` ${remaining}` : ""}` };
    }

    async showLocalTest(task) {
      if (!("Notification" in root) || Notification.permission !== "granted") throw new Error("请先开启通知权限");
      const registration = this.registration || await this.register();
      const content = this.notificationContent(task, "notice");
      await registration.showNotification(content.title, {
        body: content.body,
        icon: "./dodo-v53-icon-192.png",
        badge: "./dodo-v53-icon-192.png",
        silent: true,
        tag: "dodo-v54-test",
        renotify: false,
        data: { url: "./?from=notification", taskId: task && task.id || null, kind: "test" }
      });
    }

    async sendTest(task) {
      if (!this.serverUrl) return this.showLocalTest(task);
      const subscription = await this.getSubscription();
      if (!subscription) throw new Error("没有可用的 Web Push subscription");
      return this._request("/send-test", { subscription: subscription.toJSON(), task: task || null, delaySeconds: 10 });
    }

    async syncTasks(tasks) {
      if (!this.serverUrl) throw new Error("请先部署并填写 Web Push Server 地址");
      if (!("Notification" in root) || Notification.permission !== "granted") throw new Error("请先开启通知权限");
      const subscription = await this.getSubscription();
      if (!subscription) throw new Error("没有可用的 Web Push subscription");
      const active = (Array.isArray(tasks) ? tasks : []).filter(task => task.status !== "completed" && Date.parse(task.deadline) > Date.now());
      const results = [];
      for (const task of active) {
        const times = root.DodoUrgency.notificationTimes(task);
        if (!times) continue;
        results.push(await this._request("/schedule", {
          subscription: subscription.toJSON(),
          taskId: task.id,
          title: task.title,
          deadline: task.deadline,
          ...times
        }));
      }
      return results;
    }

    async cancelTask(taskId) {
      if (!this.serverUrl || !taskId) return null;
      const subscription = await this.getSubscription();
      if (!subscription) return null;
      return this._request("/cancel", { subscription: subscription.toJSON(), taskId });
    }
  }

  function formatRemaining(milliseconds) {
    if (!Number.isFinite(milliseconds)) return "";
    if (milliseconds <= 0) return "任务已到截止时间。";
    const minutes = Math.max(1, Math.round(milliseconds / 60000));
    if (minutes >= 60) return `距离截止还有 ${Math.floor(minutes / 60)} 小时 ${minutes % 60} 分钟。`;
    return `距离截止还有 ${minutes} 分钟。`;
  }

  return { NotificationManager, normalizeServerUrl, urlBase64ToUint8Array, formatRemaining };
});
