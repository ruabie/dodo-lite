"use strict";

const { spawn } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");

const root = path.resolve(__dirname, "..");
const port = 9334;
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const chrome = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const output = path.join(root, "qa");

async function waitFor(url) {
  for (let i = 0; i < 50; i += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) return response;
    } catch (_) {}
    await delay(150);
  }
  throw new Error(`Timed out waiting for ${url}`);
}
class CDP {
  constructor(url) {
    this.url = url;
    this.id = 0;
    this.pending = new Map();
    this.events = new Map();
  }
  async open() {
    this.socket = new WebSocket(this.url);
    await new Promise((resolve, reject) => {
      this.socket.addEventListener("open", resolve, { once: true });
      this.socket.addEventListener("error", reject, { once: true });
    });
    this.socket.addEventListener("message", (event) => {
      const message = JSON.parse(event.data);
      if (message.id && this.pending.has(message.id)) {
        const pair = this.pending.get(message.id);
        this.pending.delete(message.id);
        if (message.error) pair.reject(new Error(message.error.message));
        else pair.resolve(message.result);
      }
      if (message.method && this.events.has(message.method))
        for (const listener of this.events.get(message.method))
          listener(message.params);
    });
  }
  on(method, listener) {
    this.events.set(method, [...(this.events.get(method) || []), listener]);
  }
  send(method, params = {}) {
    const id = ++this.id;
    this.socket.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve, reject) =>
      this.pending.set(id, { resolve, reject }),
    );
  }
  async evaluate(expression) {
    const data = await this.send("Runtime.evaluate", {
      expression,
      awaitPromise: true,
      returnByValue: true,
    });
    if (data.exceptionDetails)
      throw new Error(data.exceptionDetails.text || "Evaluation failed");
    return data.result.value;
  }
  close() {
    this.socket.close();
  }
}
async function screenshot(cdp, name) {
  const data = await cdp.send("Page.captureScreenshot", {
    format: "png",
    fromSurface: true,
    captureBeyondViewport: false,
  });
  fs.mkdirSync(output, { recursive: true });
  fs.writeFileSync(path.join(output, name), Buffer.from(data.data, "base64"));
}

