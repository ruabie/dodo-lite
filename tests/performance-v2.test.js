"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const V2 = require("../js/xiaodai-performance-v2.js");

test("five still poses have different local bodies, arms and face morphology", () => {
  assert.deepEqual(V2.NAMES, [
    "idle",
    "notice",
    "anticipation",
    "reaction",
    "settle",
  ]);
  const poses = V2.NAMES.map((name) => V2.POSES[name]);
  for (const pose of poses) {
    assert.equal(pose.body.length, 10);
    assert.match(V2.bodyPath(pose.body), /^M.*(?:C.*){10} Z$/);
    assert.match(V2.armPath(pose.arms.left), /^M.*(?:C.*){8} Z$/);
    assert.match(V2.armPath(pose.arms.right), /^M.*(?:C.*){8} Z$/);
    assert.equal(pose.feet.length, 2);
    assert.ok(
      pose.note[1] < pose.body[0][1],
      "top note remains attached above the body",
    );
  }
  assert.equal(new Set(poses.map((pose) => V2.bodyPath(pose.body))).size, 5);
  assert.equal(
    new Set(poses.map((pose) => V2.armPath(pose.arms.left))).size,
    5,
  );
  assert.equal(
    new Set(
      poses.map((pose) =>
        V2.eyePath(pose.face.x - 23, pose.face.y - 7, pose.face.openL),
      ),
    ).size,
    5,
  );
  assert.equal(new Set(poses.map((pose) => V2.mouthPath(pose.face))).size, 5);
  assert.ok(V2.POSES.anticipation.body[0][1] > V2.POSES.idle.body[0][1] + 10);
  assert.ok(V2.POSES.anticipation.body[3][0] > V2.POSES.idle.body[3][0] + 5);
  assert.ok(V2.POSES.reaction.body[0][1] < V2.POSES.idle.body[0][1] - 10);
  assert.ok(
    V2.POSES.reaction.arms.left.hand[1] < V2.POSES.idle.arms.left.hand[1] - 60,
  );
});

test("new body, arm and face interpolate without coordinate jumps", () => {
  let last = V2.sample(0);
  let largestBodyStep = 0,
    largestArmStep = 0,
    largestFaceStep = 0;
  for (let index = 1; index <= 1200; index += 1) {
    const next = V2.sample(index / 1200);
    const values = [
      next.body.flat(Infinity),
      next.arms.left.hand,
      Object.values(next.face).flat(Infinity),
    ];
    for (const value of values.flat()) assert.ok(Number.isFinite(value));
    largestBodyStep = Math.max(
      largestBodyStep,
      ...next.body.map(([x, y], p) =>
        Math.hypot(x - last.body[p][0], y - last.body[p][1]),
      ),
    );
    largestArmStep = Math.max(
      largestArmStep,
      Math.hypot(
        next.arms.left.hand[0] - last.arms.left.hand[0],
        next.arms.left.hand[1] - last.arms.left.hand[1],
      ),
    );
    largestFaceStep = Math.max(
      largestFaceStep,
      Math.abs(next.face.mouthOpen - last.face.mouthOpen),
    );
    last = next;
  }
  assert.ok(
    largestBodyStep < 1.5,
    `body jumped ${largestBodyStep.toFixed(2)} px`,
  );
  assert.ok(largestArmStep < 2, `hand jumped ${largestArmStep.toFixed(2)} px`);
  assert.ok(
    largestFaceStep < 0.35,
    `mouth jumped ${largestFaceStep.toFixed(2)}`,
  );
});

test("eye attention precedes the main body lean and timing is independently adjustable", () => {
  const early = V2.sample(0.05),
    idle = V2.POSES.idle,
    notice = V2.POSES.notice;
  const eyeFraction =
    (early.face.openL - idle.face.openL) /
    (notice.face.openL - idle.face.openL);
  const bodyFraction =
    (early.body[0][0] - idle.body[0][0]) /
    (notice.body[0][0] - idle.body[0][0]);
  assert.ok(
    eyeFraction > bodyFraction + 0.15,
    `eye ${eyeFraction.toFixed(2)}, body ${bodyFraction.toFixed(2)}`,
  );
  const standard = V2.timeline();
  const slower = V2.timeline({
    notice: 320,
    anticipation: 280,
    reaction: 310,
    settle: 650,
  });
  assert.equal(standard.total, 1200);
  assert.equal(slower.total, 1560);
  assert.ok(
    standard.marks.idle < standard.marks.notice &&
      standard.marks.notice < standard.marks.anticipation,
  );
  assert.ok(
    standard.marks.anticipation < standard.marks.reaction &&
      standard.marks.reaction < standard.marks.settle &&
      standard.marks.settle < 1,
  );
  assert.notDeepEqual(
    V2.sample(0.4),
    V2.sample(0.4, {
      notice: 320,
      anticipation: 280,
      reaction: 310,
      settle: 650,
    }),
  );
});

test("mirroring a front-facing touch does not invent a third limb or tail", () => {
  const right = V2.mirrorPose(V2.POSES.reaction);
  assert.deepEqual(V2.mirrorPose(right).body, V2.POSES.reaction.body);
  assert.equal(Object.keys(right.arms).length, 2);
  assert.equal(right.feet.length, 2);
  assert.ok(!Object.keys(right).includes("tail"));
});

test("performance experiment does not load V2 in the production app", () => {
  const root = path.resolve(__dirname, "..");
  const app = fs.readFileSync(path.join(root, "index.html"), "utf8");
  const lab = fs.readFileSync(
    path.join(root, "character-lab", "index.html"),
    "utf8",
  );
  const preview = fs.readFileSync(
    path.join(root, "character-lab", "performance-v2.html"),
    "utf8",
  );
  assert.doesNotMatch(app, /xiaodai-performance-v2|performance-v2\.js/);
  assert.match(lab, /performance-v2\.html/);
  assert.match(preview, /xiaodai-performance-v2\.js/);
  assert.doesNotMatch(preview, /notification-manager|urgency-engine|app\.js/);
});
