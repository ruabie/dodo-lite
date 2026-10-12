(function () {
  "use strict";
  const V2 = window.XiaodaiPerformanceV2;
  const Art = window.XiaodaiArt;
  const $ = (selector) => document.querySelector(selector);
  let serial = 0;
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  const fmt = (n) => Number(n.toFixed(2));

  class PerformanceRig {
    constructor(host) {
      this.host = host;
      this.id = ++serial;
      const left = `v2-left-${this.id}`,
        right = `v2-right-${this.id}`;
      host.innerHTML = `<svg class="performance-svg" viewBox="0 0 256 256" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="小待 Performance V2">
        <defs><clipPath id="${left}"><path data-part="left-clip"/></clipPath><clipPath id="${right}"><path data-part="right-clip"/></clipPath></defs>
        <ellipse class="v2-shadow" data-part="shadow" cx="128" cy="241" ry="7"/>
        <ellipse class="v2-foot" data-part="left-foot"/><ellipse class="v2-foot" data-part="right-foot"/>
        <path class="v2-body" data-part="body"/>
        <path data-part="belly-shade" fill="#f0f0e8" opacity=".62"/>
        <path class="v2-arm" data-part="left-arm"/><path class="v2-arm" data-part="right-arm"/>
        <g class="v2-face"><ellipse class="v2-cheek" data-part="left-cheek" rx="10" ry="5"/><ellipse class="v2-cheek" data-part="right-cheek" rx="10" ry="5"/>
          <path class="v2-eye" data-part="left-eye"/><path class="v2-eye" data-part="right-eye"/>
          <g clip-path="url(#${left})"><circle class="v2-pupil" data-part="left-pupil" r="6.2"/><circle data-part="left-glint" r="2.1" fill="#fff"/></g>
          <g clip-path="url(#${right})"><circle class="v2-pupil" data-part="right-pupil" r="6.2"/><circle data-part="right-glint" r="2.1" fill="#fff"/></g>
          <path class="v2-lid" data-part="left-lid"/><path class="v2-lid" data-part="right-lid"/>
          <path class="v2-brow" data-part="left-brow"/><path class="v2-brow" data-part="right-brow"/>
          <path class="v2-mouth" data-part="mouth"/></g>
        <g class="v2-note" data-part="note"><path d="M120 44 Q120 34 128 34 Q136 34 136 44" fill="#e7d8a4"/>
          <rect x="89" y="44" width="78" height="56" rx="9" fill="#fff2c6" stroke="#e7d8a4" stroke-width="2"/>
          <path d="M128 86 V72 M128 72 C118 60 108 62 110 71 C113 79 121 78 128 72 Z M128 72 C138 60 148 62 146 71 C143 79 135 78 128 72 Z" fill="none" stroke="#369b70" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/></g>
        <g class="v2-debug" pointer-events="none"><path data-part="baseline" d="${Art.svgMarkup({ view: "front" }).match(/class="xd-body-shell" d="([^"]+)/)[1]}"/><g data-part="landmarks"></g></g>
      </svg>`;
      this.svg = host.querySelector("svg");
      this.parts = Object.fromEntries(
        Array.from(this.svg.querySelectorAll("[data-part]")).map((el) => [
          el.dataset.part,
          el,
        ]),
      );
      this.landmarkDots = Array.from({ length: 10 }, () => {
        const dot = document.createElementNS(
          "http://www.w3.org/2000/svg",
          "circle",
        );
        dot.setAttribute("r", "2");
        this.parts.landmarks.append(dot);
        return dot;
      });
      this.render(V2.POSES.idle);
    }
    render(pose) {
      const p = this.parts;
      p.body.setAttribute("d", V2.bodyPath(pose.body));
      const b = pose.body;
      p["belly-shade"].setAttribute(
        "d",
        `M${fmt(b[6][0])} ${fmt(b[6][1] - 14)} Q${fmt(b[5][0])} ${fmt(b[5][1] + 4)} ${fmt(b[4][0])} ${fmt(b[4][1] - 14)} Q${fmt(b[5][0])} ${fmt(b[5][1] - 2)} ${fmt(b[6][0])} ${fmt(b[6][1] - 14)} Z`,
      );
      for (const side of ["left", "right"]) {
        p[`${side}-arm`].setAttribute("d", V2.armPath(pose.arms[side]));
        const f = pose.feet[side === "left" ? 0 : 1];
        for (const [attribute, value] of [
          ["cx", f[0]],
          ["cy", f[1]],
          ["rx", f[2]],
          ["ry", f[3]],
        ])
          p[`${side}-foot`].setAttribute(attribute, fmt(value));
        const isLeft = side === "left";
        const x = pose.face.x + (isLeft ? -23 : 23),
          y = pose.face.y - 7;
        const openness = pose.face[isLeft ? "openL" : "openR"];
        const shape = V2.eyePath(x, y, openness);
        p[`${side}-eye`].setAttribute("d", shape);
        p[`${side}-clip`].setAttribute("d", shape);
        p[`${side}-lid`].setAttribute(
          "d",
          V2.lidPath(x, y, openness, pose.face[isLeft ? "lidL" : "lidR"]),
        );
        p[`${side}-brow`].setAttribute(
          "d",
          V2.browPath(x, y, pose.face[isLeft ? "browL" : "browR"]),
        );
        const offset = pose.face[isLeft ? "pupilL" : "pupilR"];
        const px = x + clamp(offset[0], -3.2, 3.2),
          py = y + clamp(offset[1], -2, 2);
        p[`${side}-pupil`].setAttribute("cx", fmt(px));
        p[`${side}-pupil`].setAttribute("cy", fmt(py + 1));
        p[`${side}-glint`].setAttribute("cx", fmt(px - 2));
        p[`${side}-glint`].setAttribute("cy", fmt(py - 2));
        p[`${side}-cheek`].setAttribute("cx", fmt(x + (isLeft ? -18 : 18)));
        p[`${side}-cheek`].setAttribute("cy", fmt(y + 19));
        p[`${side}-cheek`].setAttribute("opacity", fmt(pose.face.cheek));
      }
      p.mouth.setAttribute("d", V2.mouthPath(pose.face));
      p.note.setAttribute(
        "transform",
        `translate(${fmt(pose.note[0] - 128)} ${fmt(pose.note[1] - 70)}) rotate(${fmt(pose.note[2])} 128 70)`,
      );
      p.shadow.setAttribute("rx", fmt(pose.shadow[0]));
      p.shadow.setAttribute("opacity", fmt(pose.shadow[1]));
      pose.body.forEach(([x, y], index) => {
        this.landmarkDots[index].setAttribute("cx", fmt(x));
        this.landmarkDots[index].setAttribute("cy", fmt(y));
      });
    }
  }

  const newRig = new PerformanceRig($("#new-character"));
  const oldRig = new XiaodaiRig($("#old-character"), {
    state: "calm",
    emotion: "neutral",
  });
  const oldBaseline = { ...oldRig.values };
  const oldOutline = oldRig.parts.body
    .querySelector(".xd-body-shell")
    .cloneNode();
  oldOutline.removeAttribute("class");
  oldOutline.classList.add("old-debug-path");
  oldRig.parts.root.append(oldOutline);
  let chosenPose = "idle";
  const descriptions = {
    idle: "松弛重心 · 对称站立",
    notice: "眼先到 · 躯干后跟",
    anticipation: "上弧下沉 · 下腹展开",
    reaction: "双手扬起 · 上宽下收",
    settle: "便签回摆 · 喜悦残留",
  };
  for (const name of V2.NAMES) {
    const card = document.createElement("button");
    card.type = "button";
    card.className = `pose-card${name === "idle" ? " selected" : ""}`;
    card.dataset.pose = name;
    card.setAttribute("aria-label", V2.LABELS[name]);
    const art = document.createElement("div");
    art.className = "pose-art";
    new PerformanceRig(art).render(V2.POSES[name]);
    card.append(art);
    const label = document.createElement("strong");
    label.textContent = V2.LABELS[name];
    card.append(label);
    const small = document.createElement("small");
    small.textContent = descriptions[name];
    card.append(small);
    card.addEventListener("click", () => {
      pause();
      chosenPose = name;
      progress = V2.timeline(timing).marks[name];
      $("#scrub").value = Math.round(progress * 1000);
      renderAt(progress, name);
      $("#new-caption").textContent = `静态姿势 ${V2.LABELS[name]}`;
      document
        .querySelectorAll(".pose-card")
        .forEach((el) => el.classList.toggle("selected", el === card));
    });
    $("#pose-cards").append(card);
  }

  const timing = { ...V2.DEFAULT_TIMING };
  let progress = 0,
    frame = null,
    started = 0,
    playbackSpeed = 1,
    touchSide = "left";
  const oldClips = [
    ["notice", XiaodaiMotion.ACTIONS.notice],
    ["tapReact", XiaodaiMotion.ACTIONS.tapReact],
    ["returnToIdle", XiaodaiMotion.ACTIONS.returnToIdle],
  ];
  const oldTotal = oldClips.reduce((sum, [, spec]) => sum + spec.duration, 0);
  function renderOld(at) {
    let remaining = clamp(at, 0, 1) * oldTotal;
    let values = { ...oldBaseline },
      emotion = "neutral",
      fade = 1,
      stage = "idle";
    for (const [name, spec] of oldClips) {
      const from = { ...values };
      const local = Math.min(1, remaining / spec.duration);
      for (const [key, track] of Object.entries(spec.tracks))
        values[key] = XiaodaiMotion.sampleTrack(track, local, from[key], 1);
      if (remaining <= spec.duration) {
        stage = name;
        if (name === "notice" || name === "tapReact") {
          const elapsed = remaining;
          emotion =
            elapsed < 78
              ? name === "notice"
                ? "neutral"
                : "surprised"
              : spec.emotion;
          fade =
            elapsed < 78 ? 1 - elapsed / 78 : Math.min(1, (elapsed - 78) / 120);
        } else emotion = "happy";
        break;
      }
      remaining -= spec.duration;
      emotion = spec.emotion || emotion;
    }
    if (at >= 1) {
      values = { ...oldBaseline };
      emotion = "neutral";
      stage = "idle";
    }
    if (touchSide === "right") values.gazeX = -(values.gazeX || 0);
    oldRig.setEmotion(emotion, { instant: true });
    oldRig.apply(values);
    oldRig.parts.face.style.opacity = String(fade);
    return stage;
  }
  function stageAt(at) {
    const marks = V2.timeline(timing).marks;
    if (at < marks.notice) return "notice";
    if (at < marks.anticipation) return "anticipation";
    if (at < marks.reaction) return "reaction";
    if (at < 1) return "settle";
    return "idle";
  }
  function renderAt(at, staticName) {
    progress = clamp(at, 0, 1);
    const pose = staticName
      ? V2.POSES[staticName]
      : V2.sample(progress, timing);
    newRig.render(touchSide === "right" ? V2.mirrorPose(pose) : pose);
    const oldStage = renderOld(progress);
    $("#old-caption").textContent =
      `V1 · ${oldStage} · ${Math.round(progress * oldTotal)} / ${oldTotal} ms`;
    if (!staticName)
      $("#new-caption").textContent =
        `V2 · ${stageAt(progress)} · ${Math.round(progress * V2.timeline(timing).total)} ms`;
    $("#time-output").textContent =
      `${Math.round(progress * V2.timeline(timing).total)} / ${V2.timeline(timing).total} ms`;
    $("#scrub").value = Math.round(progress * 1000);
  }
  function pause() {
    if (frame != null) cancelAnimationFrame(frame);
    frame = null;
  }
  function play() {
    pause();
    clearPoseSelection();
    if ($("#reduced").checked) {
      renderAt(V2.timeline(timing).marks.reaction, "reaction");
      return;
    }
    if (progress >= 1) progress = 0;
    const total = V2.timeline(timing).total;
    started = performance.now() - (progress * total) / playbackSpeed;
    const tick = (now) => {
      frame = null;
      renderAt(Math.min(1, ((now - started) * playbackSpeed) / total));
      if (progress < 1 && !document.hidden) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
  }
  function clearPoseSelection() {
    chosenPose = null;
    document
      .querySelectorAll(".pose-card")
      .forEach((card) => card.classList.remove("selected"));
  }
  function adjustFrame(sign) {
    pause();
    clearPoseSelection();
    renderAt(progress + (sign * (1000 / 60)) / V2.timeline(timing).total);
  }
  for (const name of V2.NAMES.slice(1)) {
    const label = document.createElement("label");
    label.textContent = V2.LABELS[name].slice(4);
    const output = document.createElement("span");
    output.textContent = `${timing[name]} ms`;
    label.append(output);
    const input = document.createElement("input");
    input.type = "range";
    input.min = "100";
    input.max = "850";
    input.step = "10";
    input.value = timing[name];
    input.addEventListener("input", () => {
      pause();
      timing[name] = Number(input.value);
      output.textContent = `${timing[name]} ms`;
      renderMilestones();
      renderAt(progress);
    });
    label.append(input);
    $("#phase-controls").append(label);
  }
  function renderMilestones() {
    const marks = V2.timeline(timing).marks;
    $("#milestones").innerHTML = V2.NAMES.map(
      (name) =>
        `<span title="${V2.LABELS[name]}">${name} ${Math.round(marks[name] * V2.timeline(timing).total)} ms</span>`,
    ).join("");
  }
  $("#play").addEventListener("click", play);
  $("#pause").addEventListener("click", pause);
  $("#step-back").addEventListener("click", () => adjustFrame(-1));
  $("#step-forward").addEventListener("click", () => adjustFrame(1));
  $("#scrub").addEventListener("input", (event) => {
    pause();
    clearPoseSelection();
    renderAt(Number(event.target.value) / 1000);
  });
  $("#speed").addEventListener("input", (event) => {
    playbackSpeed = Number(event.target.value);
    $("#speed-output").textContent = `${playbackSpeed.toFixed(2)}×`;
    if (frame != null) play();
  });
  $("#debug").addEventListener("change", (event) =>
    document
      .querySelectorAll(".stage")
      .forEach((stage) =>
        stage.classList.toggle("show-debug", event.target.checked),
      ),
  );
  $("#reduced").checked = matchMedia(
    "(prefers-reduced-motion: reduce)",
  ).matches;
  $("#reduced").addEventListener("change", (event) => {
    if (event.target.checked) pause();
  });
  for (const side of ["left", "right"])
    $("#touch-" + side).addEventListener("click", () => {
      touchSide = side;
      progress = 0;
      renderAt(0);
      play();
    });
  for (const stage of document.querySelectorAll(".stage"))
    stage.addEventListener("pointerdown", (event) => {
      const bounds = stage.getBoundingClientRect();
      touchSide =
        event.clientX < bounds.left + bounds.width / 2 ? "left" : "right";
      progress = 0;
      renderAt(0);
      play();
    });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) pause();
  });
  renderMilestones();
  renderAt(0, "idle");
  window.PerformanceV2Preview = {
    newRig,
    oldRig,
    get chosenPose() {
      return chosenPose;
    },
    get progress() {
      return progress;
    },
    get touchSide() {
      return touchSide;
    },
    renderAt,
    pause,
    play,
    timing,
  };
})();
