(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.XiaodaiIdle = api;
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";
  const OPTIONS = Object.freeze([
    ["lookAside", 25], ["shiftWeight", 22], ["peek", 15], ["lookNote", 10],
    ["stretch", 9], ["encourage", 7], ["yawn", 4], ["pause", 8]
  ]);
  function chooseIdleAction(random = Math.random(), previous = "", cooldowns = {}) {
    const eligible = OPTIONS.filter(([name]) => name !== previous && (!cooldowns[name] || cooldowns[name] <= Date.now()));
    const candidates = eligible.length ? eligible : [["pause", 1]];
    const total = candidates.reduce((sum, [, weight]) => sum + weight, 0);
    let cursor = Math.max(0, Math.min(.999999, Number(random) || 0)) * total;
    for (const [name, weight] of candidates) { if (cursor < weight) return name; cursor -= weight; }
    return candidates.at(-1)[0];
  }
  class IdleBehaviourController {
    constructor(character, { random = Math.random } = {}) {
      this.character = character;
      this.random = random;
      this.enabled = true;
      this.previous = "";
      this.cooldowns = {};
      this.blinkTimer = null;
      this.behaviourTimer = null;
      this.paused = true;
    }
    start() {
      if (!this.paused || !this.enabled) return;
      this.paused = false;
      this._scheduleBlink();
      this._scheduleBehaviour();
    }
    _scheduleBlink() {
      if (this.paused) return;
      const state = this.character.state;
      const delay = (state === "danger" ? 3400 : 2500) + this.random() * (state === "danger" ? 3600 : 3500);
      this.blinkTimer = setTimeout(() => {
        this.blinkTimer = null;
        if (!this.paused && !["surprised"].includes(this.character.emotion) && this.character.action !== "notice") {
          this.character.blink();
          if (this.random() < .13) setTimeout(() => { if (!this.paused) this.character.blink(); }, 190);
        }
        this._scheduleBlink();
      }, delay);
    }
    _scheduleBehaviour() {
      if (this.paused) return;
      // Independent random timing and cooldowns prevent a fixed "idle loop".
      const delay = 3500 + this.random() * 4800;
      this.behaviourTimer = setTimeout(() => {
        this.behaviourTimer = null;
        if (!this.paused && this.character.action === "idle") {
          const name = chooseIdleAction(this.random(), this.previous, this.cooldowns);
          this.previous = name;
          if (name !== "pause") {
            this.cooldowns[name] = Date.now() + (["yawn", "stretch", "encourage"].includes(name) ? 30000 : 8000);
            this.character.performIdle(name);
          }
        }
        this._scheduleBehaviour();
      }, delay);
    }
    stop() {
      this.paused = true;
      clearTimeout(this.blinkTimer);
      clearTimeout(this.behaviourTimer);
      this.blinkTimer = this.behaviourTimer = null;
    }
    setEnabled(enabled) { this.enabled = Boolean(enabled); this.stop(); if (this.enabled) this.start(); }
  }
  return { chooseIdleAction, IdleBehaviourController };
});
