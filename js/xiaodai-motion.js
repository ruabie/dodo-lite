(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.XiaodaiMotion = api;
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";
  const clamp = (n, a = 0, b = 1) => Math.max(a, Math.min(b, n));
  const ease = {
    linear: t => t,
    out: t => 1 - Math.pow(1 - t, 3),
    in: t => t * t * t,
    inOut: t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,
    back: t => 1 + 2.3 * Math.pow(t - 1, 3) + 1.3 * Math.pow(t - 1, 2),
    spring: t => 1 - Math.exp(-7 * t) * Math.cos(12 * t)
  };
  // Timings are in milliseconds; all poses are independent SVG rig channels.
  const ACTIONS = Object.freeze({
    notice: {
      duration: 820, emotion: "surprised", priority: 2,
      tracks: {
        gazeX: [[0, null], [.11, -1.5, "out"], [.72, 0, "inOut"], [1, 0]],
        y: [[0, null], [.19, 2, "in"], [.43, -5, "out"], [.69, -2, "spring"], [1, 0, "out"]],
        bodyX: [[0, null], [.20, 1.035, "in"], [.44, .965, "out"], [.72, 1.012, "spring"], [1, 1]],
        bodyY: [[0, null], [.20, .97, "in"], [.44, 1.035, "out"], [.72, .99, "spring"], [1, 1]],
        rightArm: [[0, null], [.23, -5, "out"], [.52, -40, "back"], [.78, -32, "spring"], [1, -28]],
        leftArm: [[0, null], [.30, 3, "out"], [.65, -7, "out"], [1, 0]],
        note: [[0, null], [.32, -5, "out"], [.58, 9, "back"], [.83, -3, "spring"], [1, 0]],
        shadow: [[0, null], [.43, .87, "out"], [1, 1, "inOut"]]
      }
    },
    tapReact: {
      duration: 970, emotion: "happy", priority: 3,
      tracks: {
        gazeX: [[0, null], [.08, 1.8, "out"], [.40, 1.2], [.86, 0, "inOut"], [1, 0]],
        y: [[0, null], [.18, 3, "in"], [.42, -11, "out"], [.65, 2, "in"], [.79, -3, "spring"], [1, 0]],
        x: [[0, null], [.16, -2, "out"], [.42, 4, "back"], [.78, -1, "spring"], [1, 0]],
        bodyX: [[0, null], [.18, 1.055, "in"], [.42, .953, "out"], [.67, 1.04, "in"], [.82, .986, "spring"], [1, 1]],
        bodyY: [[0, null], [.18, .948, "in"], [.42, 1.048, "out"], [.67, .962, "in"], [.82, 1.015, "spring"], [1, 1]],
        leftArm: [[0, null], [.21, -12, "in"], [.49, 43, "back"], [.78, 12, "spring"], [1, 0]],
        rightArm: [[0, null], [.21, 12, "in"], [.49, -43, "back"], [.78, -12, "spring"], [1, 0]],
        leftFootY: [[0, null], [.39, -3, "out"], [.66, 0, "in"], [1, 0]],
        rightFootY: [[0, null], [.39, -3, "out"], [.66, 0, "in"], [1, 0]],
        note: [[0, null], [.29, -6, "in"], [.55, 14, "back"], [.76, -7, "spring"], [1, 0]],
        shadow: [[0, null], [.42, .75, "out"], [1, 1, "inOut"]]
      }
    },
    returnToIdle: {
      duration: 480, priority: 1,
      tracks: Object.fromEntries(["x", "y", "bodyX", "bodyY", "faceX", "faceY", "leftArm", "rightArm", "leftFootX", "leftFootY", "rightFootX", "rightFootY", "note", "gazeX", "gazeY", "shadow"].map(key => [key, [[0, null], [1, ["bodyX", "bodyY", "shadow"].includes(key) ? 1 : 0, key === "note" ? "spring" : "inOut"]]]))
    },
    hop: {
      duration: 900, emotion: "surprised", priority: 2,
      tracks: {
        y: [[0, null], [.18, 3, "in"], [.46, -18, "out"], [.70, 2, "in"], [.84, -4, "spring"], [1, 0]],
        bodyX: [[0, null], [.18, 1.06, "in"], [.46, .95, "out"], [.70, 1.035, "in"], [1, 1]],
        bodyY: [[0, null], [.18, .95, "in"], [.46, 1.06, "out"], [.70, .97, "in"], [1, 1]],
        leftArm: [[0, null], [.48, 42, "back"], [1, 0, "spring"]],
        rightArm: [[0, null], [.48, -42, "back"], [1, 0, "spring"]],
        note: [[0, null], [.56, 12, "back"], [.80, -5, "spring"], [1, 0]],
        shadow: [[0, null], [.46, .66, "out"], [1, 1, "inOut"]]
      }
    },
    celebrate: {
      duration: 1200, emotion: "happy", priority: 4,
      tracks: {
        y: [[0, null], [.15, 4, "in"], [.40, -21, "out"], [.65, -6, "in"], [.78, -14, "spring"], [1, 0]],
        bodyX: [[0, null], [.16, 1.07, "in"], [.42, .95, "out"], [.72, 1.02, "spring"], [1, 1]],
        bodyY: [[0, null], [.16, .94, "in"], [.42, 1.06, "out"], [.72, .98, "spring"], [1, 1]],
        leftArm: [[0, null], [.18, -9, "in"], [.44, 62, "back"], [.78, 48, "spring"], [1, 0]],
        rightArm: [[0, null], [.18, 9, "in"], [.44, -62, "back"], [.78, -48, "spring"], [1, 0]],
        leftFootY: [[0, null], [.43, -6, "out"], [1, 0]], rightFootY: [[0, null], [.43, -6, "out"], [1, 0]],
        note: [[0, null], [.28, -5, "in"], [.53, 16, "back"], [.76, -8, "spring"], [1, 0]],
        shadow: [[0, null], [.42, .64, "out"], [1, 1, "inOut"]]
      }
    },
    peek: { duration: 920, emotion: "curious", priority: 2, tracks: {
      gazeX: [[0, null], [.11, -2.5, "out"], [.80, -2.5], [1, 0, "inOut"]],
      x: [[0, null], [.18, -2, "in"], [.48, -8, "back"], [.75, -5, "out"], [1, 0, "inOut"]],
      bodyX: [[0, null], [.48, 1.035, "out"], [1, 1]], bodyY: [[0, null], [.48, .968, "out"], [1, 1]],
      note: [[0, null], [.57, -7, "out"], [1, 0, "spring"]]
    } },
    encourage: { duration: 1000, emotion: "happy", priority: 2, tracks: {
      y: [[0, null], [.19, 2, "in"], [.50, -6, "out"], [1, 0, "spring"]],
      leftArm: [[0, null], [.20, -8, "in"], [.51, 38, "back"], [1, 0, "spring"]],
      rightArm: [[0, null], [.20, 8, "in"], [.51, -38, "back"], [1, 0, "spring"]],
      note: [[0, null], [.61, 7, "out"], [1, 0, "spring"]]
    } },
    remind: { duration: 1100, emotion: "confused", priority: 2, tracks: {
      gazeY: [[0, null], [.11, -2, "out"], [.67, -2], [1, 0]],
      y: [[0, null], [.22, 2, "in"], [.52, -5, "out"], [1, 0, "spring"]],
      rightArm: [[0, null], [.22, 5, "in"], [.55, -30, "back"], [.80, -24], [1, 0, "spring"]],
      note: [[0, null], [.62, 8, "out"], [1, 0, "spring"]]
    } },
    yawn: { duration: 1450, emotion: "yawning", priority: 1, tracks: {
      y: [[0, null], [.30, 3, "inOut"], [.70, -3, "out"], [1, 0]],
      bodyX: [[0, null], [.48, .975, "inOut"], [1, 1]], bodyY: [[0, null], [.48, 1.025, "inOut"], [1, 1]],
      leftArm: [[0, null], [.52, 32, "out"], [1, 0, "inOut"]], rightArm: [[0, null], [.52, -32, "out"], [1, 0, "inOut"]],
      note: [[0, null], [.65, 6, "out"], [1, 0, "spring"]]
    } },
    shiftWeight: { duration: 1050, priority: 0, tracks: {
      x: [[0, null], [.45, 3, "inOut"], [1, 0, "inOut"]],
      leftFootX: [[0, null], [.45, -1, "inOut"], [1, 0]],
      rightFootX: [[0, null], [.45, 1, "inOut"], [1, 0]],
      note: [[0, null], [.58, -2, "out"], [1, 0]]
    } },
    stretch: { duration: 1050, priority: 0, tracks: {
      y: [[0, null], [.23, 2, "in"], [.53, -5, "out"], [1, 0]],
      bodyX: [[0, null], [.53, .97, "out"], [1, 1]], bodyY: [[0, null], [.53, 1.031, "out"], [1, 1]],
      leftArm: [[0, null], [.53, 42, "out"], [1, 0]], rightArm: [[0, null], [.53, -42, "out"], [1, 0]],
      note: [[0, null], [.66, 5, "out"], [1, 0, "spring"]]
    } }
  });

  function sampleTrack(track, t, from, elasticity = 1) {
    const nodes = track.map((node, index) => ({ at: node[0], value: index === 0 && node[1] == null ? from : node[1], easing: node[2] || "inOut" }));
    if (t <= 0) return nodes[0].value;
    for (let i = 1; i < nodes.length; i += 1) {
      const a = nodes[i - 1], b = nodes[i];
      if (t <= b.at || i === nodes.length - 1) {
        const local = clamp((t - a.at) / (b.at - a.at));
        const curve = ease[b.easing] || ease.inOut;
        const curved = curve(local);
        const eased = b.easing === "spring" || b.easing === "back" ? ease.out(local) + (curved - ease.out(local)) * elasticity : curved;
        return a.value + (b.value - a.value) * eased;
      }
    }
    return nodes.at(-1).value;
  }

  return { ACTIONS, ease, sampleTrack };
});
