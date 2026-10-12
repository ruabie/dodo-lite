(function () {
  "use strict";
  const $ = selector => document.querySelector(selector);
  const emotions = { neutral: "平静", happy: "开心", curious: "好奇", confused: "疑惑", sleepy: "困倦", surprised: "惊讶", sad: "难过", determined: "坚定" };
  const actions = { notice: "注意到你", tapReact: "触碰回应", peek: "探头张望", hop: "轻跳", celebrate: "庆祝", encourage: "鼓励", remind: "温和提醒", yawn: "打哈欠", returnToIdle: "回到待机" };
  const character = DodoCharacter({ mount: $("#character"), state: "calm", size: 220, interactive: true, idle: true, label: "小待实时角色" });
  $("#emotions").innerHTML = Object.entries(emotions).map(([name, label]) => `<button type="button" data-emotion="${name}" class="${name === "neutral" ? "selected" : ""}">${label}</button>`).join("");
  $("#actions").innerHTML = Object.entries(actions).map(([name, label]) => `<button type="button" data-action="${name}">${label}</button>`).join("");
  function update() {
    $("#stateValue").textContent = character.state;
    $("#emotionValue").textContent = character.emotion;
    $("#actionValue").textContent = character.action;
    $("#gazeValue").textContent = `${character.gazeCurrent.x.toFixed(1)} / ${character.gazeCurrent.y.toFixed(1)}`;
    $("#idleValue").textContent = character.idleEnabled ? "on" : "off";
  }
  $("#character").addEventListener("dodochange", update);
  $("#emotions").addEventListener("click", event => {
    const button = event.target.closest("button[data-emotion]");
    if (!button) return;
    character.setEmotion(button.dataset.emotion);
    $("#emotions").querySelectorAll("button").forEach(node => node.classList.toggle("selected", node === button));
    update();
  });
  $("#actions").addEventListener("click", event => {
    const button = event.target.closest("button[data-action]");
    if (!button) return;
    character.playAction(button.dataset.action);
    update();
  });
  $("#idleToggle").addEventListener("change", event => character.setIdleEnabled(event.target.checked));
  $("#gazeToggle").addEventListener("change", update);
  $("#anchorToggle").addEventListener("change", event => character.setDebugAnchors(event.target.checked));
  $("#speed").addEventListener("input", event => { character.setSpeed(event.target.value); $("#speedValue").textContent = `${Number(event.target.value).toFixed(2)}×`; });
  $("#elasticity").addEventListener("input", event => { character.setElasticity(event.target.value); $("#elasticityValue").textContent = `${Number(event.target.value).toFixed(2)}×`; });
  $(".stage").addEventListener("pointermove", event => { if ($("#gazeToggle").checked) character.setGazeTarget(event.clientX, event.clientY); });
  $(".stage").addEventListener("pointerleave", () => { character.gazeUntil = 0; });
  document.querySelectorAll("[data-background]").forEach(button => button.addEventListener("click", () => {
    $("#stage").className = `stage background-${button.dataset.background}`;
    document.querySelectorAll("[data-background]").forEach(node => node.classList.toggle("selected", node === button));
  }));
  document.querySelectorAll("[data-size]").forEach(button => button.addEventListener("click", () => {
    character.el.style.setProperty("--size", `${button.dataset.size}px`);
    document.querySelectorAll("[data-size]").forEach(node => node.classList.toggle("selected", node === button));
  }));
  $("#reset").addEventListener("click", () => {
    character.setEmotion("neutral");
    character.setSpeed(1); character.setElasticity(1); character.setIdleEnabled(true);
    character.setDebugAnchors(false); character.resetToIdle();
    character.el.style.setProperty("--size", "220px");
    $("#stage").className = "stage background-cream";
    document.querySelectorAll("[data-size]").forEach(node => node.classList.toggle("selected", node.dataset.size === "220"));
    document.querySelectorAll("[data-background]").forEach(node => node.classList.toggle("selected", node.dataset.background === "cream"));
    character.gazeUntil = 0;
    $("#speed").value = $("#elasticity").value = 1;
    $("#speedValue").textContent = $("#elasticityValue").textContent = "1.00×";
    $("#idleToggle").checked = $("#gazeToggle").checked = true;
    $("#anchorToggle").checked = false;
    $("#emotions").querySelectorAll("button").forEach(node => node.classList.toggle("selected", node.dataset.emotion === "neutral"));
    update();
  });
  // The readout is a debugging aid; keep it cheap and stop when the page is hidden.
  let readoutTimer = setInterval(update, 200);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) { clearInterval(readoutTimer); readoutTimer = null; }
    else if (!readoutTimer) readoutTimer = setInterval(update, 200);
  });
  update();
})();
