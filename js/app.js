/* 晚安，温知怀 —— 单页叙事播放器 */
(function () {
  "use strict";

  var SAVE_KEY = "wz.save.v1";

  var el = {
    far: document.getElementById("far"),
    near: document.getElementById("near"),
    lineBox: document.getElementById("line-box"),
    hint: document.getElementById("hint"),
    progress: document.getElementById("progress"),
    chapterCard: document.getElementById("chapter-card"),
    chapters: document.getElementById("chapters"),
    chapterList: document.getElementById("chapter-list"),
    title: document.getElementById("title"),
    start: document.getElementById("start-btn"),
    btnChapters: document.getElementById("btn-chapters"),
    btnMusic: document.getElementById("btn-music"),
    btnPrev: document.getElementById("btn-prev"),
    btnReset: document.getElementById("btn-reset"),
    btnSound: document.getElementById("btn-sound"),
    finale: document.getElementById("finale")
  };

  var story = null;
  var steps = [];      // {kind:'chapter'|'line', ...}
  var stepIndex = 0;
  var typing = null;   // {timer, full, node}
  var currentFrame = -1;
  var busyChapter = false;
  var finaleRunning = false;
  var flashbackDone = false;
  var autoTimer = null;
  var chapterTimer = null;

  function imgPath(frame) {
    return "images/P" + String(frame).padStart(2, "0") + ".webp";
  }

  function buildSteps(data) {
    var out = [];
    var lastChapter = -1;
    data.scenes.forEach(function (scene) {
      if (scene.chapter !== lastChapter) {
        lastChapter = scene.chapter;
        out.push({ kind: "chapter", chapter: scene.chapter, scene: scene });
      }
      var lines = scene.lines && scene.lines.length ? scene.lines : [{ t: "……", m: "" }];
      lines.forEach(function (line, i) {
        var text = (typeof line === "string") ? line : (line.t || "");
        var mode = (typeof line === "string") ? "" : (line.m || "");
        out.push({ kind: "line", scene: scene, line: line, text: text, mode: mode, auto: !!(line && line.auto), first: i === 0 });
      });
    });
    return out;
  }

  function chapterMeta(idx) {
    return story.chapters[idx] || { label: "", name: "第" + (idx + 1) + "章" };
  }

  function setFrame(frame, instant) {
    if (frame === currentFrame && !instant) return;
    currentFrame = frame;
    var url = "url(\"" + imgPath(frame) + "\")";
    if (instant) {
      el.near.style.transition = "none";
      el.far.style.transition = "none";
      el.near.style.backgroundImage = url;
      el.far.style.opacity = 0;
      // 强制回流后再恢复过渡
      void el.near.offsetWidth;
      el.near.style.transition = "";
      el.far.style.transition = "";
      return;
    }
    el.far.style.backgroundImage = el.near.style.backgroundImage;
    el.far.style.opacity = 1;
    el.near.style.backgroundImage = url;
    el.near.classList.remove("animating");
    void el.near.offsetWidth;
    el.near.classList.add("animating");
    window.setTimeout(function () { el.far.style.opacity = 0; }, 60);
  }

  function typeLine(text, done, speed) {
    stopTyping();
    el.lineBox.textContent = "";
    var i = 0;
    var node = el.lineBox;
    var per = speed || 26;
    var timer = window.setInterval(function () {
      i += 1;
      node.textContent = text.slice(0, i);
      if (i >= text.length) {
        window.clearInterval(timer);
        typing = null;
        if (done) done();
      }
    }, per);
    typing = {
      full: text,
      finish: function () {
        window.clearInterval(timer);
        node.textContent = text;
        typing = null;
        if (done) done();
      }
    };
  }

  function stopTyping() {
    if (typing) {
      typing.finish();
      typing = null;
    }
  }

  function renderStep() {
    var step = steps[stepIndex];
    if (!step) return;

    el.progress.style.width = ((stepIndex / Math.max(1, steps.length - 1)) * 100).toFixed(2) + "%";

    if (step.kind === "chapter") {
      if (chapterTimer) { window.clearTimeout(chapterTimer); chapterTimer = null; }
      busyChapter = true;
      document.body.classList.remove("blackout");
      var meta = chapterMeta(step.chapter);
      el.chapterCard.querySelector(".num").textContent = meta.label || "";
      var nameEl = el.chapterCard.querySelector(".name");
      var title = meta.name || "";
      nameEl.textContent = title;
      nameEl.className = "name" + (title.length > 12 ? " xlong" : (title.length > 9 ? " long" : ""));
      el.chapterCard.querySelector(".sub").textContent = "";
      el.chapterCard.classList.add("show");
      el.lineBox.textContent = "";
      el.hint.style.opacity = 0;
      setFrame(step.scene.frame, false);
      chapterTimer = window.setTimeout(function () {
        chapterTimer = null;
        el.chapterCard.classList.remove("show");
        busyChapter = false;
        if (stepIndex < steps.length - 1) {
          stepIndex += 1;
          renderStep();
        }
      }, 2400);
      return;
    }

    var isBlack = step.mode === "black";
    document.body.classList.toggle("blackout", isBlack);

    var frameChanged = !!step.first || currentFrame !== step.scene.frame;

    if (window.AUDIO && frameChanged) {
      try { AUDIO.frame(step.scene.frame, step.scene.chapter); } catch (e) {}
    }
    if (window.COLLECT && frameChanged) {
      try { COLLECT.onFrame(step.scene.frame); } catch (e) {}
    }
    if (window.SFX && frameChanged) {
      try { SFX.onFrame(step.scene.frame); } catch (e) {}
    }
    if (window.COLLECT) {
      try {
        if (step.line && step.line.give) COLLECT.grant(step.line.give);
        if (step.line && step.line.take) COLLECT.take(step.line.take);
        if (step.line && step.line.t) COLLECT.onLine(step.line.t);
      } catch (e) {}
    }

    if (!isBlack) {
      if (step.first || currentFrame !== step.scene.frame) {
        setFrame(step.scene.frame, false);
      }
    }
    el.hint.style.opacity = 0;
    if (autoTimer) { window.clearTimeout(autoTimer); autoTimer = null; }
    typeLine(step.text, function () {
      el.hint.style.opacity = 1;
      // 拆开的四季独白：前三屏自己往下走
      if (step.auto) {
        autoTimer = window.setTimeout(function () {
          autoTimer = null;
          if (typing) return;
          next();
        }, 2600);
      }
    }, isBlack ? 55 : 26);
  }

  function next() {
    if (busyChapter) return;
    if (typing) { stopTyping(); return; }
    if (stepIndex >= steps.length - 1) {
      // “记得和她说晚安”之后：先走一段回忆快闪，再进结局
      if (window.FLASHBACK && !flashbackDone && !finaleRunning) {
        flashbackDone = true;
        FLASHBACK.play(function () { showEnding(); });
        return;
      }
      showEnding();
      return;
    }
    stepIndex += 1;
    save();
    // 章节卡步骤自己会往下走
    if (steps[stepIndex].kind === "chapter") { renderStep(); return; }
    renderStep();
  }

  function showEnding() {
    if (finaleRunning) return;
    finaleRunning = true;
    document.body.classList.remove("blackout");

    // 成就：该访客已删除痕迹（配图是那张截图）
    if (window.COLLECT) { try { COLLECT.award("erased"); COLLECT.award("ending"); } catch (e) {} }

    var fin = el.finale;
    fin.classList.add("show");

    // 成就配图：文档里最后那张“该访客删除了痕迹”的截图
    try {
      var X = window.EXTRAS || {};
      var ach = (X.achievements || []).filter(function (a) { return a.id === "erased"; })[0];
      var img = fin.querySelector(".fin-img");
      if (img && ach && ach.image) {
        img.src = ach.image;
        img.style.display = "block";
      } else if (img) {
        img.style.display = "none";
      }
    } catch (e) {}

    // 1) 画面淡出，出成就
    window.setTimeout(function () {
      fin.classList.add("state-card");
    }, 3600);

    // 2) 黑屏，问玩家来自什么时候
    window.setTimeout(function () {
      fin.classList.remove("state-card");
      fin.classList.add("state-ask");
      var input = document.getElementById("year-input");
      if (input) { try { input.focus(); } catch (e) {} }
    }, 7400);
  }

  function finaleToLast() {
    var fin = el.finale;
    fin.classList.remove("state-ask");
    fin.classList.add("state-last");

    var box = fin.querySelector(".fin-line");
    var hint = fin.querySelector(".fin-hint");
    var full = "世上没有后悔药，请珍惜眼前人，记得和Ta说晚安哦。";

    // “晚”可点：wǎn → wan → 我爱你
    box.innerHTML = "";
    var i = 0;
    var timer = window.setInterval(function () {
      i += 1;
      var shown = full.slice(0, i);
      box.textContent = shown;
      if (i >= full.length) {
        window.clearInterval(timer);
        renderFinalLine(box, hint, full);
      }
    }, 90);
  }

  function renderFinalLine(box, hint, full) {
    var idx = full.indexOf("晚");
    box.innerHTML = "";
    if (idx < 0) { box.textContent = full; return; }
    box.appendChild(document.createTextNode(full.slice(0, idx)));
    var span = document.createElement("span");
    span.className = "clickable";
    span.textContent = "晚";
    box.appendChild(span);
    box.appendChild(document.createTextNode(full.slice(idx + 1)));

    var gloss = document.createElement("span");
    gloss.className = "gloss";
    gloss.textContent = "wǎn → wan → 我爱你";
    box.appendChild(gloss);

    span.addEventListener("click", function (e) {
      e.stopPropagation();
      gloss.classList.add("show");
    });
    window.setTimeout(function () { hint.classList.add("show"); }, 1200);
  }

  function prev() {
    if (busyChapter) return;
    if (stepIndex <= 0) return;
    stepIndex -= 1;
    while (stepIndex > 0 && steps[stepIndex].kind === "chapter") stepIndex -= 1;
    save();
    renderStep();
  }

  function save() {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify({ step: stepIndex })); } catch (e) {}
  }

  function loadSave() {
    try {
      var raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return null;
      var obj = JSON.parse(raw);
      if (typeof obj.step === "number" && obj.step >= 0) return obj.step;
    } catch (e) {}
    return null;
  }

  function jumpToChapter(chapterIdx) {
    if (chapterTimer) { window.clearTimeout(chapterTimer); chapterTimer = null; }
    busyChapter = false;
    el.chapterCard.classList.remove("show");

    var target = -1;
    for (var i = 0; i < steps.length; i++) {
      if (steps[i].kind === "chapter" && steps[i].chapter === chapterIdx) { target = i; break; }
    }
    if (target < 0) {
      for (var j = 0; j < steps.length; j++) {
        if (steps[j].kind === "line" && steps[j].scene.chapter === chapterIdx) { target = j; break; }
      }
    }
    if (target >= 0) stepIndex = target;

    closeChapters();
    startGame();
    renderStep();
  }

  function buildChapterList() {
    el.chapterList.innerHTML = "";
    story.chapters.forEach(function (c, i) {
      var row = document.createElement("div");
      row.className = "row";
      row.innerHTML = '<span class="idx">' + (c.label || String(i).padStart(2, "0")) + "</span>" +
        '<span class="nm">' + (c.name || "") + "</span>";
      row.addEventListener("click", function () { jumpToChapter(i); });
      el.chapterList.appendChild(row);
    });
  }

  function openChapters() { el.chapters.classList.add("open"); }
  function closeChapters() { el.chapters.classList.remove("open"); }

  function preload(from) {
    for (var i = from; i < Math.min(steps.length, from + 4); i++) {
      if (steps[i].kind === "line") {
        var img = new Image();
        img.src = imgPath(steps[i].scene.frame);
      }
    }
  }

  function startGame() {
    el.title.classList.add("hidden");
    el.chapters.classList.remove("open");
  }

  function resetAll() {
    try {
      localStorage.removeItem("wz.save.v1");
      localStorage.removeItem("wz.collect.v1");
    } catch (e) {}
    if (window.COLLECT) { try { COLLECT.reset(); } catch (e) {} }
    stepIndex = 0;
    location.reload();
  }

  function init() {
    if (window.STORY) {
      boot(window.STORY);
      return;
    }
    fetch("data/story.json")
      .then(function (r) { return r.json(); })
      .then(boot)
      .catch(function (err) {
        el.lineBox.textContent = "数据加载失败：" + err.message;
      });
  }

  function boot(data) {
    story = data;
    steps = buildSteps(story);
    buildChapterList();

    var saved = loadSave();
    var hasSave = saved !== null && saved > 0;
    el.start.textContent = hasSave ? "继续" : "进入房间";
    stepIndex = hasSave ? saved : 0;

    // 调试用：index.html#f=13 直接从 P13 开头看
    var m = /f=(\d{1,2})/.exec(location.hash || "");
    if (m) {
      var want = parseInt(m[1], 10);
      for (var i = 0; i < steps.length; i++) {
        if (steps[i].kind === "line" && steps[i].scene.frame === want) { stepIndex = i; break; }
      }
    }

    // 标题页背景
    el.title.style.backgroundImage = 'url("images/room.webp")';
    setFrame(story.scenes[0].frame, true);

    el.start.addEventListener("click", function () {
      if (window.AUDIO) { try { AUDIO.unlock(); } catch (e) {} }
      startGame();
      renderStep();
      preload(stepIndex);
    });

    if (el.btnSound) {
      el.btnSound.textContent = (window.AUDIO && AUDIO.isMuted()) ? "声音 关" : "声音 开";
      el.btnSound.addEventListener("click", function (e) {
        e.stopPropagation();
        if (!window.AUDIO) return;
        var nowMuted = AUDIO.toggle();
        if (window.SFX) SFX.setMuted(nowMuted);
        el.btnSound.textContent = nowMuted ? "声音 关" : "声音 开";
      });
    }

    function unlockOnce() {
      if (window.AUDIO) { try { AUDIO.unlock(); } catch (e) {} }
      document.removeEventListener("pointerdown", unlockOnce);
      document.removeEventListener("keydown", unlockOnce);
    }
    document.addEventListener("pointerdown", unlockOnce);
    document.addEventListener("keydown", unlockOnce);
    if (window.MUSIC) { try { MUSIC.init(); } catch (e) {} }

    el.btnChapters.addEventListener("click", function (e) {
      e.stopPropagation();
      openChapters();
    });

    if (window.COLLECT) {
      COLLECT.init({
        jumpTo: function (frame) {
          for (var i = 0; i < steps.length; i++) {
            if (steps[i].kind === "line" && steps[i].scene.frame === frame) { stepIndex = i; break; }
          }
          COLLECT.close();
          startGame();
          renderStep();
        }
      });
      var ba = document.getElementById("btn-analysis");
      if (ba) ba.addEventListener("click", function (e) {
        e.stopPropagation();
        if (window.ANALYSIS_UI) ANALYSIS_UI.open();
      });
      var bc = document.getElementById("btn-collect");
      var bm = document.getElementById("btn-memories");
      if (bc) bc.addEventListener("click", function (e) { e.stopPropagation(); COLLECT.open("items"); });
      if (bm) bm.addEventListener("click", function (e) { e.stopPropagation(); COLLECT.open("memories"); });
    }
    if (el.btnPrev) {
      el.btnPrev.addEventListener("click", function (e) {
        e.stopPropagation();
        prev();
      });
    }

    if (el.btnMusic) {
      el.btnMusic.addEventListener("click", function (e) {
        e.stopPropagation();
        if (window.MUSIC) MUSIC.open();
      });
    }

    if (el.btnReset) {
      var armed = false;
      var armTimer = null;
      el.btnReset.addEventListener("click", function (e) {
        e.stopPropagation();
        if (!armed) {
          armed = true;
          el.btnReset.textContent = "确认重置？";
          el.btnReset.classList.add("danger");
          armTimer = window.setTimeout(function () {
            armed = false;
            el.btnReset.textContent = "重置";
            el.btnReset.classList.remove("danger");
          }, 4000);
          return;
        }
        window.clearTimeout(armTimer);
        resetAll();
      });
    }

    document.getElementById("frame-wrap").addEventListener("click", function (e) {
      if (e.target.closest("#toolbar") || e.target.closest("#chapters") || e.target.closest("#title")) return;
      if (el.chapters.classList.contains("open")) { closeChapters(); return; }
      next();
    });

    document.addEventListener("keydown", function (e) {
      if (finaleRunning) {
        if (e.key === "Enter") {
          var askVisible = el.finale.classList.contains("state-ask");
          if (askVisible) { e.preventDefault(); finaleToLast(); }
        }
        return;
      }
      if (e.key === " " || e.key === "Enter" || e.key === "ArrowRight") {
        e.preventDefault();
        if (!el.title.classList.contains("hidden")) { startGame(); renderStep(); return; }
        next();
      } else if (e.key === "ArrowLeft") {
        prev();
      } else if (e.key === "Escape") {
        openChapters();
      }
    });

    // 结局：确认年份 → 最后一行；点击 → 回到标题
    var okBtn = document.getElementById("year-ok");
    if (okBtn) okBtn.addEventListener("click", function (e) { e.stopPropagation(); finaleToLast(); });
    var yearInput = document.getElementById("year-input");
    if (yearInput) {
      yearInput.addEventListener("keydown", function (e) {
        e.stopPropagation();
        if (e.key === "Enter") { e.preventDefault(); finaleToLast(); }
      });
    }
    if (el.finale) {
      el.finale.addEventListener("click", function () {
        if (!el.finale.classList.contains("state-last")) return;
        el.finale.classList.remove("show", "state-last");
        finaleRunning = false;
        if (window.COLLECT) { try { COLLECT.setCleared(); } catch (e) {} }
        stepIndex = 0;
        save();
        el.title.classList.remove("hidden");
        el.start.textContent = "重新开始";
      });
    }
  }

  init();
})();
