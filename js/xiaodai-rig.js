(function (root, factory) {
  const api = factory(root.XiaodaiArt || (typeof require === "function" ? require("./xiaodai-art.js") : null));
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.XiaodaiRig = api.XiaodaiRig;
})(typeof window !== "undefined" ? window : globalThis, function (art) {
  "use strict";
  if (!art) throw new Error("XiaodaiArt must load before XiaodaiRig");

  const CHANNEL_DEFAULTS = Object.freeze({
    x: 0, y: 0, bodyX: 1, bodyY: 1, faceX: 0, faceY: 0,
    leftArm: 0, rightArm: 0, leftFootX: 0, leftFootY: 0,
    rightFootX: 0, rightFootY: 0, note: 0, gazeX: 0, gazeY: 0,
    blink: 0, shadow: 1
  });
  const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

  class XiaodaiRig {
    constructor(host, { state = "calm", emotion = "neutral", debugAnchors = false } = {}) {
      if (!host || typeof host.replaceChildren !== "function") throw new Error("XiaodaiRig needs a host element");
      this.host = host;
      this.state = state;
      this.emotion = emotion;
      this.debugAnchors = debugAnchors;
      this.destroyed = false;
      this.values = { ...CHANNEL_DEFAULTS, ...(art.EMOTION_POSTURES[emotion] || {}) };
      this._render();
    }

    _render() {
      this.host.innerHTML = art.svgMarkup({ state: this.state, emotion: this.emotion, debugAnchors: this.debugAnchors });
      this.svg = this.host.querySelector("svg");
      const part = name => this.svg.querySelector(`[data-part="${name}"]`);
      this.parts = {
        root: part("root"), body: part("body"), face: part("face"),
        leftArm: part("left-arm"), rightArm: part("right-arm"),
        leftFoot: part("left-foot"), rightFoot: part("right-foot"),
        leftEye: part("left-eye"), rightEye: part("right-eye"),
        leftPupil: part("left-pupil"), rightPupil: part("right-pupil"),
        leftEyelid: part("left-eyelid"), rightEyelid: part("right-eyelid"),
        note: part("note"), shadow: part("ground-shadow")
      };
      this.apply(this.values);
    }

    setState(state) {
      if (this.state === state) return;
      this.state = state;
      const fresh = document.createElement("div");
      fresh.innerHTML = art.svgMarkup({ state, emotion: this.emotion });
      const glyph = fresh.querySelector(".xd-note-glyph");
      const oldGlyph = this.parts.note.querySelector(".xd-note-glyph");
      if (glyph && oldGlyph) oldGlyph.replaceWith(glyph);
    }

    setEmotion(emotion, { instant = false } = {}) {
      if (this.destroyed) return;
      if (this.emotion === emotion) return;
      this.emotion = emotion;
      const fresh = document.createElement("div");
      fresh.innerHTML = art.svgMarkup({ state: this.state, emotion });
      const face = fresh.querySelector('[data-part="face"]');
      if (!face) return;
      const replace = () => {
        this.parts.face.replaceChildren(...Array.from(face.childNodes));
        this.parts.leftPupil = this.svg.querySelector('[data-part="left-pupil"]');
        this.parts.rightPupil = this.svg.querySelector('[data-part="right-pupil"]');
        this.parts.leftEye = this.svg.querySelector('[data-part="left-eye"]');
        this.parts.rightEye = this.svg.querySelector('[data-part="right-eye"]');
        this.parts.leftEyelid = this.svg.querySelector('[data-part="left-eyelid"]');
        this.parts.rightEyelid = this.svg.querySelector('[data-part="right-eyelid"]');
        this.svg.dataset.emotion = emotion;
        this.apply(this.values);
      };
      if (instant || typeof this.parts.face.animate !== "function") { replace(); return; }
      const oldFace = this.parts.face;
      const out = oldFace.animate([{ opacity: 1 }, { opacity: .1 }], { duration: 78, easing: "ease-in" });
      out.finished.catch(() => undefined).then(() => {
        if (this.destroyed || this.parts.face !== oldFace || this.emotion !== emotion) return;
        replace();
        oldFace.animate([{ opacity: .1 }, { opacity: 1 }], { duration: 120, easing: "ease-out" });
      });
    }

    apply(values) {
      Object.assign(this.values, values);
      const v = this.values;
      const p = this.parts;
      if (!p) return;
      const x = finite(v.x), y = finite(v.y);
      const sx = clamp(finite(v.bodyX, 1), .88, 1.12), sy = clamp(finite(v.bodyY, 1), .88, 1.12);
      p.root.setAttribute("transform", `translate(${x.toFixed(2)} ${y.toFixed(2)})`);
      p.body.setAttribute("transform", `translate(128 162) scale(${sx.toFixed(4)} ${sy.toFixed(4)}) translate(-128 -162)`);
      // The face follows the shell's local displacement, but the eyes keep their own proportions.
      p.face.setAttribute("transform", `translate(${finite(v.faceX).toFixed(2)} ${(finite(v.faceY) + (154 - 162) * (sy - 1)).toFixed(2)})`);
      for (const side of ["left", "right"]) {
        const left = side === "left";
        const shoulderX = left ? 62 : 194;
        const dx = (shoulderX - 128) * (sx - 1);
        const dy = (164 - 162) * (sy - 1);
        const angle = finite(v[left ? "leftArm" : "rightArm"]);
        p[`${side}Arm`].setAttribute("transform", `translate(${dx.toFixed(2)} ${dy.toFixed(2)}) rotate(${angle.toFixed(2)} ${shoulderX} 164)`);
        const fx = left ? 91 : 165;
        const footX = finite(v[left ? "leftFootX" : "rightFootX"]);
        const footY = finite(v[left ? "leftFootY" : "rightFootY"]);
        p[`${side}Foot`].setAttribute("transform", `translate(${footX.toFixed(2)} ${footY.toFixed(2)}) rotate(${(footX * .5).toFixed(2)} ${fx} 225)`);
        const pupil = p[`${side}Pupil`];
        if (pupil) pupil.setAttribute("transform", `translate(${clamp(finite(v.gazeX), -3, 3).toFixed(2)} ${clamp(finite(v.gazeY), -2.5, 2.5).toFixed(2)})`);
        const lid = p[`${side}Eyelid`];
        if (lid) lid.style.opacity = clamp(finite(v.blink), 0, 1).toFixed(3);
        const eye = p[`${side}Eye`];
        if (eye && v.blink > 0) {
          const ex = left ? 105 : 151;
          eye.setAttribute("transform", `translate(${ex} 150) scale(1 ${Math.max(.06, 1 - v.blink * .94).toFixed(3)}) translate(${-ex} -150)`);
        } else if (eye) eye.removeAttribute("transform");
      }
      p.note.setAttribute("transform", `translate(0 ${((97 - 162) * (sy - 1)).toFixed(2)}) rotate(${finite(v.note).toFixed(2)} 128 97)`);
      p.shadow.setAttribute("transform", `translate(128 241) scale(${clamp(finite(v.shadow, 1), .55, 1.18).toFixed(3)} 1) translate(-128 -241)`);
    }

    setDebugAnchors(enabled) {
      if (this.debugAnchors === Boolean(enabled)) return;
      this.debugAnchors = Boolean(enabled);
      this._render();
    }
    destroy() {
      this.destroyed = true;
      if (this.parts.face && typeof this.parts.face.getAnimations === "function") this.parts.face.getAnimations().forEach(animation => animation.cancel());
    }
  }
  return { CHANNEL_DEFAULTS, XiaodaiRig };
});
