"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { STATES, CharacterStateModel, chooseIdleAction } = require("../js/character-engine.js");

test("Calm remains calm after ten rapid taps", () => {
  const character = new CharacterStateModel({ state: "calm" });
  for (let index = 0; index < 10; index += 1) character.reactionForTap(1000 + index * 100);
  assert.equal(character.state, "calm");
  assert.ok(["tapHappy", "tapCurious", "tapDodge", "tapProtest"].includes(character.reactionForTap(2100).action));
});

test("Notice taps cannot enter Danger", () => {
  const character = new CharacterStateModel({ state: "notice" });
  for (let index = 0; index < 12; index += 1) character.reactionForTap(2000 + index * 80);
  assert.equal(character.state, "notice");
});

test("all five STATE values stay stable through interactions", () => {
  for (const state of STATES) {
    const character = new CharacterStateModel({ state });
    for (let index = 0; index < 10; index += 1) character.reactionForTap(3000 + index * 100);
    assert.equal(character.state, state);
  }
});

test("special idle action cannot repeat immediately", () => {
  assert.equal(chooseIdleAction(0.955, "yawn"), "breathe");
});
