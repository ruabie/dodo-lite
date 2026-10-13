"use strict";

const { spawn } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");

const root = path.resolve(__dirname, "..");
const chrome = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const port = 9335;
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitFor(url) {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(1000) });
      if (response.ok) return response;
    } catch (_) {}
    await delay(150);
  }
  throw new Error(`Timed out waiting for ${url}`);
}

async function main() {
  assert.ok(fs.existsSync(chrome), "Chrome is required for mobile browser smoke test");
  const server = spawn(process.execPath, [path.join(__dirname, "serve-smoke.js")], { cwd: root, stdio: "ignore" });
  let browser, socket;
  try {
    await waitFor("http://127.0.0.1:4173/character-lab/art-reference.html");
    browser = spawn(chrome, [
      "--headless=new", "--disable-gpu", "--no-first-run",
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${path.join(root, ".chrome-art-reference")}`,
      "about:blank"
    ], { stdio: "ignore" });
    const targets = await (await waitFor(`http://127.0.0.1:${port}/json/list`)).json();
    const target = targets.find((item) => item.type === "page");
    assert.ok(target, "Chrome page target is available");
    socket = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => {
      socket.addEventListener("open", resolve, { once: true });
      socket.addEventListener("error", reject, { once: true });
    });
    let nextId = 0;
    const pending = new Map();
    const errors = [];
    socket.addEventListener("message", (event) => {
      const message = JSON.parse(event.data);
      if (message.id && pending.has(message.id)) {
        const { resolve, reject } = pending.get(message.id);
        pending.delete(message.id);
        if (message.error) reject(new Error(message.error.message)); else resolve(message.result);
      }
      if (message.method === "Runtime.exceptionThrown") errors.push(message.params.exceptionDetails.text);
      if (message.method === "Runtime.consoleAPICalled" && message.params.type === "error") errors.push("Console error");
    });
    const send = (method, params = {}) => new Promise((resolve, reject) => {
      const id = ++nextId;
      pending.set(id, { resolve, reject });
      socket.send(JSON.stringify({ id, method, params }));
    });
    await send("Page.enable");
    await send("Runtime.enable");
    const results = [];
    for (const width of [390, 320]) {
      await send("Emulation.setDeviceMetricsOverride", { width, height: 844, screenWidth: width, screenHeight: 844, deviceScaleFactor: 2, mobile: true });
      await send("Page.navigate", { url: "http://127.0.0.1:4173/character-lab/art-reference.html" });
      await delay(850);
      const reply = await send("Runtime.evaluate", { expression: `(() => ({
        width: innerWidth,
        documentWidth: document.documentElement.scrollWidth,
        cards: document.querySelectorAll('.cards .card').length,
        svg: (() => { const image = document.querySelector('img[src$="xiaodai-v55-front.svg"]'); return !!image && image.complete && image.naturalWidth > 0 && image.naturalHeight > 0; })(),
        images: [...document.querySelectorAll('.cards img[src$=".png"]')].map(img => ({complete: img.complete, width: img.naturalWidth, height: img.naturalHeight})),
        stripScrollable: document.querySelector('.cards').scrollWidth > document.querySelector('.cards').clientWidth
      }))()`, returnByValue: true });
      if (reply.exceptionDetails) throw new Error(reply.exceptionDetails.text);
      const data = reply.result.value;
      assert.equal(data.width, width);
      assert.ok(data.documentWidth <= width, `no page overflow at ${width}px`);
      assert.equal(data.cards, 6);
      assert.equal(data.svg, true, JSON.stringify(data));
      assert.equal(data.images.length, 5);
      assert.ok(data.images.every((image) => image.complete && image.width === 1024 && image.height === 1024));
      assert.equal(data.stripScrollable, true);
      results.push(data);
      if (width === 390 && process.env.DODO_ART_QA_SCREENSHOT) {
        const shot = await send("Page.captureScreenshot", { format: "png", fromSurface: true, captureBeyondViewport: false });
        fs.writeFileSync(process.env.DODO_ART_QA_SCREENSHOT, Buffer.from(shot.data, "base64"));
      }
    }
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({ mobileViewports: results, errors }, null, 2));
  } finally {
    if (socket) socket.close();
    if (browser) browser.kill();
    server.kill();
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
