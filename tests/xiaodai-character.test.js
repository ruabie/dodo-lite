"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const art = require("../js/xiaodai-art.js");
const motion = require("../js/xiaodai-motion.js");
const idle = require("../js/xiaodai-idle.js");
const { CharacterStateModel, STATES } = require("../js/xiaodai-character.js");

test("new interaction model keeps business STATE stable through rapid touches", () => {
  for (const state of STATES) {
    const model = new CharacterStateModel({ state });
    for (let i = 0; i < 30; i += 1) assert.equal(model.reactionForTap(1000 + i * 25).action, "tapReact");
    assert.equal(model.state, state);
  }
});

test("all authored angles have exactly two arms, two feet and no tail part", () => {
  for (const view of art.VIEWS) {
    const svg = art.svgMarkup({ view });
    assert.equal((svg.match(/data-part="left-arm"/g) || []).length, 1, view);
    assert.equal((svg.match(/data-part="right-arm"/g) || []).length, 1, view);
    assert.equal((svg.match(/data-part="left-foot"/g) || []).length, 1, view);
    assert.equal((svg.match(/data-part="right-foot"/g) || []).length, 1, view);
    assert.equal((svg.match(/data-part="note"/g) || []).length, 1, view);
    assert.doesNotMatch(svg, /data-part="[^"]*tail/i, view);
  }
  assert.doesNotMatch(art.svgMarkup({ view: "back" }), /data-part="mouth"/);
});

test("eyes, mouth, note, body and ground shadow remain separate rig regions", () => {
  const svg = art.svgMarkup();
  for (const part of ["body", "left-eye", "right-eye", "left-pupil", "right-pupil", "left-eyelid", "right-eyelid", "mouth", "note", "ground-shadow"]) {
    assert.match(svg, new RegExp(`data-part="${part}"`), part);
  }
});

test("emotion designs include a body or arm posture, not only a mouth swap", () => {
  for (const emotion of art.EMOTIONS.filter(name => name !== "neutral")) {
    const posture = art.EMOTION_POSTURES[emotion];
    assert.ok(posture && Object.keys(posture).some(key => ["bodyX", "bodyY", "leftArm", "rightArm", "note", "y"].includes(key)), emotion);
    const svg = art.svgMarkup({ emotion });
    assert.match(svg, new RegExp(`data-emotion="${emotion}"`));
  }
});

test("notice to tap reaction to recovery has separate weighted tracks", () => {
  for (const name of ["notice", "tapReact", "returnToIdle"]) {
    const action = motion.ACTIONS[name];
    assert.ok(action.duration >= 400, name);
    assert.ok(Object.keys(action.tracks).length >= 8, name);
    for (const track of Object.values(action.tracks)) {
      assert.equal(track[0][0], 0);
      assert.equal(track.at(-1)[0], 1);
    }
  }
  assert.equal(motion.sampleTrack([[0, null], [.5, 8, "out"], [1, 0, "inOut"]], 0, 2), 2);
  assert.equal(motion.sampleTrack([[0, null], [.5, 8, "out"], [1, 0, "inOut"]], 1, 2), 0);
  const elasticTrack = [[0, null], [1, 10, "back"]];
  assert.ok(motion.sampleTrack(elasticTrack, .2, 0, 0) > 0, "zero elasticity should still ease smoothly");
  assert.ok(motion.sampleTrack(elasticTrack, .2, 0, 1.8) < 10, "high elasticity should not snap at segment start");
});

test("idle selector avoids exact repeats and honours cooldown", () => {
  assert.notEqual(idle.chooseIdleAction(0, "lookAside"), "lookAside");
  assert.notEqual(idle.chooseIdleAction(0, "", { lookAside: Date.now() + 10000 }), "lookAside");
});