async function main() {
  assert.ok(
    fs.existsSync(chrome),
    "Chrome is required for the browser comparison test",
  );
  const server = spawn(
    process.execPath,
    [path.join(__dirname, "serve-smoke.js")],
    { cwd: root, stdio: "ignore" },
  );
  let browser, cdp;
  try {
    await waitFor("http://127.0.0.1:4173/");
    browser = spawn(
      chrome,
      [
        "--headless=new",
        "--disable-gpu",
        "--hide-scrollbars",
        "--no-first-run",
        `--remote-debugging-port=${port}`,
        `--user-data-dir=${path.join(root, ".chrome-performance-v2")}`,
        "about:blank",
      ],
      { stdio: "ignore" },
    );
    const response = await waitFor(`http://127.0.0.1:${port}/json/list`);
    const target = (await response.json()).find((item) => item.type === "page");
    cdp = new CDP(target.webSocketDebuggerUrl);
    await cdp.open();
    const errors = [];
    cdp.on("Runtime.exceptionThrown", (event) =>
      errors.push(event.exceptionDetails.text),
    );
    cdp.on("Runtime.consoleAPICalled", (event) => {
      if (event.type === "error")
        errors.push(
          event.args.map((arg) => arg.value || arg.description).join(" "),
        );
    });
    await cdp.send("Page.enable");
    await cdp.send("Runtime.enable");
    await cdp.send("Emulation.setDeviceMetricsOverride", {
      width: 390,
      height: 844,
      deviceScaleFactor: 3,
      mobile: true,
      screenWidth: 390,
      screenHeight: 844,
    });
    await cdp.send("Page.navigate", {
      url: "http://127.0.0.1:4173/character-lab/performance-v2.html",
    });
    await delay(1100);
    const initial = await cdp.evaluate(
      `(() => ({cards:document.querySelectorAll('.pose-card').length,newSvg:!!document.querySelector('#new-character svg'),oldSvg:!!document.querySelector('#old-character svg'),body:document.querySelector('#new-character [data-part="body"]')?.getAttribute('d'),scrollWidth:document.documentElement.scrollWidth,width:innerWidth}))()`,
    );
    assert.equal(initial.cards, 5);
    assert.ok(initial.newSvg && initial.oldSvg);
    assert.ok(initial.body.startsWith("M128 91"));
    assert.ok(initial.scrollWidth <= initial.width);
    await screenshot(cdp, "performance-v2-static-mobile.png");
    const poses = await cdp.evaluate(
      `(() => [...document.querySelectorAll('.pose-card')].map(card=>{card.click();return {name:card.dataset.pose,body:document.querySelector('#new-character [data-part="body"]').getAttribute('d'),arm:document.querySelector('#new-character [data-part="left-arm"]').getAttribute('d')}}))()`,
    );
    assert.equal(new Set(poses.map((pose) => pose.body)).size, 5);
    assert.equal(new Set(poses.map((pose) => pose.arm)).size, 5);
    const motion = await cdp.evaluate(`(async () => {
      const api=window.PerformanceV2Preview, body=()=>document.querySelector('#new-character [data-part="body"]'),
      eye=()=>document.querySelector('#new-character [data-part="left-eye"]'),
      old=()=>document.querySelector('#old-character [data-part="body"]');
      const eyeNode=eye(), bodyNode=body(), oldNode=old();
      const frames=[0,.10,.22,.39,.56,.76,.94,1].map(t=>{api.renderAt(t);return {t,body:body().getAttribute('d'),eye:eye().getAttribute('d'),oldBody:old().querySelector('path').getAttribute('d'),oldTransform:old().getAttribute('transform')}});
      document.querySelector('#scrub').value=500;document.querySelector('#scrub').dispatchEvent(new Event('input',{bubbles:true}));
      const scrubbed=api.progress;
      document.querySelector('#step-forward').click();const stepped=api.progress;
      document.querySelector('#debug').click();const debug=document.querySelector('#new-stage').classList.contains('show-debug');
      const reduced=document.querySelector('#reduced');reduced.checked=true;reduced.dispatchEvent(new Event('change',{bubbles:true}));document.querySelector('#play').click();const reducedStatic=api.progress;
      reduced.checked=false;reduced.dispatchEvent(new Event('change',{bubbles:true}));api.renderAt(0);document.querySelector('#play').click();
      await new Promise(r=>setTimeout(r,180));const played=api.progress;document.querySelector('#pause').click();
      return {frames,stableNodes:eye()===eyeNode&&body()===bodyNode&&old()===oldNode,scrubbed,stepped,debug,reducedStatic,played};
    })()`);
    assert.ok(
      motion.stableNodes,
      "V2 face and body nodes should survive all morphs",
    );
    assert.equal(
      new Set(motion.frames.map((frame) => frame.body)).size,
      motion.frames.length,
    );
    assert.ok(new Set(motion.frames.map((frame) => frame.eye)).size >= 5);
    assert.equal(
      new Set(motion.frames.map((frame) => frame.oldBody)).size,
      1,
      "V1 body path remains fixed",
    );
    assert.ok(
      new Set(motion.frames.map((frame) => frame.oldTransform)).size > 1,
      "V1 uses body transform",
    );
    assert.equal(motion.scrubbed, 0.5);
    assert.ok(motion.stepped > 0.5 && motion.stepped < 0.53);
    assert.ok(motion.debug);
    assert.ok(motion.reducedStatic > 0.4 && motion.reducedStatic < 0.7);
    assert.ok(motion.played > 0.05 && motion.played < 0.3);
    const tools = await cdp.evaluate(`(() => {
      const api=window.PerformanceV2Preview;
      const slider=document.querySelector('#phase-controls input');slider.value='350';slider.dispatchEvent(new Event('input',{bubbles:true}));
      const duration=api.timing.notice, readout=document.querySelector('#time-output').textContent;
      document.querySelector('#touch-right').click();api.pause();api.renderAt(.4);
      const side=api.touchSide, rightPath=document.querySelector('#new-character [data-part="body"]').getAttribute('d');
      document.querySelector('#touch-left').click();api.pause();api.renderAt(.4);
      const leftPath=document.querySelector('#new-character [data-part="body"]').getAttribute('d');
      return {duration,readout,side,differentSides:rightPath!==leftPath};
    })()`);
    assert.equal(tools.duration, 350);
    assert.match(tools.readout, /1340 ms/);
    assert.equal(tools.side, "right");
    assert.ok(tools.differentSides);
    await cdp.evaluate(
      `(() => { window.scrollTo(0,0);window.PerformanceV2Preview.renderAt(.56);return true; })()`,
    );
    await delay(100);
    await screenshot(cdp, "performance-v2-reaction-mobile.png");
    await cdp.evaluate(
      `(() => { document.querySelector('#pose-cards').scrollIntoView({block:'center'}); return true; })()`,
    );
    await delay(150);
    await screenshot(cdp, "performance-v2-pose-board-mobile.png");
    await cdp.send("Emulation.setDeviceMetricsOverride", {
      width: 320,
      height: 700,
      deviceScaleFactor: 2,
      mobile: true,
      screenWidth: 320,
      screenHeight: 700,
    });
    await delay(100);
    const narrow = await cdp.evaluate(
      `(() => ({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,columns:getComputedStyle(document.querySelector('.compare')).gridTemplateColumns}))()`,
    );
    assert.equal(narrow.width, 320);
    assert.ok(
      narrow.scrollWidth <= narrow.width,
      "320px viewport must not overflow",
    );
    await screenshot(cdp, "performance-v2-320px.png");
    await cdp.send("Emulation.setDeviceMetricsOverride", {
      width: 1280,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false,
      screenWidth: 1280,
      screenHeight: 900,
    });
    await cdp.evaluate(
      `(() => { document.querySelector('#debug').checked=false;document.querySelectorAll('.stage').forEach(stage=>stage.classList.remove('show-debug'));window.scrollTo(0,0);window.PerformanceV2Preview.renderAt(.56);return true; })()`,
    );
    await delay(100);
    await screenshot(cdp, "performance-v2-compare-desktop.png");
    console.log(
      JSON.stringify(
        {
          initial: {
            cards: initial.cards,
            mobileOverflow: initial.scrollWidth > initial.width,
          },
          staticMorphs: poses.length,
          motion: {
            stableNodes: motion.stableNodes,
            frames: motion.frames.length,
            scrubbed: motion.scrubbed,
            stepped: motion.stepped,
            played: motion.played,
          },
          tools,
          narrow,
          errors,
        },
        null,
        2,
      ),
    );
    assert.deepEqual(errors, []);
  } finally {
    if (cdp) cdp.close();
    if (browser) browser.kill();
    server.kill();
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
