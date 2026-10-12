(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.XiaodaiPerformanceV2 = api;
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";

  // Every pose has the same ten perimeter landmarks. The cubic handles are
  // derived from neighbouring landmarks, so a scrub never changes topology.
  const NAMES = Object.freeze([
    "idle",
    "notice",
    "anticipation",
    "reaction",
    "settle",
  ]);
  const LABELS = Object.freeze({
    idle: "A · 自然站立",
    notice: "B · 注意到触碰",
    anticipation: "C · 收身预备",
    reaction: "D · 开心回应",
    settle: "E · 惯性收尾",
  });
  const pose = (body, left, right, face, note, feet, shadow) => ({
    body,
    arms: { left, right },
    face,
    note,
    feet,
    shadow,
  });
  const face = (
    x,
    y,
    openL,
    openR,
    lidL,
    lidR,
    pupilL,
    pupilR,
    browL,
    browR,
    width,
    mouthOpen,
    smile,
    skew,
    cheek,
  ) => ({
    x,
    y,
    openL,
    openR,
    lidL,
    lidR,
    pupilL,
    pupilR,
    browL,
    browR,
    width,
    mouthOpen,
    smile,
    skew,
    cheek,
  });
  const arm = (shoulder, elbow, hand, widths) => ({
    shoulder,
    elbow,
    hand,
    widths,
  });
  // Perimeter order: crown, upper right, right shoulder, right side, lower
  // right, belly, lower left, left side, left shoulder, upper left.
  const POSES = Object.freeze({
    idle: pose(
      [
        [128, 91],
        [174, 94],
        [208, 142],
        [211, 183],
        [184, 216],
        [128, 227],
        [72, 216],
        [45, 183],
        [48, 142],
        [82, 94],
      ],
      arm([59, 160], [40, 165], [30, 184], [8, 15, 18]),
      arm([197, 160], [216, 165], [226, 184], [8, 15, 18]),
      face(
        128,
        157,
        1,
        0.96,
        0.04,
        0.07,
        [-0.5, 0],
        [0.5, 0],
        -0.08,
        0.08,
        11,
        1.1,
        0.28,
        0,
        0.42,
      ),
      [128, 70, 0],
      [
        [91, 224, 20, 12],
        [165, 224, 20, 12],
      ],
      [63, 0.5],
    ),
    notice: pose(
      [
        [124, 90],
        [169, 94],
        [203, 140],
        [207, 184],
        [180, 216],
        [125, 228],
        [69, 216],
        [42, 184],
        [44, 142],
        [78, 94],
      ],
      arm([55, 160], [36, 165], [29, 182], [8, 15, 18]),
      arm([193, 158], [215, 153], [222, 143], [8, 15, 18]),
      face(
        125,
        156,
        1.28,
        1.22,
        0,
        0,
        [-3, -0.4],
        [-3, -0.4],
        -0.33,
        0.16,
        5.5,
        9,
        -0.04,
        -0.5,
        0.48,
      ),
      [131, 70, 5],
      [
        [89, 224, 20, 12],
        [162, 224, 20, 12],
      ],
      [62, 0.49],
    ),
    anticipation: pose(
      [
        [128, 105],
        [171, 107],
        [207, 150],
        [220, 189],
        [188, 220],
        [128, 231],
        [68, 220],
        [36, 189],
        [49, 150],
        [85, 107],
      ],
      arm([58, 170], [53, 184], [83, 193], [8, 15, 17]),
      arm([198, 170], [203, 184], [173, 193], [8, 15, 17]),
      face(
        128,
        165,
        0.73,
        0.78,
        0.24,
        0.19,
        [-2, 1],
        [-2, 1],
        0.18,
        -0.15,
        8.5,
        1.4,
        0.06,
        -0.3,
        0.44,
      ),
      [127, 81, -6],
      [
        [88, 227, 23, 11],
        [168, 227, 23, 11],
      ],
      [68, 0.58],
    ),
    reaction: pose(
      [
        [130, 78],
        [174, 80],
        [205, 131],
        [205, 175],
        [183, 208],
        [130, 217],
        [77, 208],
        [52, 177],
        [54, 134],
        [84, 82],
      ],
      arm([61, 150], [32, 132], [33, 103], [8, 15, 18]),
      arm([198, 148], [224, 126], [223, 99], [8, 15, 18]),
      face(
        130,
        146,
        0.98,
        1.04,
        0.08,
        0.04,
        [-0.2, -0.4],
        [0.5, -0.2],
        -0.18,
        0.19,
        14,
        10,
        1,
        0.4,
        0.78,
      ),
      [125, 57, 11],
      [
        [95, 217, 19, 11],
        [168, 216, 19, 11],
      ],
      [48, 0.35],
    ),
    settle: pose(
      [
        [131, 89],
        [179, 91],
        [210, 140],
        [214, 184],
        [187, 216],
        [129, 228],
        [72, 218],
        [47, 185],
        [50, 140],
        [85, 94],
      ],
      arm([60, 160], [38, 150], [31, 164], [8, 15, 18]),
      arm([199, 156], [220, 145], [227, 158], [8, 15, 18]),
      face(
        129,
        155,
        0.86,
        0.94,
        0.16,
        0.09,
        [0.4, 0],
        [1, 0],
        -0.11,
        0.15,
        12.5,
        5.5,
        0.78,
        0.3,
        0.66,
      ),
      [130, 67, -8],
      [
        [91, 225, 20, 12],
        [167, 223, 20, 12],
      ],
      [62, 0.49],
    ),
  });

  const clamp = (n, a = 0, b = 1) => Math.max(a, Math.min(b, n));
  const fmt = (n) => Number(n.toFixed(2));
  function blend(a, b, t) {
    if (typeof a === "number") return a + (b - a) * t;
    if (Array.isArray(a))
      return a.map((value, index) => blend(value, b[index], t));
    return Object.fromEntries(
      Object.keys(a).map((key) => [key, blend(a[key], b[key], t)]),
    );
  }
  function bodyPath(points) {
    const commands = [`M${fmt(points[0][0])} ${fmt(points[0][1])}`];
    for (let i = 0; i < points.length; i += 1) {
      const previous = points[(i - 1 + points.length) % points.length];
      const current = points[i];
      const next = points[(i + 1) % points.length];
      const after = points[(i + 2) % points.length];
      // Catmull-Rom to cubic: each landmark independently alters its local arc.
      const c1 = [
        current[0] + (next[0] - previous[0]) / 6,
        current[1] + (next[1] - previous[1]) / 6,
      ];
      const c2 = [
        next[0] - (after[0] - current[0]) / 6,
        next[1] - (after[1] - current[1]) / 6,
      ];
      commands.push(
        `C${fmt(c1[0])} ${fmt(c1[1])} ${fmt(c2[0])} ${fmt(c2[1])} ${fmt(next[0])} ${fmt(next[1])}`,
      );
    }
    return `${commands.join(" ")} Z`;
  }
  function normal(from, to) {
    const dx = to[0] - from[0],
      dy = to[1] - from[1];
    const length = Math.hypot(dx, dy) || 1;
    return [-dy / length, dx / length];
  }
  function armPath({ shoulder: s, elbow: e, hand: h, widths: w }) {
    const n1 = normal(s, e),
      n2 = normal(e, h);
    const mix = [n1[0] + n2[0], n1[1] + n2[1]];
    const size = Math.hypot(...mix) || 1;
    const ne = [mix[0] / size, mix[1] / size];
    const at = (point, vector, amount) => [
      point[0] + vector[0] * amount,
      point[1] + vector[1] * amount,
    ];
    const side = (sign) => [
      at(s, n1, w[0] * sign),
      at(e, ne, w[1] * sign),
      at(h, n2, w[2] * sign),
    ];
    const upper = side(1),
      lower = side(-1);
    const forward = [h[0] - e[0], h[1] - e[1]];
    const length = Math.hypot(...forward) || 1;
    const tip = [forward[0] / length, forward[1] / length];
    return bodyPath([
      upper[0],
      upper[1],
      upper[2],
      at(h, tip, w[2] * 0.95),
      lower[2],
      lower[1],
      lower[0],
      at(s, tip, -7),
    ]);
  }
  function eyePath(x, y, openness) {
    const h = Math.max(1.2, 11 * openness);
    return `M${fmt(x - 11)} ${fmt(y)} C${fmt(x - 8)} ${fmt(y - h)} ${fmt(x + 8)} ${fmt(y - h)} ${fmt(x + 11)} ${fmt(y)} C${fmt(x + 8)} ${fmt(y + h)} ${fmt(x - 8)} ${fmt(y + h)} ${fmt(x - 11)} ${fmt(y)} Z`;
  }
  function lidPath(x, y, openness, cover) {
    const top = y - 10 * openness;
    const bottom = top + clamp(cover) * 13 * openness;
    return `M${fmt(x - 12)} ${fmt(top - 5)} Q${fmt(x)} ${fmt(top - 9)} ${fmt(x + 12)} ${fmt(top - 5)} L${fmt(x + 12)} ${fmt(bottom)} Q${fmt(x)} ${fmt(bottom - 3)} ${fmt(x - 12)} ${fmt(bottom)} Z`;
  }
  function browPath(x, y, tilt) {
    return `M${fmt(x - 9)} ${fmt(y - 21 + tilt * 5)} Q${fmt(x)} ${fmt(y - 26 - Math.abs(tilt) * 2)} ${fmt(x + 9)} ${fmt(y - 21 - tilt * 5)}`;
  }
  function mouthPath({ x, y, width, mouthOpen, smile, skew }) {
    const cy = y + 20;
    const leftY = cy - smile * 4 - skew;
    const rightY = cy - smile * 4 + skew;
    const upper = cy + smile * 2 - mouthOpen * 0.18;
    const lower = cy + smile * 4 + mouthOpen;
    return `M${fmt(x - width)} ${fmt(leftY)} C${fmt(x - width * 0.5)} ${fmt(upper)} ${fmt(x + width * 0.5)} ${fmt(upper)} ${fmt(x + width)} ${fmt(rightY)} C${fmt(x + width * 0.55)} ${fmt(lower)} ${fmt(x - width * 0.55)} ${fmt(lower)} ${fmt(x - width)} ${fmt(leftY)} Z`;
  }
  // Adjustable phase lengths in milliseconds. Timing curves are intentionally
  // independent per region; none of V1's tapReact keyframes are reused.
  const DEFAULT_TIMING = Object.freeze({
    notice: 210,
    anticipation: 220,
    reaction: 250,
    settle: 520,
  });
  const curves = {
    soft: (t) => t * t * (3 - 2 * t),
    snap: (t) => 1 - Math.pow(1 - t, 3),
    gather: (t) => Math.pow(t, 2.2),
    coast: (t) => 1 - Math.pow(1 - t, 2),
    overshoot: (t) => t + Math.sin(Math.PI * t) * 0.085,
  };
  function timeline(timing = DEFAULT_TIMING) {
    const stages = NAMES.slice(1);
    const lengths = stages.map((name) =>
      clamp(Number(timing[name]) || DEFAULT_TIMING[name], 80, 1200),
    );
    const total = lengths.reduce((a, b) => a + b, 0);
    let cursor = 0;
    const marks = { idle: 0 };
    stages.forEach((name, index) => {
      cursor += lengths[index];
      marks[name] = cursor / total;
    });
    // E is a held/rebounding pose inside the final phase; the remaining time
    // belongs to the asynchronous arm, note and face settle back to idle.
    marks.settle = (total - lengths.at(-1) * 0.35) / total;
    return { total, marks };
  }
  function sampleKeys(keys, t) {
    if (t <= keys[0][0]) return keys[0][1];
    for (let i = 1; i < keys.length; i += 1) {
      const [end, target, curve = "soft"] = keys[i];
      if (t <= end || i === keys.length - 1) {
        const [start, source] = keys[i - 1];
        return blend(
          source,
          target,
          (curves[curve] || curves.soft)(
            clamp((t - start) / Math.max(0.0001, end - start)),
          ),
        );
      }
    }
    return keys.at(-1)[1];
  }
  function sample(time, timing = DEFAULT_TIMING) {
    const t = clamp(time);
    const { marks: m } = timeline(timing);
    const i = POSES.idle,
      n = POSES.notice,
      a = POSES.anticipation,
      r = POSES.reaction,
      s = POSES.settle;
    const end = blend(i, s, 0.1); // a residual smile and weight shift, not an abrupt reset
    const parts = ["body", "arms", "face", "note", "feet", "shadow"];
    const delays = {
      body: [1, 0.98, 1, 0.91],
      arms: [1.15, 1, 1.12, 1.05],
      face: [0.46, 0.85, 0.9, 0.85],
      note: [1.35, 1.22, 1.3, 1.1],
      feet: [1, 0.98, 1.05, 1],
      shadow: [1, 1, 0.97, 1],
    };
    return Object.fromEntries(
      parts.map((part) => {
        const [first, second, third, fourth] = delays[part];
        const keys = [
          [0, i[part]],
          [m.notice * first, n[part], part === "face" ? "snap" : "soft"],
          [m.notice + (m.anticipation - m.notice) * second, a[part], "gather"],
          [
            m.anticipation + (m.reaction - m.anticipation) * third,
            r[part],
            part === "body" ? "overshoot" : "snap",
          ],
          [
            m.reaction + (m.settle - m.reaction) * fourth,
            s[part],
            part === "note" ? "overshoot" : "coast",
          ],
          [1, end[part], "soft"],
        ];
        // A delayed note or arm key may run past the next stage; keep keys ordered.
        for (let k = 1; k < keys.length; k += 1)
          keys[k][0] = Math.min(
            k === keys.length - 1 ? 1 : 0.985,
            Math.max(keys[k][0], keys[k - 1][0] + 0.001),
          );
        return [part, sampleKeys(keys, t)];
      }),
    );
  }
  function mirrorPose(source) {
    const flip = (point) => [256 - point[0], point[1]];
    const flipArm = (armature) => ({
      ...armature,
      shoulder: flip(armature.shoulder),
      elbow: flip(armature.elbow),
      hand: flip(armature.hand),
    });
    const f = source.face;
    return {
      body: source.body.map(flip),
      arms: {
        left: flipArm(source.arms.right),
        right: flipArm(source.arms.left),
      },
      face: {
        ...f,
        x: 256 - f.x,
        openL: f.openR,
        openR: f.openL,
        lidL: f.lidR,
        lidR: f.lidL,
        pupilL: [-f.pupilR[0], f.pupilR[1]],
        pupilR: [-f.pupilL[0], f.pupilL[1]],
        browL: -f.browR,
        browR: -f.browL,
        skew: -f.skew,
      },
      note: [256 - source.note[0], source.note[1], -source.note[2]],
      feet: [
        [256 - source.feet[1][0], ...source.feet[1].slice(1)],
        [256 - source.feet[0][0], ...source.feet[0].slice(1)],
      ],
      shadow: [...source.shadow],
    };
  }
  return {
    NAMES,
    LABELS,
    POSES,
    DEFAULT_TIMING,
    bodyPath,
    armPath,
    eyePath,
    lidPath,
    browPath,
    mouthPath,
    blend,
    timeline,
    sample,
    mirrorPose,
  };
});
