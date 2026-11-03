/* 音乐：默认曲目 / 自选曲目两套歌单，互斥播放 */
(function () {
  "use strict";

  var KEY = "wz.music.v1";
  var DEFAULTS = ((window.MUSIC_TRACKS || {}).tracks || []).map(function (t) {
    return { file: t.file, title: t.title };
  });

  // 随包自带的"自选曲目"（放在 ../晚安温知怀-音乐/自选曲目/）
  var PRESET = ((window.MUSIC_CUSTOM || {}).tracks || []).map(function (t) {
    return { title: t.title, url: t.file };
  });

  var state = {
    mode: "default",      // default | custom
    playing: true,        // 默认开启
    shuffle: true,        // 默认随机
    repeat: "list",       // list | one
    index: 0,
    warned: false,        // 是否已提示过"在线播放会走流量"
    volume: 0.5,
    custom: PRESET.slice()
  };
  try {
    var raw = localStorage.getItem(KEY);
    if (raw) {
      var o = JSON.parse(raw);
      state.mode = o.mode === "custom" ? "custom" : "default";
      state.shuffle = o.shuffle !== false;
      state.repeat = o.repeat === "one" ? "one" : "list";
      state.index = typeof o.index === "number" ? o.index : 0;
      state.volume = typeof o.volume === "number" ? o.volume : 0.5;
      state.warned = o.warned === true;
      state.playing = o.playing !== false;
    }
  } catch (e) {}

  var audio = new Audio();
  audio.loop = false;
  var panel = null;
  var fileInput = null;
  var started = false;

  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify({
        mode: state.mode, playing: state.playing, shuffle: state.shuffle,
        repeat: state.repeat, index: state.index, volume: state.volume,
        warned: state.warned
      }));
    } catch (e) {}
  }

  function playlist() {
    return state.mode === "custom"
      ? state.custom.map(function (c) { return { file: c.url, title: c.title }; })
      : DEFAULTS;
  }

  function current() {
    var list = playlist();
    if (!list.length) return null;
    if (state.index < 0 || state.index >= list.length) state.index = 0;
    return list[state.index];
  }

  function play() {
    var t = current();
    if (!t) return;
    if (audio.src !== new URL(t.file, location.href).href) {
      audio.src = t.file;
    }
    audio.volume = state.volume;
    var p = audio.play();
    if (p && p.catch) p.catch(function () {});
    state.playing = true;
    save();
    render();
  }

  function pause() {
    audio.pause();
    state.playing = false;
    save();
    render();
  }

  function next(user) {
    var list = playlist();
    if (!list.length) return;
    if (state.shuffle) {
      var n = state.index;
      if (list.length > 1) {
        while (n === state.index) n = Math.floor(Math.random() * list.length);
      }
      state.index = n;
    } else {
      state.index = (state.index + 1) % list.length;
    }
    state.playing = true;
    play();
  }

  function prev() {
    var list = playlist();
    if (!list.length) return;
    state.index = (state.index - 1 + list.length) % list.length;
    play();
  }

  audio.addEventListener("ended", function () {
    if (state.repeat === "one") {
      audio.currentTime = 0;
      audio.play().catch(function () {});
      return;
    }
    next();
  });

  function setMode(mode) {
    if (mode === state.mode) return;
    audio.pause();
    state.mode = mode;
    state.index = 0;
    save();
    render();
    if (state.playing) play();
  }

  /* ---------- 面板 ---------- */

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function ensure() {
    if (panel) return panel;
    panel = el("div");
    panel.id = "music";
    document.body.appendChild(panel);

    panel.addEventListener("click", function (e) {
      var t = e.target;
      if (t.classList.contains("mz-close")) { close(); return; }
      var tab = t.getAttribute && t.getAttribute("data-mode");
      if (tab) { setMode(tab); return; }
      if (t.id === "mz-play") { state.playing ? pause() : play(); return; }
      if (t.id === "mz-next") { next(true); return; }
      if (t.id === "mz-prev") { prev(); return; }
      if (t.id === "mz-shuffle") {
        state.shuffle = !state.shuffle; save(); render(); return;
      }
      if (t.id === "mz-repeat") {
        state.repeat = state.repeat === "one" ? "list" : "one"; save(); render(); return;
      }
      if (t.id === "mz-warn-ok") {
        state.warned = true;
        save(); render();
        return;
      }
      if (t.id === "mz-add") {
        var input = panel.querySelector("#mz-file");
        if (input) input.click();
        return;
      }
      if (t.id === "mz-clear") {
        state.custom = PRESET.slice();
        state.index = 0;
        audio.pause();
        save(); render();
        return;
      }
      var idx = t.getAttribute && t.getAttribute("data-idx");
      if (idx != null) {
        state.index = parseInt(idx, 10);
        play();
      }
    });

    var file = el("input");
    fileInput = file;
    file.type = "file";
    file.accept = "audio/*";
    file.multiple = true;
    file.id = "mz-file";
    file.style.display = "none";
    file.addEventListener("change", function () {
      var files = Array.prototype.slice.call(file.files || []);
      files.forEach(function (f) {
        state.custom.push({ title: f.name.replace(/\.[^.]+$/, ""), url: URL.createObjectURL(f) });
      });
      file.value = "";
      if (state.custom.length) {
        state.mode = "custom";
        state.playing = false;
      }
      save(); render();
    });
    panel.appendChild(file);
    return panel;
  }

  function render() {
    ensure();
    var list = playlist();
    var cur = current();
    panel.innerHTML = "";
    if (fileInput) panel.appendChild(fileInput);

    var head = el("div", "mz-head");
    var t1 = el("button", "mz-tab" + (state.mode === "default" ? " on" : ""), "默认曲目");
    t1.setAttribute("data-mode", "default");
    var t2 = el("button", "mz-tab" + (state.mode === "custom" ? " on" : ""), "自选曲目");
    t2.setAttribute("data-mode", "custom");
    head.appendChild(t1);
    head.appendChild(t2);
    var closeBtn = el("button", "mz-close", "关闭");
    head.appendChild(closeBtn);
    panel.appendChild(head);

    var bar = el("div", "mz-bar");
    var playBtn = el("button", "", state.playing ? "暂停" : "播放");
    playBtn.id = "mz-play";
    var prevBtn = el("button", "", "上一首");
    prevBtn.id = "mz-prev";
    var nextBtn = el("button", "", "下一首");
    nextBtn.id = "mz-next";
    var shBtn = el("button", state.shuffle ? "on" : "", state.shuffle ? "随机 开" : "顺序");
    shBtn.id = "mz-shuffle";
    var rpBtn = el("button", state.repeat === "one" ? "on" : "", state.repeat === "one" ? "单曲循环" : "列表循环");
    rpBtn.id = "mz-repeat";
    [playBtn, prevBtn, nextBtn, shBtn, rpBtn].forEach(function (b) { bar.appendChild(b); });
    if (state.mode === "custom") {
      var addBtn = el("button", "", "添加歌曲");
      addBtn.id = "mz-add";
      bar.appendChild(addBtn);
      if (state.custom.length) {
        var clr = el("button", "", "清空");
        clr.id = "mz-clear";
        bar.appendChild(clr);
      }
    }
    panel.appendChild(bar);

    if (state.mode === "custom" && !state.warned && state.custom.length) {
      var warn = el("div", "mz-warn");
      warn.appendChild(el("span", "mz-warn-t",
        "自选曲目 " + state.custom.length + " 首，在线播放会走流量，建议连 Wi-Fi。"));
      var okBtn = el("button", "mz-ok", "知道了");
      okBtn.id = "mz-warn-ok";
      warn.appendChild(okBtn);
      panel.appendChild(warn);
    }

    var now = el("div", "mz-now", cur ? "正在播放：" + cur.title : "没有可播放的曲目");
    panel.appendChild(now);

    var body = el("div", "mz-list");
    if (!list.length) {
      body.appendChild(el("p", "mz-empty",
        state.mode === "custom" ? "还没有自选曲目。点“添加歌曲”从本地选文件。" : "没有找到默认曲目。"));
    }
    list.forEach(function (t, i) {
      var row = el("div", "mz-row" + (i === state.index ? " on" : ""));
      row.setAttribute("data-idx", String(i));
      row.appendChild(el("span", "mz-no", String(i + 1).padStart(2, "0")));
      row.appendChild(el("span", "mz-title", t.title));
      body.appendChild(row);
    });
    panel.appendChild(body);
  }

  function open() { ensure(); render(); panel.classList.add("open"); }
  function close() { if (panel) panel.classList.remove("open"); }

  function init() {
    ensure();
    // 首次手势后再真正开始播放（浏览器自动播放限制）
    var kick = function () {
      document.removeEventListener("pointerdown", kick);
      document.removeEventListener("keydown", kick);
      started = true;
      if (state.playing) play();
    };
    document.addEventListener("pointerdown", kick);
    document.addEventListener("keydown", kick);
  }

  window.MUSIC = {
    init: init,
    open: open,
    close: close,
    play: play,
    pause: pause,
    next: next,
    prev: prev,
    isPlaying: function () { return state.playing; },
    currentTitle: function () { var c = current(); return c ? c.title : ""; }
  };
})();
