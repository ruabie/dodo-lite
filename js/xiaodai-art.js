(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.XiaodaiArt = api;
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";

  const PALETTE = Object.freeze({
    body: "#fffaf3", shade: "#f0f0e8", edge: "#dfe2dc", ink: "#203039",
    note: "#fff2c6", noteEdge: "#e7d8a4", green: "#369b70", cheek: "#f2c5bc",
    shadow: "#c4d1cb"
  });

  const ANCHORS = Object.freeze({
    body: [128, 162], leftShoulder: [62, 164], rightShoulder: [194, 164],
    leftFoot: [91, 224], rightFoot: [165, 224], leftEye: [105, 150],
    rightEye: [151, 150], mouth: [128, 177], note: [128, 97], ground: [128, 241]
  });

  const VIEWS = Object.freeze({
    front: {
      body: "M128 91 C83 91 49 116 42 153 C35 182 46 206 70 217 C96 229 158 229 184 217 C208 206 221 181 214 153 C205 116 173 91 128 91 Z",
      shade: "M65 193 C85 208 108 214 129 214 C155 214 179 208 194 193 C185 213 164 221 128 222 C92 222 75 214 65 193 Z",
      leftArm: "M66 153 C47 151 34 159 29 174 C25 187 32 200 44 203 C57 206 70 197 76 184 C81 171 78 157 66 153 Z",
      rightArm: "M190 153 C209 151 222 159 227 174 C231 187 224 200 212 203 C199 206 186 197 180 184 C175 171 178 157 190 153 Z",
      eyes: [[105, 150, 1], [151, 150, 1]], mouth: [128, 177], noteX: 128,
      feet: [[91, 225, 21, 13], [165, 225, 21, 13]], farArm: "none"
    },
    left34: {
      body: "M138 91 C88 87 54 113 47 151 C40 181 52 208 79 219 C103 228 162 226 188 213 C209 201 218 180 211 150 C202 115 173 94 138 91 Z",
      shade: "M73 193 C99 214 151 219 190 195 C183 214 164 222 128 223 C98 223 81 214 73 193 Z",
      leftArm: "M68 155 C48 151 34 161 31 178 C28 191 36 201 48 203 C61 205 75 191 78 176 C80 164 77 157 68 155 Z",
      rightArm: "M188 153 C207 156 220 170 219 184 C218 197 207 202 195 199 C184 196 177 185 176 173 C176 161 180 155 188 153 Z",
      eyes: [[104, 151, 1.05], [146, 151, .76]], mouth: [122, 177], noteX: 121,
      feet: [[88, 225, 20, 13], [158, 225, 18, 12]], farArm: "right"
    },
    right34: {
      body: "M118 91 C168 87 202 113 209 151 C216 181 204 208 177 219 C153 228 94 226 68 213 C47 201 38 180 45 150 C54 115 83 94 118 91 Z",
      shade: "M66 195 C105 219 157 214 183 193 C175 214 158 223 128 223 C92 222 73 214 66 195 Z",
      leftArm: "M68 153 C49 156 36 170 37 184 C38 197 49 202 61 199 C72 196 79 185 80 173 C80 161 76 155 68 153 Z",
      rightArm: "M188 155 C208 151 222 161 225 178 C228 191 220 201 208 203 C195 205 181 191 178 176 C176 164 179 157 188 155 Z",
      eyes: [[110, 151, .76], [152, 151, 1.05]], mouth: [134, 177], noteX: 135,
      feet: [[98, 225, 18, 12], [168, 225, 20, 13]], farArm: "left"
    },
    leftSide: {
      body: "M140 92 C98 88 70 112 62 151 C54 188 73 216 108 222 C142 228 185 214 197 189 C206 170 205 143 187 121 C174 104 159 94 140 92 Z",
      shade: "M85 196 C108 216 157 223 190 196 C178 217 145 225 117 222 C99 220 90 211 85 196 Z",
      leftArm: "M168 171 C183 169 192 181 189 192 C185 202 172 206 161 201 C152 197 150 183 157 175 C160 172 164 171 168 171 Z",
      rightArm: "M89 171 C75 174 71 185 78 194 C82 200 93 198 100 190 C104 184 99 173 89 171 Z",
      eyes: [[103, 154, .94]], mouth: [91, 178], noteX: 116,
      feet: [[109, 225, 18, 12], [160, 224, 16, 11]], farArm: "right"
    },
    rightSide: {
      body: "M116 92 C158 88 186 112 194 151 C202 188 183 216 148 222 C114 228 71 214 59 189 C50 170 51 143 69 121 C82 104 97 94 116 92 Z",
      shade: "M66 196 C99 223 148 216 171 196 C166 211 157 220 139 222 C111 225 78 217 66 196 Z",
      leftArm: "M167 171 C181 174 185 185 178 194 C174 200 163 198 156 190 C152 184 157 173 167 171 Z",
      rightArm: "M88 171 C73 169 64 181 67 192 C71 202 84 206 95 201 C104 197 106 183 99 175 C96 172 92 171 88 171 Z",
      eyes: [[153, 154, .94]], mouth: [165, 178], noteX: 140,
      feet: [[96, 224, 16, 11], [147, 225, 18, 12]], farArm: "left"
    },
    back: {
      body: "M128 91 C83 91 49 116 42 153 C35 182 46 206 70 217 C96 229 158 229 184 217 C208 206 221 181 214 153 C205 116 173 91 128 91 Z",
      shade: "M63 191 C91 213 165 213 193 191 C184 214 160 222 128 223 C96 222 72 214 63 191 Z",
      leftArm: "M65 151 C47 149 33 160 30 176 C27 190 37 201 49 202 C62 203 75 188 78 175 C80 162 75 154 65 151 Z",
      rightArm: "M191 151 C209 149 223 160 226 176 C229 190 219 201 207 202 C194 203 181 188 178 175 C176 162 181 154 191 151 Z",
      eyes: [], mouth: null, noteX: 128,
      feet: [[91, 225, 21, 13], [165, 225, 21, 13]], farArm: "none"
    }
  });

  const EMOTIONS = Object.freeze(["neutral", "happy", "curious", "confused", "sleepy", "surprised", "sad", "determined", "yawning"]);
  const EMOTION_POSTURES = Object.freeze({
    neutral: {}, happy: { y: -1, bodyX: .993, bodyY: 1.007, leftArm: 7, rightArm: -7, note: 1 },
    curious: { x: -1, bodyX: 1.01, bodyY: .99, leftArm: 5, rightArm: -3, note: -3, gazeX: -1 },
    confused: { bodyX: 1.012, bodyY: .988, leftArm: 6, rightArm: -8, note: 4, gazeX: 1 },
    sleepy: { y: 2, bodyX: 1.012, bodyY: .988, leftArm: 8, rightArm: -8, note: 5, gazeY: 1 },
    surprised: { y: -2, bodyX: .98, bodyY: 1.02, leftArm: 10, rightArm: -10, note: -4, gazeY: -.5 },
    sad: { y: 2, bodyX: 1.018, bodyY: .983, leftArm: 8, rightArm: -8, note: 3, gazeY: 1 },
    determined: { y: -1, bodyX: .996, bodyY: 1.004, leftArm: -5, rightArm: 5 },
    yawning: { y: 2, bodyX: .98, bodyY: 1.02, leftArm: 12, rightArm: -12, note: 5, gazeY: 1 }
  });
  const POSES = Object.freeze({
    stand: { y: 0, leftArm: 0, rightArm: 0, note: 0, emotion: "neutral", gaze: [0, 0] },
    notice: { y: -2, leftArm: 0, rightArm: -38, note: 4, emotion: "surprised", gaze: [1, -2] },
    curious: { y: 0, leftArm: 7, rightArm: -4, note: -3, emotion: "curious", gaze: [-3, -1] },
    remind: { y: -3, leftArm: -10, rightArm: -18, note: 5, emotion: "confused", gaze: [0, -2] },
    encourage: { y: -2, leftArm: 32, rightArm: -32, note: -3, emotion: "happy", gaze: [0, 0] },
    firm: { y: 0, leftArm: 9, rightArm: -9, note: 0, emotion: "determined", gaze: [0, 0] },
    hop: { y: -15, leftArm: 38, rightArm: -38, note: 7, emotion: "surprised", gaze: [0, -2] },
    celebrate: { y: -18, leftArm: 60, rightArm: -60, note: -8, emotion: "happy", gaze: [0, 0] }
  });

  let nextId = 0;

  function noteGlyph(state) {
    if (state === "notice") return '<path d="M128 59 C119 59 114 65 115 73 C115 78 119 80 122 84 H134 C137 80 141 78 141 73 C142 65 137 59 128 59 Z M122 88 H134" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>';
    if (state === "urgent") return '<circle cx="128" cy="73" r="14" fill="none" stroke="currentColor" stroke-width="4"/><path d="M128 64 V74 L134 77" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round"/>';
    if (state === "danger") return '<path d="M128 59 V77 M128 86 V87" fill="none" stroke="currentColor" stroke-width="7" stroke-linecap="round"/>';
    if (state === "done") return '<path d="M128 57 L132 68 L144 68 L134 75 L138 87 L128 80 L118 87 L122 75 L112 68 L124 68 Z" fill="currentColor"/>';
    return '<path d="M128 86 V72 M128 72 C118 60 108 62 110 71 C113 79 121 78 128 72 Z M128 72 C138 60 148 62 146 71 C143 79 135 78 128 72 Z" fill="none" stroke="currentColor" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/>';
  }

  function noteMarkup(viewName, view, pose, state) {
    const dx = view.noteX - 128;
    const back = viewName === "back";
    const side = viewName.includes("Side");
    const noteBody = side
      ? '<path d="M104 50 Q104 44 111 44 H148 Q155 44 155 51 V95 Q155 101 148 101 H112 Q104 101 104 94 Z"/>'
      : '<path d="M89 51 Q89 44 97 44 H159 Q167 44 167 51 V92 Q167 100 159 100 H97 Q89 100 89 92 Z"/>';
    return `<g class="xd-note" data-part="note" data-anchor="128,97" transform="translate(${dx} 0) rotate(${pose.note} 128 97)">
      <path d="M120 44 Q120 34 128 34 Q136 34 136 44" fill="${PALETTE.noteEdge}"/>
      <g fill="${PALETTE.note}" stroke="${PALETTE.noteEdge}" stroke-width="2">${noteBody}</g>
      ${back || side ? '<path d="M110 54 V91" stroke="#e8ddb7" stroke-width="2" stroke-linecap="round" opacity=".65"/>' : `<g class="xd-note-glyph" fill="none" color="${PALETTE.green}">${noteGlyph(state)}</g>`}
    </g>`;
  }

  function mouthPath(emotion, x, y) {
    const left = x - 11;
    const right = x + 11;
    if (emotion === "happy") return `M${left} ${y - 2} Q${x} ${y + 16} ${right} ${y - 2} Q${x} ${y + 8} ${left} ${y - 2} Z`;
    if (emotion === "yawning") return `M${x} ${y - 6} C${x - 7} ${y - 7} ${x - 8} ${y + 10} ${x} ${y + 12} C${x + 8} ${y + 10} ${x + 7} ${y - 7} ${x} ${y - 6} Z`;
    if (emotion === "surprised") return `M${x} ${y - 7} C${x - 8} ${y - 7} ${x - 8} ${y + 9} ${x} ${y + 9} C${x + 8} ${y + 9} ${x + 8} ${y - 7} ${x} ${y - 7} Z`;
    if (emotion === "sad") return `M${left} ${y + 7} Q${x} ${y - 6} ${right} ${y + 7}`;
    if (emotion === "confused") return `M${left} ${y + 2} Q${x - 5} ${y - 4} ${x} ${y + 2} Q${x + 5} ${y + 7} ${right} ${y - 1}`;
    if (emotion === "sleepy") return `M${x - 7} ${y + 1} Q${x} ${y + 5} ${x + 7} ${y + 1}`;
    if (emotion === "determined") return `M${x - 9} ${y + 2} Q${x} ${y - 1} ${x + 9} ${y + 2}`;
    if (emotion === "curious") return `M${x - 7} ${y + 2} Q${x + 2} ${y + 8} ${x + 9} ${y}`;
    return `M${left} ${y - 1} Q${x} ${y + 9} ${right} ${y - 1}`;
  }

  function eyeMarkup(side, eye, emotion, gaze, uniqueId) {
    const [x, y, scale] = eye;
    const width = (11 * scale).toFixed(1);
    const height = emotion === "surprised" ? 13 : ["sleepy", "yawning"].includes(emotion) ? 7 : emotion === "happy" ? 9 : 11;
    const pupilRadius = emotion === "surprised" ? 5.1 : ["sleepy", "yawning"].includes(emotion) ? 5.5 : 6.4;
    const gx = Math.max(-3, Math.min(3, gaze[0] || 0));
    const gy = Math.max(-2.5, Math.min(2.5, gaze[1] || 0));
    const eyelid = ["sleepy", "yawning"].includes(emotion) ? .8 : emotion === "happy" ? .22 : emotion === "sad" ? .25 : 0;
    const clipId = `xd-eye-${uniqueId}-${side}`;
    return `<g class="xd-eye xd-eye-${side}" data-part="${side}-eye" data-anchor="${x},${y}">
      <defs><clipPath id="${clipId}"><ellipse cx="${x}" cy="${y}" rx="${width}" ry="${height}"/></clipPath></defs>
      <ellipse class="xd-eye-outline" cx="${x}" cy="${y}" rx="${width}" ry="${height}" fill="#fffefb" stroke="${PALETTE.edge}" stroke-width="1.6"/>
      <g clip-path="url(#${clipId})"><g class="xd-pupil xd-pupil-${side}" data-part="${side}-pupil" transform="translate(${gx} ${gy})">
        <circle cx="${x}" cy="${y + 1}" r="${pupilRadius}" fill="${PALETTE.ink}"/>
        <circle cx="${x - 2.1}" cy="${y - 2}" r="2.2" fill="#fff"/>
      </g></g>
      <path class="xd-eyelid xd-eyelid-${side}" data-part="${side}-eyelid" d="M${x - 13} ${y - 13} Q${x} ${y - 17} ${x + 13} ${y - 13} L${x + 13} ${y - 13 + 12 * eyelid} Q${x} ${y - 16 + 14 * eyelid} ${x - 13} ${y - 13 + 12 * eyelid} Z" fill="${PALETTE.body}" opacity="${eyelid ? 1 : 0}"/>
    </g>`;
  }

  function faceMarkup(view, emotion, gaze, uniqueId) {
    if (!view.mouth) return '<g class="xd-face" data-part="face"></g>';
    const [mouthX, mouthY] = view.mouth;
    const brows = emotion === "curious" || emotion === "confused" || emotion === "surprised" || emotion === "sad" || emotion === "determined";
    const eyeMarkupList = view.eyes.map((eye, index) => eyeMarkup(index === 0 ? "left" : "right", eye, emotion, gaze, uniqueId)).join("");
    const browList = brows ? view.eyes.map(([x, y], index) => {
      const tilt = emotion === "determined" ? (index ? -4 : 4) : emotion === "sad" ? (index ? 3 : -3) : emotion === "confused" ? (index ? -1 : 4) : 0;
      return `<path d="M${x - 8} ${y - 21 + tilt} Q${x} ${y - 25} ${x + 8} ${y - 21 - tilt}" fill="none" stroke="${PALETTE.ink}" stroke-width="2.4" stroke-linecap="round"/>`;
    }).join("") : "";
    const cheeks = view.eyes.length === 2 ? `<ellipse cx="${view.eyes[0][0] - 18}" cy="${view.eyes[0][1] + 18}" rx="10" ry="5"/><ellipse cx="${view.eyes[1][0] + 18}" cy="${view.eyes[1][1] + 18}" rx="10" ry="5"/>` : `<ellipse cx="${view.eyes[0][0] - 21}" cy="${view.eyes[0][1] + 17}" rx="9" ry="5"/>`;
    const mouthFill = ["happy", "surprised", "yawning"].includes(emotion) ? PALETTE.ink : "none";
    return `<g class="xd-face" data-part="face" data-anchor="128,154">
      <g class="xd-cheeks" fill="${PALETTE.cheek}" opacity=".58">${cheeks}</g>
      ${eyeMarkupList}<g class="xd-brows">${browList}</g>
      <path class="xd-mouth" data-part="mouth" d="${mouthPath(emotion, mouthX, mouthY)}" fill="${mouthFill}" stroke="${PALETTE.ink}" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>
      ${emotion === "happy" ? `<path d="M${mouthX - 5} ${mouthY + 8} Q${mouthX} ${mouthY + 11} ${mouthX + 5} ${mouthY + 8}" fill="none" stroke="#f1a7a2" stroke-width="3" stroke-linecap="round"/>` : ""}
    </g>`;
  }

  function armMarkup(side, view, pose) {
    const left = side === "left";
    const anchor = left ? ANCHORS.leftShoulder : ANCHORS.rightShoulder;
    const angle = left ? pose.leftArm : pose.rightArm;
    return `<g class="xd-arm xd-arm-${side}" data-part="${side}-arm" data-anchor="${anchor.join(",")}" transform="rotate(${angle} ${anchor.join(" ")})"><path d="${left ? view.leftArm : view.rightArm}" fill="${PALETTE.body}" stroke="${PALETTE.edge}" stroke-width="1.8"/></g>`;
  }

  function footMarkup(side, foot) {
    const [x, y, rx, ry] = foot;
    return `<g class="xd-foot xd-foot-${side}" data-part="${side}-foot" data-anchor="${x},${y}"><ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="${PALETTE.body}" stroke="${PALETTE.edge}" stroke-width="1.7"/></g>`;
  }

  function anchorMarkup() {
    return `<g class="xd-anchors" pointer-events="none">${Object.entries(ANCHORS).map(([name, [x, y]]) => `<circle cx="${x}" cy="${y}" r="2.5" fill="#468bea"/><text x="${x + 4}" y="${y - 4}" font-size="6" fill="#2365ad">${name}</text>`).join("")}</g>`;
  }

  function svgMarkup(options = {}) {
    const viewName = Object.hasOwn(VIEWS, options.view) ? options.view : "front";
    const view = VIEWS[viewName];
    const poseName = Object.hasOwn(POSES, options.pose) ? options.pose : "stand";
    const basePose = POSES[poseName];
    const emotion = EMOTIONS.includes(options.emotion) ? options.emotion : basePose.emotion;
    const posture = poseName === "stand" ? EMOTION_POSTURES[emotion] : {};
    const pose = { ...basePose, ...posture };
    const state = ["calm", "notice", "urgent", "danger", "done"].includes(options.state) ? options.state : "calm";
    const gaze = Array.isArray(options.gaze) ? options.gaze : [posture.gazeX || pose.gaze[0], posture.gazeY || pose.gaze[1]];
    const uniqueId = ++nextId;
    const leftArm = armMarkup("left", view, pose);
    const rightArm = armMarkup("right", view, pose);
    const farArm = view.farArm === "left" ? leftArm : view.farArm === "right" ? rightArm : "";
    const nearArms = view.farArm === "left" ? rightArm : view.farArm === "right" ? leftArm : leftArm + rightArm;
    const shadowScale = poseName === "hop" || poseName === "celebrate" ? .75 : 1;
    return `<svg class="xiaodai-svg" viewBox="0 0 256 256" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="小待 ${viewName} ${emotion}" data-view="${viewName}" data-emotion="${emotion}" data-pose="${poseName}">
      <g class="xd-shadow" data-part="ground-shadow" data-anchor="128,241" transform="translate(128 241) scale(${shadowScale} 1) translate(-128 -241)"><ellipse cx="128" cy="241" rx="63" ry="7" fill="${PALETTE.shadow}" opacity=".52"/></g>
      <g class="xd-root" data-part="root" transform="translate(0 ${pose.y})">
        ${footMarkup("left", view.feet[0])}${footMarkup("right", view.feet[1])}
        ${farArm}
        <g class="xd-body" data-part="body" data-anchor="128,162" transform="translate(128 162) scale(${posture.bodyX || 1} ${posture.bodyY || 1}) translate(-128 -162)"><path class="xd-body-shell" d="${view.body}" fill="${PALETTE.body}" stroke="${PALETTE.edge}" stroke-width="1.9"/><path d="${view.shade}" fill="${PALETTE.shade}" opacity=".62"/></g>
        ${nearArms}
        ${faceMarkup(view, emotion, gaze, uniqueId)}
        ${noteMarkup(viewName, view, pose, state)}
      </g>
      ${poseName === "celebrate" ? '<path class="xd-spark" d="M210 93 L213 101 L221 104 L213 107 L210 115 L207 107 L199 104 L207 101 Z" fill="#e9bd5c"/>' : ""}
      ${options.debugAnchors ? anchorMarkup() : ""}
    </svg>`;
  }

  return { PALETTE, ANCHORS, VIEWS: Object.keys(VIEWS), EMOTIONS, EMOTION_POSTURES, POSES: Object.keys(POSES), svgMarkup };
});
