# 小待 SVG 角色系统 · 分阶段实施记录

基准为 `main@5a0b2a6`（V5.4 PWA）。原五张 PNG 与旧 `js/character-engine.js` 保留作历史参考，不参与新版运行时；开发在 `feat/xiaodai-svg-rig` 独立工作区完成，不覆盖原工作区里的试验文件。此文档记录本轮 A→G 实际结果、复现方法和剩余限制。

| 阶段 | 修改文件 | 已完成 | 预览 / 验证 | 尚存问题与后续 |
| --- | --- | --- | --- | --- |
| A 审查基准 | `docs/character-audit.md` | 对五张 PNG、整图动画、眼神叠层、Idle、状态点击和业务接入逐项审查；确认当前 V5.4 基准与备份。 | `npm test` 基准 16/16；`npm run check`。 | 静态造型必须先解决，不能沿用原 PNG 做骨架。 |
| B 静态设定 | `js/xiaodai-art.js`、`character-lab/design-board.html`、`board.js`、`board.css`、`docs/character-spec.md` | 原创白色团子、双手双脚、头顶便签；六视角、八基础情绪、八关键姿势；比例、锚点、遮挡、背面无尾巴规则。看过浏览器截图后加大脚的可见度，修侧面脸与手的重叠。 | 打开 `/character-lab/design-board.html`；截图 `qa/character-board-mobile-390x844@3x.png`。 | 侧面 / 背面当前只作静态设定，未写完整转身时间轴；未来转身只能在这些正式视角间设计过渡。 |
| C 分层 Rig | `js/xiaodai-rig.js`、`css/xiaodai.css` | 身体、双手、双脚、双眼、瞳孔、眼皮、嘴、便签、地影分层；瞳孔受 clipPath 约束；脸跟随身体局部位移但不压扁；手从肩点旋转；动态锚点调试。 | 实验室打开“锚点调试”；单元测试校验部件完整。 | 大幅身体变形尚未设计额外中间轮廓，因此动作限定在轻微弹性范围。 |
| D 核心动作链 | `js/xiaodai-motion.js`、`js/xiaodai-character.js` | `notice → tapReact → returnToIdle`：先转瞳孔与注意，再压身预备、抬手和轻跳、便签滞后回弹，最后从当前通道值恢复。连续点击节流，不叠加时间轴。 | 实验室点击角色；浏览器测试 18 次快速点击记录动作链和局部变形。 | 多次快速触碰会被合并为一次回应，这是有意的节制，后续可设计第二种“被频繁打扰”的正式演出。 |
| E Idle 与情绪 | `js/xiaodai-idle.js`、`js/xiaodai-art.js`、`js/xiaodai-motion.js` | 随机眨眼 2.5–6 秒、偶发双眨、微呼吸、凝视/看便签/侧看/换重心/伸展/哈欠/鼓励；加权随机与冷却。八基础情绪各有眼形、眉/眼皮、瞳孔、嘴与轻微身体姿态；额外 `yawning` 是哈欠动作专用过渡表情。九个临时动作具备独立时间轴。 | 实验室观察；浏览器测试真实等待 60 秒并记录非固定间隔。 | 当前面部不同嘴型使用短暂淡出淡入，不是路径点逐点形变；后续可补更细腻的嘴型插值。 |
| F 业务接入与实验室 | `index.html`、`sw.js`、`character-lab/index.html`、`lab.js`、`lab.css`、`README.md` | 保留提醒业务，SVG 角色接入所有原有槽位；独立实验室可实时控制情绪、动作、Idle、视线、速度、弹性、锚点、背景、尺寸与重置，不读写任务。Service Worker 纳入新文件。 | 设置页链接或直接打开 `/character-lab/index.html`；浏览器 390px / 320px 回归。 | PWA 的灵动岛仍是视觉模拟，不是真正 iOS Live Activity。 |
| G 质量与性能 | `tests/xiaodai-character.test.js`、`tests/character-engine.test.js`、`tests/static-pwa.test.js`、`tests/browser-smoke.js`、`qa/` 截图 | 自动校验六视角无尾巴、双手双脚、独立部件、动作轨道、点击不改 STATE、完整任务/通知流程；手机截图与动作关键姿势人工检查；空闲/隐藏页停止多余帧，静态小图标无持续动画层。 | `npm run check`、`npm test`、`npm run test:browser`；截图在 `qa/`。 | Headless Chrome 的帧间隔仅用于发现明显回归，不代表真实 iPhone 性能；仍需要 iPhone Safari / 主屏幕 PWA 实机确认手感与 iOS 通知。 |

## 注意事项

- 唯一能改变实际提醒 STATE 的业务逻辑仍是 Urgency Engine 计算与页面传入。角色点击只触发 ACTION/GAZE，设置中的 STATE 按钮只是独立预览角色。
- `prefers-reduced-motion` 下不运行背景动作，角色仍可静态表达对应状态和情绪。
- 页面隐藏时暂停 Idle 计时和渲染帧；销毁角色时移除事件与动画资源。
- 此版本没有有效 `.riv` 文件，也没有声称 PWA 可以提供真正的原生灵动岛或强杀后仍运行的本地定时提醒。

最终本地验收：`npm run check`、`npm test`（22/22）、`npm run test:browser`（60 秒 Idle、18 次快速点击、390/320px、通知、完整业务流程、实验室、减少动态效果均通过）与 `npm run test:server` 均通过。Headless Chrome 手机视口的一次 1.7 秒动作采样为 103 帧、P95 帧间隔 17ms；这是本机浏览器指标，不等于 iPhone 实机性能。
