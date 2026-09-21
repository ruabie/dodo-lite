(function (root, factory) {
  const api = factory(root);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) {
    root.CharacterAnimationEngine = api.CharacterAnimationEngine;
    root.DodoCharacter = api.DodoCharacter;
  }
})(typeof window !== "undefined" ? window : globalThis, function (root) {
  "use strict";

  const STATES = Object.freeze(["calm", "notice", "urgent", "danger", "done"]);
  const EMOTIONS = Object.freeze(["neutral", "happy", "curious", "surprised", "playful", "attentive", "concerned", "determined", "sleepy"]);
  const ASSETS = Object.freeze({
    calm: "./assets/dodo_calm@2x.png",
    notice: "./assets/dodo_notice@2x.png",
    urgent: "./assets/dodo_urgent@2x.png",
    danger: "./assets/dodo_danger@2x.png",
    done: "./assets/dodo_done@2x.png"
  });
  const DEFAULT_EMOTION = Object.freeze({ calm: "neutral", notice: "attentive", urgent: "concerned", danger: "determined", done: "happy" });
  const FX = Object.freeze({ calm: ["", "", ""], notice: ["!", "✦", ""], urgent: ["•", "•", ""], danger: ["!", "!", ""], done: ["✦", "★", "✦"] });
  const registry = new Set();

  function normalizeState(value) {
    return STATES.includes(value) ? value : "calm";
  }

  function normalizeEmotion(value, state = "calm") {
    return EMOTIONS.includes(value) ? value : DEFAULT_EMOTION[normalizeState(state)];
  }

  class CharacterStateModel {
    constructor({ state = "calm", emotion } = {}) {
      this.state = normalizeState(state);
      this.emotion = normalizeEmotion(emotion, this.state);
      this.action = "idle";
      this.tapTimes = [];
    }

    setState(state) {
      this.state = normalizeState(state);
      this.emotion = DEFAULT_EMOTION[this.state];
      this.action = "idle";
      this.tapTimes = [];
      return this.state;
    }

    setEmotion(emotion) {
      this.emotion = normalizeEmotion(emotion, this.state);
      return this.emotion;
    }

    startAction(action, emotion) {
      this.action = action || "idle";
      if (emotion) this.setEmotion(emotion);
    }

    resetToIdle() {
      this.action = "idle";
      this.emotion = DEFAULT_EMOTION[this.state];
    }

    reactionForTap(now = Date.now()) {
      this.tapTimes = this.tapTimes.filter(time => now - time < 1400);
      this.tapTimes.push(now);
      const count = this.tapTimes.length;
      const reactions = {
        calm: [
          ["tapHappy", "happy"], ["tapCurious", "curious"], ["tapDodge", "surprised"], ["tapProtest", "playful"]
        ],
        notice: [
          ["acknowledge", "attentive"], ["tapCurious", "curious"], ["tapDodge", "surprised"], ["tapProtest", "attentive"]
        ],
        urgent: [
          ["timeCheck", "concerned"], ["acknowledge", "attentive"], ["tapDodge", "surprised"], ["tapProtest", "concerned"]
        ],
        danger: [
          ["firm", "determined"], ["acknowledge", "determined"], ["tapDodge", "surprised"], ["tapProtest", "determined"]
        ],
        done: [
          ["tapHappy", "happy"], ["happyMicro", "happy"], ["tapDodge", "playful"], ["celebrate", "happy"]
        ]
      };
      const [action, emotion] = reactions[this.state][Math.min(count, 4) - 1];
      return { state: this.state, emotion, action, count };
    }
  }

  const IDLE_WEIGHTS = Object.freeze([
    ["breathe", 60], ["observeSide", 15], ["shiftWeight", 8], ["lookUser", 5], ["stretch", 4],
    ["tinyHop", 3], ["yawn", 2], ["peek", 1], ["happyMicro", 1], ["easterEgg", 1]
  ]);

  function chooseIdleAction(randomValue = Math.random(), previous = "") {
    let cursor = Math.max(0, Math.min(0.999999, Number(randomValue) || 0)) * 100;
    let selected = "breathe";
    for (const [name, weight] of IDLE_WEIGHTS) {
      if (cursor < weight) { selected = name; break; }
      cursor -= weight;
    }
    const special = !["breathe", "observeSide", "shiftWeight", "lookUser"].includes(selected);
    if (special && selected === previous) return "breathe";
    return selected;
  }

  function el(name, className) {
    const node = document.createElement(name);
    if (className) node.className = className;
    return node;
  }

  class CharacterAnimationEngine {
    constructor({ mount, state = "calm", emotion, interactive = true, size = 220, idle = true, label = "小待" } = {}) {
      if (!mount || typeof mount.appendChild !== "function") throw new Error("DodoCharacter requires a mount element");
      if (mount._dodoCharacter) mount._dodoCharacter.destroy();
      this.mount = mount;
      this.model = new CharacterStateModel({ state, emotion });
      this.interactive = Boolean(interactive);
      this.idleEnabled = Boolean(idle);
      this.destroyed = false;
      this.idleTimer = null;
      this.actionTimers = new Set();
      this.animations = new Set();
      this.lastIdleAction = "";
      this.actionToken = 0;
      this.gaze = { x: 0, y: 0 };
      this.reducedMotion = Boolean(root.matchMedia && root.matchMedia("(prefers-reduced-motion: reduce)").matches);
      this.el = this._build(size, label);
      this.mount.replaceChildren(this.el);
      this.mount._dodoCharacter = this;
      this._syncModel();
      this._onClick = event => this._handleClick(event);
      if (this.interactive) this.el.addEventListener("click", this._onClick);
      registry.add(this);
      if (this.idleEnabled) this._scheduleIdle(true);
    }

    get state() { return this.model.state; }
    get emotion() { return this.model.emotion; }
    get action() { return this.model.action; }

    _build(size, label) {
      const character = el("div", `dodoCharacter${this.interactive ? " interactive" : ""}`);
      character.style.setProperty("--size", `${Math.max(28, Number(size) || 220)}px`);
      character.setAttribute("role", this.interactive ? "button" : "img");
      character.setAttribute("aria-label", label);
      if (this.interactive) character.tabIndex = 0;

      this.shadow = el("div", "dodoShadow");
      this.pose = el("div", "dodoPose");
      this.main = el("img", "dodoSprite main");
      this.main.alt = "";
      this.main.draggable = false;
      this.alt = el("img", "dodoSprite alt");
      this.alt.alt = "";
      this.alt.draggable = false;
      this.pose.append(this.main, this.alt);

      const face = el("div", "dodoFaceFx");
      this.blinkPatch = el("div", "blinkPatch");
      this.blinkPatch.appendChild(el("i"));
      this.leftGlint = el("i", "eyeGlint left");
      this.rightGlint = el("i", "eyeGlint right");
      face.append(this.blinkPatch, this.leftGlint, this.rightGlint);

      const fxLayer = el("div", "dodoFxLayer");
      this.fx = ["a", "b", "c"].map(name => {
        const dot = el("i", `fxDot ${name}`);
        fxLayer.appendChild(dot);
        return dot;
      });
      character.append(this.shadow, this.pose, face, fxLayer);
      character.addEventListener("keydown", event => {
        if (event.key === "Enter" || event.key === " ") { event.preventDefault(); this._handleClick(event); }
      });
      return character;
    }

    _syncModel() {
      this.el.dataset.state = this.model.state;
      this.el.dataset.emotion = this.model.emotion;
      this.el.dataset.action = this.model.action;
      this.main.src = ASSETS[this.model.state];
      const marks = FX[this.model.state];
      this.fx.forEach((node, index) => { node.textContent = marks[index]; });
      this._emitChange();
    }

    _emitChange() {
      if (typeof CustomEvent === "function") {
        this.el.dispatchEvent(new CustomEvent("dodochange", { bubbles: true, detail: { state: this.state, emotion: this.emotion, action: this.action } }));
      }
    }

    _setTimer(callback, delay) {
      const id = setTimeout(() => { this.actionTimers.delete(id); callback(); }, delay);
      this.actionTimers.add(id);
      return id;
    }

    _animate(target, frames, options) {
      if (this.destroyed || this.reducedMotion || !target || typeof target.animate !== "function") return Promise.resolve();
      const animation = target.animate(frames, options);
      this.animations.add(animation);
      return animation.finished.catch(() => undefined).finally(() => this.animations.delete(animation));
    }

    _cancelMotion() {
      this.animations.forEach(animation => animation.cancel());
      this.animations.clear();
      this.actionTimers.forEach(id => clearTimeout(id));
      this.actionTimers.clear();
    }

    setState(nextState, { animate = true } = {}) {
      const state = normalizeState(nextState);
      if (state === this.state) return this;
      this.actionToken += 1;
      this._cancelMotion();
      this.model.setState(state);
      this.el.dataset.state = state;
      this.el.dataset.emotion = this.model.emotion;
      this.el.dataset.action = "idle";
      const marks = FX[state];
      this.fx.forEach((node, index) => { node.textContent = marks[index]; });
      this.alt.src = ASSETS[state];
      if (animate && !this.reducedMotion) {
        this.alt.style.opacity = "0";
        this._animate(this.alt, [
          { opacity: 0, transform: "translateY(2px) scale(.985)" },
          { opacity: 1, transform: "translateY(-1px) scale(1.006)", offset: .68 },
          { opacity: 1, transform: "translateY(0) scale(1)" }
        ], { duration: 360, easing: "cubic-bezier(.18,.78,.25,1)", fill: "forwards" }).then(() => {
          if (this.destroyed || this.state !== state) return;
          this.main.src = ASSETS[state];
          this.alt.style.opacity = "0";
          this.alt.getAnimations().forEach(animation => animation.cancel());
        });
      } else {
        this.main.src = ASSETS[state];
        this.alt.style.opacity = "0";
      }
      this._homeGaze(180);
      this._emitChange();
      return this;
    }

    setEmotion(emotion) {
      this.model.setEmotion(emotion);
      this.el.dataset.emotion = this.model.emotion;
      this._emitChange();
      return this;
    }

    _setGaze(x, y, duration = 180) {
      const next = { x: Math.max(-1, Math.min(1, x)), y: Math.max(-1, Math.min(1, y)) };
      const size = parseFloat(getComputedStyle(this.el).getPropertyValue("--size")) || 220;
      const from = `translate(calc(-50% + ${this.gaze.x * size * .012}px), calc(-50% + ${this.gaze.y * size * .012}px))`;
      const to = `translate(calc(-50% + ${next.x * size * .012}px), calc(-50% + ${next.y * size * .012}px))`;
      [this.leftGlint, this.rightGlint].forEach(glint => {
        this._animate(glint, [{ transform: from }, { transform: to }], { duration, easing: "ease-out", fill: "forwards" });
      });
      this.gaze = next;
    }

    lookAt(x, y) {
      const rect = this.el.getBoundingClientRect();
      if (!rect.width || !Number.isFinite(x) || !Number.isFinite(y)) return this._setGaze(0, 0);
      this._setGaze(((x - rect.left) / rect.width - .5) * 2, ((y - rect.top) / rect.height - .5) * 2, 105);
      return this;
    }

    _lookDirection(direction) {
      const points = { left: [-1, 0], right: [1, 0], up: [0, -1], down: [0, 1], user: [0, 0] };
      const point = points[direction] || points.user;
      this._setGaze(point[0], point[1], 120);
    }

    _homeGaze(duration = 220) { this._setGaze(0, 0, duration); }

    blink(kind = "blink") {
      if (this.state === "done") return Promise.resolve();
      const half = kind === "halfBlink" || kind === "sleepy";
      const frames = half
        ? [{ opacity: 0, transform: "scaleY(.55)" }, { opacity: .72, transform: "scaleY(.65)", offset: .48 }, { opacity: 0, transform: "scaleY(.55)" }]
        : [{ opacity: 0 }, { opacity: 1, offset: .34 }, { opacity: 1, offset: .58 }, { opacity: 0 }];
      const once = () => this._animate(this.blinkPatch, frames, { duration: half ? 260 : 150, easing: "ease-in-out" });
      const first = once();
      if (kind === "doubleBlink") this._setTimer(once, 190);
      return first;
    }

    _popFx(symbols) {
      const values = symbols || FX[this.state];
      this.fx.forEach((node, index) => {
        if (values[index]) node.textContent = values[index];
        if (!node.textContent) return;
        this._animate(node, [
          { opacity: 0, transform: "translateY(8px) scale(.65)" },
          { opacity: 1, transform: `translateY(${-7 - index * 2}px) scale(1.12)`, offset: .35 },
          { opacity: 0, transform: `translateY(${-20 - index * 4}px) scale(.92)` }
        ], { duration: 620 + index * 70, easing: "cubic-bezier(.2,.8,.2,1)" });
      });
    }

    _bodyMotion(type) {
      const motions = {
        breathe: [
          [{ transform: "translateY(0) rotate(0) scale(1)" }, { transform: "translateY(-2px) rotate(.2deg) scale(1.008)", offset: .52 }, { transform: "translateY(0) rotate(0) scale(1)" }],
          { duration: 2300 + Math.random() * 1500, easing: "ease-in-out" }
        ],
        tilt: [
          [{ transform: "rotate(0)" }, { transform: `translateY(-2px) rotate(${Math.random() < .5 ? -2.4 : 2.4}deg)`, offset: .42 }, { transform: "rotate(0)" }],
          { duration: 820, easing: "cubic-bezier(.2,.8,.2,1)" }
        ],
        shift: [
          [{ transform: "translateX(0) rotate(0)" }, { transform: `translateX(${Math.random() < .5 ? -3 : 3}px) rotate(${Math.random() < .5 ? -.7 : .7}deg)`, offset: .46 }, { transform: "translateX(0) rotate(0)" }],
          { duration: 920, easing: "ease-in-out" }
        ],
        dodge: [
          [{ transform: "translateX(0) rotate(0)" }, { transform: "translateX(7px) rotate(1.8deg)", offset: .28 }, { transform: "translateX(-2px) rotate(-.6deg)", offset: .7 }, { transform: "translateX(0) rotate(0)" }],
          { duration: 720, easing: "cubic-bezier(.18,.78,.25,1)" }
        ],
        alert: [
          [{ transform: "translateY(0) rotate(0)" }, { transform: "translateY(2px) rotate(-.8deg)", offset: .16 }, { transform: "translateY(-8px) rotate(2deg) scale(1.02)", offset: .42 }, { transform: "translateY(-3px) rotate(-.8deg) scale(1.008)", offset: .7 }, { transform: "translateY(0) rotate(0) scale(1)" }],
          { duration: 830, easing: "cubic-bezier(.18,.78,.25,1)" }
        ],
        stretch: [
          [{ transform: "translateY(0) scale(1)" }, { transform: "translateY(2px) scale(.99)", offset: .18 }, { transform: "translateY(-6px) scale(1.018)", offset: .5 }, { transform: "translateY(0) scale(1)" }],
          { duration: 1050, easing: "cubic-bezier(.2,.8,.2,1)" }
        ],
        hop: [
          [{ transform: "translateY(0) scale(1)" }, { transform: "translateY(3px) scale(.985)", offset: .13 }, { transform: "translateY(-16px) scale(1.028)", offset: .39 }, { transform: "translateY(2px) scale(.994)", offset: .76 }, { transform: "translateY(-3px) scale(1.006)", offset: .88 }, { transform: "translateY(0) scale(1)" }],
          { duration: 920, easing: "cubic-bezier(.18,.78,.25,1)" }
        ],
        tinyHop: [
          [{ transform: "translateY(0)" }, { transform: "translateY(2px)", offset: .18 }, { transform: "translateY(-8px)", offset: .43 }, { transform: "translateY(0)" }],
          { duration: 680, easing: "cubic-bezier(.18,.78,.25,1)" }
        ],
        protest: [
          [{ transform: "translateX(0) rotate(0)" }, { transform: "translateX(-4px) rotate(-1.4deg)", offset: .25 }, { transform: "translateX(4px) rotate(1.4deg)", offset: .48 }, { transform: "translateX(-2px) rotate(-.6deg)", offset: .68 }, { transform: "translateX(0) rotate(0)" }],
          { duration: 720, easing: "ease-out" }
        ]
      };
      const [frames, options] = motions[type] || motions.tilt;
      const body = this._animate(this.pose, frames, options);
      if (["hop", "tinyHop", "alert"].includes(type)) {
        this._animate(this.shadow, [
          { transform: "translateX(-50%) scaleX(1)", opacity: .14 },
          { transform: "translateX(-50%) scaleX(.7)", opacity: .07, offset: .45 },
          { transform: "translateX(-50%) scaleX(1)", opacity: .14 }
        ], { duration: options.duration, easing: "ease-in-out" });
      }
      return body;
    }

    _headFollow(direction) {
      const angle = direction === "left" ? -1.4 : direction === "right" ? 1.4 : direction === "up" ? -.4 : .4;
      return this._animate(this.pose, [
        { transform: "translateY(0) rotate(0)" },
        { transform: `translateY(-1px) rotate(${angle}deg)`, offset: .55 },
        { transform: "translateY(0) rotate(0)" }
      ], { duration: 520, easing: "ease-in-out" });
    }

    _runAction(action, emotion, duration, performer) {
      this.actionToken += 1;
      const token = this.actionToken;
      this._cancelMotion();
      this.model.startAction(action, emotion);
      this.el.dataset.action = action;
      this.el.dataset.emotion = this.model.emotion;
      this._emitChange();
      performer(token);
      this._setTimer(() => { if (token === this.actionToken) this.resetToIdle(); }, duration);
      return this;
    }

    play(action, payload = {}) {
      if (this.destroyed) return this;
      const directEyes = {
        blink: () => this.blink("blink"), doubleBlink: () => this.blink("doubleBlink"), halfBlink: () => this.blink("halfBlink"),
        lookLeft: () => this._lookDirection("left"), lookRight: () => this._lookDirection("right"), lookUp: () => this._lookDirection("up"),
        lookDown: () => this._lookDirection("down"), lookAtTarget: () => this.lookAt(payload.x, payload.y), sleepy: () => this.blink("sleepy"),
        happySquint: () => this.blink("doubleBlink"), surprised: () => this.setEmotion("surprised")
      };
      if (directEyes[action]) { directEyes[action](); return this; }

      const emotionByAction = {
        tapHappy: "happy", tapCurious: "curious", tapDodge: "surprised", tapProtest: "playful",
        acknowledge: "attentive", timeCheck: "concerned", firm: "determined", notification: "attentive",
        celebrate: "happy", yawn: "sleepy", peek: "curious", happyMicro: "happy", easterEgg: "playful"
      };
      const emotion = payload.emotion || emotionByAction[action] || DEFAULT_EMOTION[this.state];
      const duration = { breathe: 3500, observeSide: 980, shiftWeight: 1050, lookUser: 900, stretch: 1250, tinyHop: 850, yawn: 1350, peek: 1100, happyMicro: 1050, easterEgg: 1400, tapHappy: 1100, tapCurious: 1050, tapDodge: 900, tapProtest: 1050, acknowledge: 1050, timeCheck: 1200, firm: 1150, notification: 1300, celebrate: 1500 }[action] || 950;

      return this._runAction(action, emotion, duration, () => {
        if (payload.tapPoint) {
          const { x, y } = payload.tapPoint;
          const rect = this.el.getBoundingClientRect();
          this.lookAt(x, y);
          this._setTimer(() => this._headFollow(x < rect.left + rect.width / 2 ? "left" : "right"), 100);
          this._setTimer(() => {
            if (action === "tapHappy" || action === "celebrate") {
              this.blink("doubleBlink");
              this._popFx(action === "celebrate" ? ["✦", "★", "✦"] : ["", "♡", ""]);
              this._bodyMotion(action === "celebrate" ? "hop" : "tinyHop");
            } else if (action === "tapDodge") {
              this.blink("blink");
              this._bodyMotion("dodge");
            } else if (action === "tapProtest") {
              this.blink("doubleBlink");
              this._popFx(["", "…", ""]);
              this._bodyMotion("protest");
            } else if (action === "timeCheck" || action === "firm") {
              this._bodyMotion("alert");
            } else {
              this.blink("blink");
              this._bodyMotion("tilt");
            }
          }, 190);
          return;
        }
        if (action === "breathe") this._bodyMotion("breathe");
        else if (action === "observeSide") {
          const side = Math.random() < .5 ? "left" : "right";
          this._lookDirection(side);
          this._setTimer(() => this._headFollow(side), 90);
          this._setTimer(() => this._homeGaze(), 720);
        } else if (action === "shiftWeight") this._bodyMotion("shift");
        else if (action === "lookUser") { this._lookDirection("user"); this._setTimer(() => this.blink("blink"), 150); this._bodyMotion("tilt"); }
        else if (action === "stretch") { this.blink("halfBlink"); this._bodyMotion("stretch"); }
        else if (action === "tinyHop") this._bodyMotion("tinyHop");
        else if (action === "yawn") { this.blink("sleepy"); this._setTimer(() => this._bodyMotion("stretch"), 100); }
        else if (action === "peek") { this._lookDirection(Math.random() < .5 ? "left" : "right"); this._setTimer(() => this._bodyMotion("dodge"), 110); }
        else if (action === "happyMicro") { this.blink("doubleBlink"); this._bodyMotion("tilt"); }
        else if (action === "easterEgg") { this.blink("doubleBlink"); this._popFx(["✦", "♡", "✦"]); this._setTimer(() => this._bodyMotion("tinyHop"), 90); }
        else if (action === "tapHappy") { this.blink("doubleBlink"); this._popFx(["", "♡", ""]); this._setTimer(() => this._bodyMotion("tinyHop"), 90); }
        else if (action === "tapCurious") { this._bodyMotion("tilt"); this._setTimer(() => this.blink("blink"), 130); }
        else if (action === "tapDodge") { this.blink("blink"); this._setTimer(() => this._bodyMotion("dodge"), 80); }
        else if (action === "tapProtest") { this.blink("doubleBlink"); this._popFx(["", "…", ""]); this._setTimer(() => this._bodyMotion("protest"), 80); }
        else if (action === "acknowledge") { this.blink("blink"); this._setTimer(() => this._bodyMotion("tilt"), 95); }
        else if (action === "timeCheck") { this._lookDirection("down"); this._setTimer(() => this._headFollow("down"), 95); this._setTimer(() => this._bodyMotion("alert"), 190); }
        else if (action === "firm") { this._lookDirection("user"); this._setTimer(() => this._headFollow("up"), 90); this._setTimer(() => this._bodyMotion("alert"), 185); }
        else if (action === "notification") {
          this._lookDirection("up");
          this._setTimer(() => this._headFollow("up"), 100);
          this._setTimer(() => { this._bodyMotion("alert"); this._popFx(["!", "✦", ""]); }, 195);
        } else if (action === "celebrate") {
          this._lookDirection("user");
          this._setTimer(() => { this._popFx(["✦", "★", "✦"]); this._bodyMotion("hop"); }, 120);
        } else this._bodyMotion("tilt");
      });
    }

    _handleClick(event) {
      if (!this.interactive) return;
      const rect = this.el.getBoundingClientRect();
      const x = Number.isFinite(event.clientX) && event.clientX ? event.clientX : rect.left + rect.width / 2;
      const y = Number.isFinite(event.clientY) && event.clientY ? event.clientY : rect.top + rect.height / 2;
      const reaction = this.model.reactionForTap(Date.now());
      this.play(reaction.action, { emotion: reaction.emotion, tapPoint: { x, y } });
    }

    resetToIdle() {
      if (this.destroyed) return this;
      this.actionToken += 1;
      this._cancelMotion();
      this.model.resetToIdle();
      this.el.dataset.action = "idle";
      this.el.dataset.emotion = this.model.emotion;
      this._homeGaze(230);
      this._animate(this.pose, [{ transform: getComputedStyle(this.pose).transform }, { transform: "translateY(0) rotate(0) scale(1)" }], { duration: 260, easing: "ease-out", fill: "forwards" });
      this._emitChange();
      if (this.idleEnabled && !this.idleTimer) this._scheduleIdle();
      return this;
    }

    _idleActionForState(action) {
      if (this.state === "danger" && ["tinyHop", "yawn", "happyMicro", "easterEgg"].includes(action)) return "firm";
      if (this.state === "urgent" && ["yawn", "easterEgg"].includes(action)) return "timeCheck";
      if (this.state === "done" && ["yawn", "peek"].includes(action)) return "happyMicro";
      if (this.state === "notice" && action === "yawn") return "acknowledge";
      return action;
    }

    _scheduleIdle(initial = false) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
      if (!this.idleEnabled || this.destroyed || (typeof document !== "undefined" && document.hidden)) return;
      const delay = initial ? 1200 + Math.random() * 2600 : 2600 + Math.random() * 5200;
      this.idleTimer = setTimeout(() => {
        this.idleTimer = null;
        if (this.destroyed || !this.el.isConnected || (typeof document !== "undefined" && document.hidden)) return;
        if (this.action === "idle") {
          const selected = chooseIdleAction(Math.random(), this.lastIdleAction);
          this.lastIdleAction = selected;
          this.play(this._idleActionForState(selected));
        }
        this._scheduleIdle();
      }, delay);
    }

    pause() {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
      this._cancelMotion();
      this.actionToken += 1;
      this.model.resetToIdle();
      this.el.dataset.action = "idle";
      this.el.dataset.emotion = this.model.emotion;
      this.gaze = { x: 0, y: 0 };
      this._emitChange();
    }

    resume() {
      if (!this.destroyed && this.idleEnabled) this._scheduleIdle(true);
    }

    destroy() {
      if (this.destroyed) return;
      this.destroyed = true;
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
      this._cancelMotion();
      this.el.removeEventListener("click", this._onClick);
      registry.delete(this);
      if (this.mount && this.mount._dodoCharacter === this) delete this.mount._dodoCharacter;
    }
  }

  function DodoCharacter(options) { return new CharacterAnimationEngine(options); }
  DodoCharacter.STATES = STATES;
  DodoCharacter.EMOTIONS = EMOTIONS;
  DodoCharacter.ASSETS = ASSETS;
  DodoCharacter.mount = options => new CharacterAnimationEngine(options);
  DodoCharacter.from = mount => mount && mount._dodoCharacter || null;
  DodoCharacter.destroy = mount => { if (mount && mount._dodoCharacter) mount._dodoCharacter.destroy(); };

  if (typeof document !== "undefined") {
    document.addEventListener("visibilitychange", () => {
      registry.forEach(character => document.hidden ? character.pause() : character.resume());
    });
  }

  return { STATES, EMOTIONS, ASSETS, DEFAULT_EMOTION, CharacterStateModel, chooseIdleAction, CharacterAnimationEngine, DodoCharacter };
});
