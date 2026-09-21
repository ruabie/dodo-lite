"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = file => fs.readFileSync(path.join(root, file), "utf8");

test("app shell contains every preserved product view", () => {
  const html = read("index.html");
  for (const id of ["view-now", "view-today", "view-focus", "view-settings", "dangerScreen", "doneFlash", "island"]) {
    assert.match(html, new RegExp(`id=["']${id}["']`));
  }
});

test("all manifest and app-shell files exist", () => {
  const manifest = JSON.parse(read("manifest.webmanifest"));
  assert.equal(manifest.display, "standalone");
  const required = [
    "index.html", "manifest.webmanifest", "sw.js", "css/app.css", "css/dodo.css", "js/app.js",
    "js/storage.js", "js/urgency-engine.js", "js/character-engine.js", "js/notification-manager.js",
    "assets/dodo_calm@2x.png", "assets/dodo_notice@2x.png", "assets/dodo_urgent@2x.png",
    "assets/dodo_danger@2x.png", "assets/dodo_done@2x.png"
  ];
  required.forEach(file => assert.ok(fs.existsSync(path.join(root, file)), `${file} should exist`));
});

test("service worker handles offline shell, push and notification clicks", () => {
  const source = read("sw.js");
  assert.match(source, /addEventListener\("install"/);
  assert.match(source, /addEventListener\("push"/);
  assert.match(source, /showNotification/);
  assert.match(source, /addEventListener\("notificationclick"/);
});

test("tap actions never request STATE changes", () => {
  const source = read("js/character-engine.js");
  const playStart = source.indexOf("play(action, payload");
  const clickStart = source.indexOf("_handleClick(event)", playStart);
  const playSource = source.slice(playStart, clickStart);
  assert.doesNotMatch(playSource, /\.setState\s*\(/);
  assert.doesNotMatch(source, /tapProtest[^\n]+setState/);
});

test("original Retina state assets are not low-resolution placeholders", () => {
  for (const state of ["calm", "notice", "urgent", "danger", "done"]) {
    const file = path.join(root, "assets", `dodo_${state}@2x.png`);
    const buffer = fs.readFileSync(file);
    assert.equal(buffer.readUInt32BE(16), 1024);
    assert.equal(buffer.readUInt32BE(20), 1024);
  }
});
