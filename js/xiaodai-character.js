(function (root, factory) {
  const deps = {
    Rig: root.XiaodaiRig || (typeof require === "function" ? require("./xiaodai-rig.js").XiaodaiRig : null),
    Art: root.XiaodaiArt || (typeof require === "function" ? require("./xiaodai-art.js") : null),
    Motion: root.XiaodaiMotion || (typeof require === "function" ? require("./xiaodai-motion.js") : null),
    Idle: root.XiaodaiIdle || (typeof require === "function" ? require("./xiaodai-idle.js") : null)
  };
  const api = factory(deps);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) { root.CharacterAnimationEngine = api.CharacterAnimationEngine; root.DodoCharacter = api.DodoCharacter; }
})(typeof window !== "undefined" ? window : globalThis, function (dependencies) {
  "use strict";
  const { Rig, Art, Motion, Idle } = dependencies;
  if (!Rig || !Art || !Motion || !Idle) throw new Error("Xiaodai art, rig, motion and idle modules must load first");
  const STATES = Object.freeze(["calm", "notice", "urgent", "danger", "done"]);
  const EMOTIONS = Object.freeze(["neutral", "happy", "curious", "confused", "sleepy", "surprised", "sad", "determined", "yawning"]);
  const DEFAULT_EMOTION = Object.freeze({ calm: "neutral", notice: "curious", urgent: "confused", danger: "determined", done: "happy" });
  const LEGACY_ACTIONS = Object.freeze({
    tapHappy: "tapReact", tapCurious: "tapReact", tapDodge: "tapReact", tapProtest: "tapReact",
    acknowledge: "notice", timeCheck: "remind", firm: "remind", notification: "notice",
    happyMicro: "encourage", tinyHop: "hop", shiftWeight: "shiftWeight", observeSide: "peek",
    lookUser: "returnToIdle", breathe: "returnToIdle", stretch: "stretch", easterEgg: "celebrate"
  });
  const registry = new Set();
  const normalizeState = state => STATES.includes(state) ? state : "calm";
  const normalizeEmotion = (emotion, state) => EMOTIONS.includes(emotion) ? emotion : DEFAULT_EMOTION[normalizeState(state)];

  class CharacterStateModel {
    constructor({ state = "calm", emotion } = {}) {
      this.state = normalizeState(state);
      this.emotion = normalizeEmotion(emotion, this.state);
      this.action = "idle";
      this.tapTimes = [];
    }
    setState(state) { this.state = normalizeState(state); this.emotion = DEFAULT_EMOTION[this.state]; this.action = "idle"; this.tapTimes = []; return this.state; }
    setEmotion(emotion) { this.emotion = normalizeEmotion(emotion, this.state); return this.emotion; }
    resetToIdle() { this.action = "idle"; }
    reactionForTap(now = Date.now()) {
      this.tapTimes = this.tapTimes.filter(t => now - t < 1400);
      this.tapTimes.push(now);
      return { state: this.state, emotion: this.emotion, action: "tapReact", count: this.tapTimes.length };
    }
  }

  class CharacterAnimationEngine {
    constructor({ mount, state = "calm", emotion, interactive = true, size = 220, idle = true, label = "小待", speed = 1, elasticity = 1, debugAnchors = false } = {}) {
      if (!mount || typeof mount.replaceChildren !== "function") throw new Error("DodoCharacter requires a mount element");
      if (mount._dodoCharacter) mount._dodoCharacter.destroy();
      this.mount = mount;
      this.model = new CharacterStateModel({ state, emotion });
      this.interactive = Boolean(interactive);
      this.idleEnabled = Boolean(idle);
      this.speed = Math.max(.35, Math.min(2, Number(speed) || 1));
      this.elasticity = Math.max(0, Math.min(1.8, Number(elasticity) || 1));
      this.reducedMotion = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
      this.destroyed = false;
      this.paused = false;
      this.frame = null;
      this.lastFrame = 0;
      this.motion = null;
      this.actionToken = 0;
      this.lastTap = -Infinity;
      this.blinkStart = 0;
      const initialPosture = Art.EMOTION_POSTURES[this.model.emotion] || {};
      this.gazeTarget = { x: initialPosture.gazeX || 0, y: initialPosture.gazeY || 0 };
      this.gazeCurrent = { ...this.gazeTarget };
      this.gazeUntil = 0;
      this.pendingReaction = null;
      this.el = document.createElement("div");
      this.el.className = `dodoCharacter${this.interactive ? " interactive" : ""}`;
      this.el.style.setProperty("--size", `${Math.max(28, Number(size) || 220)}px`);
      this.el.setAttribute("role", this.interactive ? "button" : "img");
      this.el.setAttribute("aria-label", label);
      if (this.interactive) this.el.tabIndex = 0;
      const rigHost = document.createElement("div");
      rigHost.className = "xiaodai-rig-host";
      this.el.appendChild(rigHost);
      this.rig = new Rig(rigHost, { state: this.state, emotion: this.emotion, debugAnchors });
      this.mount.replaceChildren(this.el);
      this.mount._dodoCharacter = this;
      this.idleController = new Idle.IdleBehaviourController(this);
      this.idleController.enabled = this.idleEnabled && !this.reducedMotion;
      this._clickHandler = event => this._handleClick(event);
      this._keyHandler = event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); this._handleClick(event); } };
      if (this.interactive) { this.el.addEventListener("click", this._clickHandler); this.el.addEventListener("keydown", this._keyHandler); }
      registry.add(this);
      this._sync();
      if (this.idleController.enabled) { this.idleController.start(); this._scheduleFrame(); }
    }

    get state() { return this.model.state; }
    get emotion() { return this.model.emotion; }
    get action() { return this.model.action; }

    _sync() {
      this.el.dataset.state = this.state;
      this.el.dataset.emotion = this.emotion;
      this.el.dataset.action = this.action;
      this.el.dataset.idleEnabled = String(this.idleEnabled && !this.reducedMotion);
      this.el.dispatchEvent(new CustomEvent("dodochange", { bubbles: true, detail: { state: this.state, emotion: this.emotion, action: this.action } }));
    }

    // Application context is supplied by the urgency engine; touch handlers never call it.
    setAppContext(context) {
      if (context && context.state) this.setState(context.state);
      if (context && context.emotion) this.setEmotion(context.emotion);
      return this;
    }
    setState(state) {
      const next = normalizeState(state);
      if (next === this.state) return this;
      this.actionToken += 1;
      this.motion = null;
      this.pendingReaction = null;
      this.model.setState(next);
      this.rig.setState(next);
      this.rig.setEmotion(this.emotion, { instant: this.reducedMotion });
      this.playAction("returnToIdle");
      return this;
    }
    setEmotion(emotion) {
      this.model.setEmotion(emotion);
      if (this.action === "idle") {
        this.rig.setEmotion(this.emotion, { instant: this.reducedMotion });
        this.playAction("returnToIdle");
      }
      this._sync();
      return this;
    }
    setGazeTarget(x, y) {
      if (!Number.isFinite(x) || !Number.isFinite(y)) return this;
      const rect = this.el.getBoundingClientRect();
      if (!rect.width || !rect.height) return this;
      this.gazeTarget.x = Math.max(-3, Math.min(3, ((x - rect.left) / rect.width - .5) * 6));
      this.gazeTarget.y = Math.max(-2.5, Math.min(2.5, ((y - rect.top) / rect.height - .5) * 5));
      this.gazeUntil = performance.now() + 1600;
      if (this.reducedMotion) this.rig.apply({ gazeX: this.gazeTarget.x, gazeY: this.gazeTarget.y });
      else this._scheduleFrame();
      return this;
    }
    lookAt(x, y) { return this.setGazeTarget(x, y); }
    blink() {
      if (this.destroyed || this.reducedMotion || this.emotion === "surprised") return this;
      this.blinkStart = performance.now();
      this._scheduleFrame();
      return this;
    }
    setIdleEnabled(enabled) {
      this.idleEnabled = Boolean(enabled);
      this.idleController.setEnabled(this.idleEnabled && !this.reducedMotion);
      this._sync();
      if (this.idleEnabled) this._scheduleFrame();
      return this;
    }
    setSpeed(speed) { this.speed = Math.max(.35, Math.min(2, Number(speed) || 1)); return this; }
    setElasticity(elasticity) { this.elasticity = Math.max(0, Math.min(1.8, Number(elasticity) || 1)); return this; }
    setDebugAnchors(enabled) { this.rig.setDebugAnchors(enabled); return this; }

    playAction(name, payload = {}) {
      if (this.destroyed) return this;
      const action = LEGACY_ACTIONS[name] || name;
      let spec = Motion.ACTIONS[action];
      if (!spec) return this;
      if (action === "returnToIdle") {
        const posture = Art.EMOTION_POSTURES[this.emotion] || {};
        spec = { ...spec, tracks: Object.fromEntries(Object.entries(spec.tracks).map(([key, track]) => [key, [[0, null], [1, Object.hasOwn(posture, key) ? posture[key] : ["bodyX", "bodyY", "shadow"].includes(key) ? 1 : 0, key === "note" ? "spring" : "inOut"]]])) };
      }
      if (this.motion && this.motion.spec.priority > spec.priority && action !== "returnToIdle") return this;
      this.actionToken += 1;
      const token = this.actionToken;
      this.pendingReaction = action === "notice" ? this.pendingReaction : null;
      this.model.action = action;
      if (payload.emotion || spec.emotion) this.rig.setEmotion(normalizeEmotion(payload.emotion || spec.emotion, this.state), { instant: this.reducedMotion });
      this._sync();
      if (this.reducedMotion) {
        this.motion = null;
        queueMicrotask(() => { if (token === this.actionToken) this.resetToIdle(); });
        return this;
      }
      const from = { ...this.rig.values };
      this.motion = { spec, action, from, started: performance.now(), duration: spec.duration / this.speed, token };
      if (payload.tapPoint) this.setGazeTarget(payload.tapPoint.x, payload.tapPoint.y);
      this._scheduleFrame();
      return this;
    }
    play(name, payload = {}) {
      if (["blink", "doubleBlink", "halfBlink", "sleepy", "happySquint"].includes(name)) { this.blink(); return this; }
      if (name === "lookLeft" || name === "lookRight" || name === "lookUp" || name === "lookDown") {
        const rect = this.el.getBoundingClientRect();
        const dx = name === "lookLeft" ? -.35 : name === "lookRight" ? .35 : 0;
        const dy = name === "lookUp" ? -.35 : name === "lookDown" ? .35 : 0;
        return this.setGazeTarget(rect.left + rect.width * (.5 + dx), rect.top + rect.height * (.5 + dy));
      }
      if (name === "lookAtTarget") return this.lookAt(payload.x, payload.y);
      return this.playAction(name, payload);
    }
    performIdle(name) {
      if (name === "lookAside" || name === "lookNote") {
        const rect = this.el.getBoundingClientRect();
        const x = name === "lookNote" ? .5 : Math.random() < .5 ? .20 : .80;
        const y = name === "lookNote" ? .21 : .45;
        this.model.action = name;
        this._sync();
        this.setGazeTarget(rect.left + rect.width * x, rect.top + rect.height * y);
        clearTimeout(this.idleResetTimer);
        this.idleResetTimer = setTimeout(() => { if (this.action === name) this.resetToIdle(); }, 950 + Math.random() * 750);
      } else this.playAction(name);
    }
    _handleClick(event) {
      if (!this.interactive || this.destroyed) return;
      const now = performance.now();
      const rect = this.el.getBoundingClientRect();
      const point = { x: event.clientX || rect.left + rect.width / 2, y: event.clientY || rect.top + rect.height / 2 };
      this.setGazeTarget(point.x, point.y);
      this.model.reactionForTap(Date.now());
      if (now - this.lastTap < 250) return; // rapid taps redirect gaze, never stack timelines
      this.lastTap = now;
      if (this.motion && ["notice", "tapReact"].includes(this.action)) return;
      if (this.action === "celebrate") return;
      this.pendingReaction = point;
      this.playAction("notice");
    }
    _scheduleFrame() {
      if (this.frame != null || this.destroyed || this.paused || (typeof document !== "undefined" && document.hidden)) return;
      this.frame = requestAnimationFrame(time => this._tick(time));
    }
    _tick(now) {
      this.frame = null;
      if (this.destroyed || this.paused) return;
      const active = Boolean(this.motion || this.blinkStart || now < this.gazeUntil);
      if (now - this.lastFrame < (active ? 16 : 40)) { this._scheduleFrame(); return; }
      this.lastFrame = now;
      let values;
      if (this.motion) {
        const clip = this.motion;
        const t = Math.min(1, (now - clip.started) / clip.duration);
        values = { ...clip.from };
        for (const [key, track] of Object.entries(clip.spec.tracks)) {
          values[key] = Motion.sampleTrack(track, t, clip.from[key], this.elasticity);
        }
        if (t >= 1 && this.motion === clip) {
          this.motion = null;
          queueMicrotask(() => this._completeAction(clip));
        }
      } else {
        values = { ...this.rig.values };
        if (this.idleEnabled && !this.reducedMotion) {
          const posture = Art.EMOTION_POSTURES[this.emotion] || {};
          const breath = Math.sin(now / 780) * .0045;
          values.bodyX = (posture.bodyX || 1) + breath;
          values.bodyY = (posture.bodyY || 1) - breath;
          values.y = (posture.y || 0) + Math.sin(now / 920) * .45;
          values.note = (posture.note || 0) + Math.sin(now / 1160 + 1) * .45;
        }
      }
      const gazeSpeed = active ? .25 : .12;
      if (now > this.gazeUntil) {
        const posture = Art.EMOTION_POSTURES[this.emotion] || {};
        this.gazeTarget.x = posture.gazeX || 0;
        this.gazeTarget.y = posture.gazeY || 0;
      }
      this.gazeCurrent.x += (this.gazeTarget.x - this.gazeCurrent.x) * gazeSpeed;
      this.gazeCurrent.y += (this.gazeTarget.y - this.gazeCurrent.y) * gazeSpeed;
      if (now < this.gazeUntil || !this.motion) { values.gazeX = this.gazeCurrent.x; values.gazeY = this.gazeCurrent.y; }
      if (this.blinkStart) {
        const phase = (now - this.blinkStart) / 175;
        if (phase >= 1) { this.blinkStart = 0; values.blink = 0; }
        else values.blink = Math.sin(Math.PI * phase);
      }
      this.rig.apply(values);
      if (this.motion || (this.idleEnabled && !this.reducedMotion) || this.blinkStart || now < this.gazeUntil && !this.reducedMotion) this._scheduleFrame();
    }
    _completeAction(clip) {
      if (this.destroyed || clip.token !== this.actionToken) return;
      if (clip.action === "notice" && this.pendingReaction) {
        const point = this.pendingReaction;
        this.pendingReaction = null;
        this.playAction("tapReact", { tapPoint: point, emotion: this.state === "danger" ? "determined" : this.state === "urgent" ? "confused" : "happy" });
      } else if (clip.action === "returnToIdle") {
        this.model.resetToIdle();
        this.rig.setEmotion(this.emotion, { instant: this.reducedMotion });
        this._sync();
      } else this.resetToIdle();
    }
    resetToIdle() {
      if (this.destroyed) return this;
      this.pendingReaction = null;
      if (this.reducedMotion || !this.motion && this.action === "idle") {
        this.model.resetToIdle();
        this.rig.setEmotion(this.emotion, { instant: this.reducedMotion });
        this._sync();
        return this;
      }
      this.playAction("returnToIdle");
      return this;
    }
    pause() {
      this.paused = true;
      this.idleController.stop();
      clearTimeout(this.idleResetTimer);
      if (this.frame != null) cancelAnimationFrame(this.frame);
      this.frame = null;
      this.motion = null;
      this.model.resetToIdle();
      this.rig.apply({ x: 0, y: 0, bodyX: 1, bodyY: 1, faceX: 0, faceY: 0, leftArm: 0, rightArm: 0, leftFootX: 0, leftFootY: 0, rightFootX: 0, rightFootY: 0, note: 0, gazeX: 0, gazeY: 0, shadow: 1, blink: 0, ...(Art.EMOTION_POSTURES[this.emotion] || {}) });
      this.rig.setEmotion(this.emotion, { instant: true });
      this._sync();
    }
    resume() { if (!this.destroyed) { this.paused = false; if (this.idleEnabled && !this.reducedMotion) this.idleController.start(); this._scheduleFrame(); } }
    destroy() {
      if (this.destroyed) return;
      this.destroyed = true;
      this.idleController.stop();
      clearTimeout(this.idleResetTimer);
      if (this.frame != null) cancelAnimationFrame(this.frame);
      this.el.removeEventListener("click", this._clickHandler);
      this.el.removeEventListener("keydown", this._keyHandler);
      this.rig.destroy();
      registry.delete(this);
      if (this.mount._dodoCharacter === this) delete this.mount._dodoCharacter;
    }
  }
  function DodoCharacter(options) { return new CharacterAnimationEngine(options); }
  DodoCharacter.STATES = STATES;
  DodoCharacter.EMOTIONS = EMOTIONS;
  DodoCharacter.mount = options => new CharacterAnimationEngine(options);
  DodoCharacter.from = mount => mount && mount._dodoCharacter || null;
  DodoCharacter.destroy = mount => { if (mount && mount._dodoCharacter) mount._dodoCharacter.destroy(); };
  if (typeof document !== "undefined") document.addEventListener("visibilitychange", () => registry.forEach(c => document.hidden ? c.pause() : c.resume()));
  return { STATES, EMOTIONS, DEFAULT_EMOTION, CharacterStateModel, CharacterAnimationEngine, DodoCharacter };
});
