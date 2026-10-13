const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const art = require("../js/xiaodai-art.js");

const root = path.resolve(__dirname, "..");
const board = fs.readFileSync(path.join(root, "character-lab/art-reference.html"), "utf8");
const originals = {
  calm: "28a89e690bc8d0e819917927e734bd96e9336c42e3752958bafd580b00697114",
  notice: "72e4bb5004b958499c2ed1a8b8dcf2ce3be7ea2bc10301e3e5670357203a2044",
  urgent: "e48d8dc670f3da6939b191b495ef1004c391f764e1b3b9b110553c8bf08de1ef",
  danger: "8c49784394848f028a247bc86771872dd9350c66d7a3aaed01803fcb2e81a60a",
  done: "02abb98949eee6aeeffc777ed1bbc49a997401efbb1aa70686310d5bce94bac3"
};

test("reference board points to all five unchanged 1024px historical masters", () => {
  for (const [state, expectedHash] of Object.entries(originals)) {
    const name = `dodo_${state}@2x.png`;
    const bytes = fs.readFileSync(path.join(root, "assets", name));
    assert.equal(bytes.toString("hex", 0, 8), "89504e470d0a1a0a");
    assert.equal(bytes.readUInt32BE(16), 1024);
    assert.equal(bytes.readUInt32BE(20), 1024);
    assert.equal(crypto.createHash("sha256").update(bytes).digest("hex"), expectedHash);
    assert.ok(board.includes(`../assets/${name}`));
    assert.ok(board.includes(`assets/${name}`));
  }
});

test("current comparison is the existing front neutral calm pose", () => {
  assert.match(board, /src="\.\.\/assets\/reference\/xiaodai-v55-front\.svg"/);
  assert.doesNotMatch(board, /<script\b/i);
  const snapshot = fs.readFileSync(path.join(root, "assets/reference/xiaodai-v55-front.svg"), "utf8");
  const live = art.svgMarkup({ view: "front", pose: "stand", emotion: "neutral", state: "calm" });
  for (const svg of [snapshot, live]) {
    assert.match(svg, /viewBox="0 0 256 256"/);
    assert.match(svg, /data-view="front"/);
    for (const part of ["left-arm", "right-arm", "left-foot", "right-foot", "body", "mouth", "note"])
      assert.ok(svg.includes(`data-part="${part}"`));
  }
  const primitives = (svg) => [...svg.matchAll(/<(?:path|ellipse|circle)\b[^>]*\/>/g)].map((match) => match[0]);
  assert.deepEqual(primitives(snapshot), primitives(live), "static snapshot preserves every original drawn path and ellipse");
});

test("board records provenance and mobile presentation without claiming missing viewpoints", () => {
  assert.match(board, /V5\.3 ZIP → V5\.4/);
  assert.match(board, /V5\.5 SVG/);
  assert.match(board, /未记录各张图最初的绘制版本/);
  assert.match(board, /max-width: 700px/);
  assert.match(board, /overflow-x: auto/);
  assert.match(board, /缺失的侧面、背面没有补画/);
});
