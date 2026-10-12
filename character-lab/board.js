(function () {
  "use strict";
  const art = window.XiaodaiArt;
  const labels = {
    front: ["正面", "两眼、两手、两脚与便签构成识别锚点"],
    left34: ["左 ¾", "远手缩后，远眼收窄，左颊轮廓前置"],
    right34: ["右 ¾", "重新绘制轮廓与层级，不是镜像动画"],
    leftSide: ["左侧", "一只可见眼，远手被身体遮挡"],
    rightSide: ["右侧", "侧面便签只见纸边，轮廓依旧圆润"],
    back: ["背面", "没有面部，也没有尾巴或尾状附件"]
  };
  const emotionLabels = {
    neutral: "平静", happy: "开心", curious: "好奇", confused: "疑惑", sleepy: "困倦", surprised: "惊讶", sad: "难过", determined: "坚定"
  };
  const poseLabels = {
    stand: ["站立", "稳定、开放"], notice: ["注意", "突然看见"], curious: ["探究", "向一侧靠近"], remind: ["提醒", "克制地举手"],
    encourage: ["鼓励", "邀请式张臂"], firm: ["坚定", "守住当前目标"], hop: ["轻跳", "抬脚离地"], celebrate: ["庆祝", "释放完成感"]
  };
  document.getElementById("hero-character").innerHTML = art.svgMarkup({ debugAnchors: true });
  const card = (title, caption, svg) => `<article class="character-card"><div class="art">${svg}</div><h3>${title}</h3><p>${caption}</p></article>`;
  document.getElementById("views").innerHTML = art.VIEWS.map(view => card(...labels[view], art.svgMarkup({ view }))).join("");
  document.getElementById("emotions").innerHTML = art.EMOTIONS.filter(emotion => emotion !== "yawning").map(emotion => card(emotionLabels[emotion], emotion, art.svgMarkup({ emotion }))).join("");
  document.getElementById("poses").innerHTML = art.POSES.map(pose => card(...poseLabels[pose], art.svgMarkup({ pose }))).join("");
})();
