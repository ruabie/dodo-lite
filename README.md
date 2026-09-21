# 小待 Dodo V5.4 手机体验版

这是基于 Dodo V5.3 继续升级的 PWA 手机体验版。Now、Today、Focus、Settings、Danger、Done、灵动岛视觉模拟、本地任务和通知入口均保留；角色继续使用原项目的五张 1024×1024 3D 母版素材。

本仓库的 GitHub Pages 前端地址是 <https://ruabie.github.io/dodo-lite/>。Pages 只托管静态前端；`server/` 必须另行部署，不能在 GitHub Pages 上运行。

## 本地运行

Service Worker 和通知不能通过 `file://` 测试，请在项目根目录启动本地 HTTP 服务：

```bash
python3 -m http.server 8080
```

然后打开 `http://localhost:8080`。也可以把整个目录部署到 GitHub Pages；正式部署必须使用 HTTPS。

运行自动测试：

```bash
npm test
npm run check
# 可选的浏览器与 Push Server 集成测试
npm run test:browser
npm run test:server
```

## CharacterAnimationEngine

角色系统位于 `js/character-engine.js`，页面不直接操作角色内部 DOM。创建角色：

```js
const character = DodoCharacter({
  mount: document.querySelector("#slot"),
  state: "calm",
  emotion: "neutral",
  interactive: true,
  size: 220
});

character.setState("notice");
character.setEmotion("happy");
character.play("blink");
character.play("notification");
character.lookAt(x, y);
character.resetToIdle();
```

三层职责严格分开：

- `STATE`：`calm / notice / urgent / danger / done`，由 Urgency Engine 或设置里的明确状态测试按钮传入。
- `EMOTION`：当前 STATE 内的短暂表情，例如 `happy / curious / surprised / determined`。
- `ACTION`：点击、眨眼、观察、提醒、庆祝等短时动作。

`play()` 和点击反应不会调用 `setState()`。动作结束后只会回到当前 STATE 的 idle。Idle 使用带权随机调度、随机停顿和特殊动作防连播；页面隐藏时会暂停。

## 点击与五个 STATE 的验收

1. 打开“设置”→“CharacterAnimationEngine V5.4”。
2. 点 Calm，再连续点击小待至少 10 次；下方 STATE 必须一直是 `calm`。
3. 点 Notice 后重复操作；STATE 必须一直是 `notice`，不能出现 Danger 素材。
4. 依次点 Calm、Notice、Urgent、Danger、Done，按钮、STATE 字段和母版素材必须一一对应。
5. 停留观察 30 秒：角色应在静止、微动作、停顿和偶发动作间切换，不应出现固定三秒循环。

自动测试也覆盖 Calm/Notice 连续点击、五状态稳定、Idle 特殊动作防连播、数据迁移和 PWA 文件完整性。

## 在 iPhone 添加到主屏幕

1. 把前端部署到 HTTPS 地址，用 iPhone Safari 打开。
2. 点击 Safari 的“分享”。
3. 选择“添加到主屏幕”；在较新的系统界面中保持“作为 Web App 打开”。
4. 回到主屏幕，点击“小待”图标启动，不要继续使用原 Safari 标签页测试通知。

## 开启并测试锁屏通知

iPhone/iPad 的 Home Screen Web Push 需要 iOS/iPadOS 16.4 或更高版本。权限必须由用户点击按钮后请求；通知可以出现在锁屏、通知中心和配对的 Apple Watch 上。

1. 从主屏幕启动小待。
2. 打开“设置”→“真实系统通知”。
3. 点击“开启通知权限”，在系统弹窗中允许。
4. 如果已配置 Push Server，点击“发送测试锁屏通知”后立即锁屏；服务器约 10～15 秒后推送。未配置服务器时，按钮只会即时发送当前设备的本地测试通知，可在通知中心查看，但不能保证锁屏后才到达。

“锁屏提醒预览”只是 UI 预览，和上面的真实系统通知严格分开。

## Deadline Web Push Server

GitHub Pages 只能托管前端。网页关闭后，前端的 `setTimeout()` 无法可靠定时运行，所以 Notice、Urgent、Danger 自动提醒必须由 `server/` 中的独立 Node.js 服务发送。

服务端已提供：

- `POST /subscribe`
- `POST /schedule`
- `POST /send-test`
- `POST /cancel`
- `GET /config`
- `GET /health`

部署步骤：

```bash
cd server
npm install
npm run generate-vapid
```

复制 `.env.example` 为 `.env`，填入生成的 `VAPID_PUBLIC_KEY`、`VAPID_PRIVATE_KEY`，把 `VAPID_SUBJECT` 改为联系邮箱，把 `ALLOWED_ORIGINS` 改为前端真实来源。然后运行：

```bash
npm start
```

这个参考服务器默认把订阅与日程持久化到 `server/data/schedules.json`（可用 `DODO_DATA_DIRECTORY` 指向挂载目录），并每 5 秒检查到期提醒。首次同步只排程未来的提醒；停机恢复后同一任务只发尚未截止的最新阶段，不会一次补发多条旧提醒。生产部署需要：

- 一个常驻 Node.js 进程，而不是只在请求时运行的短生命周期函数；
- 持久磁盘，或将 JSON 存储替换为数据库；
- 公网 HTTPS 域名；
- 允许服务器访问 Apple Web Push 端点；
- 将前端“Web Push Server 设置”填写为该 HTTPS 地址，再点击“同步当前任务提醒”。

当前服务端是单人体验版参考实现。若公开给多人使用，仍需在上线前增加用户身份验证、请求限流、订阅数据保护和数据库运维；仅设置 `ALLOWED_ORIGINS` 不能替代身份验证。

不要把 `.env` 或 VAPID 私钥提交到 GitHub Pages。

## 数据升级

`DATA_VERSION = 6`。V5.3 的整组演示任务会按当前时间重新生成，避免升级后显示“超时 11 小时”；无法可靠确认来源的记录会保留，避免误删与演示任务同名的真实任务。设置里的“刷新演示任务”只替换 `source: "demo"` 的任务，不删除用户任务。

## PWA 阶段明确做不到的能力

- 真正的锁屏 Live Activity；
- 真正的 Dynamic Island Compact / Expanded / Minimal；
- FamilyControls、ManagedSettings 与系统 Shield；
- DeviceActivity 在 App 被强杀后的原生调度；
- 原生 UserNotifications 的完整通知策略。

这些能力必须留到 SwiftUI + ActivityKit + WidgetKit + UserNotifications + FamilyControls 的原生 iOS 阶段。本版本的灵动岛是明确标注的视觉模拟，不伪装成系统能力。
