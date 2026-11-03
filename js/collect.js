/* 收获系统：回忆碎片 / 物品 / 成就 + 图鉴面板 */
(function () {
  "use strict";

  var KEY = "wz.collect.v1";
  var X = window.EXTRAS || { memories: [], items: [], achievements: [] };

  var state = { items: {}, lost: {}, memories: {}, achievements: {}, cleared: false, unlocked: false };
  try {
    var raw = localStorage.getItem(KEY);
    if (raw) {
      var o = JSON.parse(raw);
      state.items = o.items || {};
      state.lost = o.lost || {};
      state.memories = o.memories || {};
      state.achievements = o.achievements || {};
      state.cleared = !!o.cleared;
      state.unlocked = !!o.unlocked;
    }
  } catch (e) {}

  function audioCue(name) {
    try { if (window.SFX) SFX.play(name); } catch (e) {}
  }

  function persist() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {}
  }

  var gainLayer = null;
  var panel = null;
  var viewer = null;
  var jumpTo = null;
  var curFrame = 0;
  var prevFrame = 0;
  var queue = [];
  var showing = false;

  function byFrame(list, frame) {
    return list.filter(function (it) { return it.frame === frame; });
  }

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function push(kind, title, sub, image, onClick) {
    queue.push({ kind: kind, title: title, sub: sub, image: image, onClick: onClick });
    if (!showing) next();
  }

  function next() {
    var item = queue.shift();
    if (!item) { showing = false; return; }
    showing = true;

    gainLayer.innerHTML = "";
    var card = el("div", "gain-card");
    if (item.image) {
      var img = el("img", "gain-img");
      img.src = item.image;
      card.appendChild(img);
    } else {
      card.appendChild(el("div", "gain-mark", "✦"));
    }
    card.appendChild(el("div", "gain-kind", item.kind));
    card.appendChild(el("div", "gain-title", item.title));
    if (item.sub) card.appendChild(el("div", "gain-sub", item.sub));
    gainLayer.appendChild(card);

    requestAnimationFrame(function () { gainLayer.classList.add("show"); });

    var t = window.setTimeout(function () { hide(item); }, 3200);
    function manual() {
      window.clearTimeout(t);
      gainLayer.removeEventListener("click", manual);
      hide(item);
    }
    gainLayer.addEventListener("click", manual);

    function hide(it) {
      gainLayer.classList.remove("show");
      window.setTimeout(function () {
        gainLayer.innerHTML = "";
        showing = false;
        if (it && it.onClick) it.onClick();
        next();
      }, 420);
    }
  }

  function gainItem(item) {
    if (state.items[item.id]) return;
    state.items[item.id] = 1;
    persist();
    if (window.SFX) SFX.play("gain");
    push("获取物品", item.name, item.desc);
  }

  function loseItem(item) {
    if (state.lost[item.id]) return;
    state.lost[item.id] = 1;
    persist();
    if (window.SFX) SFX.play("lose");
    push("失去物品", item.name, item.desc);
  }

  function gainMemory(m) {
    var key = m.file;
    if (state.memories[key]) return;
    state.memories[key] = 1;
    persist();
    if (window.SFX) SFX.play("memory");
    var locked = !state.cleared;
    if (m.noText) {
      push(
        "回忆碎片",
        "",
        (!state.cleared ? "记忆损失，暂时无法查看" : (!state.unlocked ? "记忆已修复，需要权限码" : "点开可以看")),
        locked ? "" : m.file,
        function () { if (!locked) openMemory(m); }
      );
      return;
    }
    push(
      "回忆碎片",
      m.excerpt || "",
      (!state.cleared ? "记忆损失，暂时无法查看" : (!state.unlocked ? "记忆已修复，需要权限码" : "点开可以看")),
      locked ? "" : m.file,
      function () { if (!locked) openMemory(m); }
    );
  }

  function gainAchievement(a) {
    if (state.achievements[a.id]) return;
    state.achievements[a.id] = 1;
    persist();
    if (window.SFX) SFX.play("achievement");
    push("达成成就", a.name, a.desc, a.image || "");
  }

  function onFrame(frame) {
    curFrame = frame;
    byFrame(X.achievements, frame).forEach(gainAchievement);
    if (prevFrame && prevFrame !== frame) flushFrame(prevFrame);
    prevFrame = frame;
  }

  var NORM_RE = /[\s\u3000，。、：；！？…—·“”‘’《》（）()\[\]「」.,!?;:'"]+/g;

  function normText(s) {
    return (s || "").replace(NORM_RE, "");
  }

  // 记忆碎片：只在读到它挂的那一句时弹
  // 回忆碎片：只在小说里“图片上方那一句”读到的时候弹，一张图一次。
  // 两句共用一个锚句时（全片只有一处），合成一张卡一起收。
  function gainMemorySet(list) {
    if (!list.length) return;
    list.forEach(function (m) { state.memories[m.file] = 1; });
    persist();
    if (window.SFX) SFX.play("memory");
    var first = list[0];
    var n = list.length;
    var locked = !state.cleared;
    var desc = locked ? "记忆损失，暂时无法查看"
      : (!state.unlocked ? "记忆已修复，需要权限码"
        : (n > 1 ? "这一处有 " + n + " 张，可在「回忆」里逐张查看" : "点开可以看"));
    push(
      "回忆碎片",
      n > 1 ? "共 " + n + " 张" : (first.excerpt || ""),
      desc,
      locked ? "" : first.file,
      function () { if (!locked && window.COLLECT) COLLECT.open("memories"); }
    );
  }

  function pendingMemory(frame) {
    return X.memories.filter(function (m) {
      return m.frame == frame && !state.memories[m.file];
    });
  }

  function onLine(text) {
    if (!text) return;
    var b = normText(text);
    if (!b) return;
    var pool = pendingMemory(curFrame);
    if (!pool.length) return;
    var hits = pool.filter(function (m) {
      var a = normText(m.anchor);
      if (!a) return false;
      return b.indexOf(a) === 0 || b === a || (b.length >= 8 && a.indexOf(b) === 0);
    });
    if (hits.length) gainMemorySet(hits);
  }

  // 兜底：换到下一帧时，把上一帧还没触发的补收（正常情况下不会发生）
  function flushFrame(frame) {
    var rest = pendingMemory(frame);
    if (rest.length && state.cleared) gainMemorySet(rest);
  }

  function grant(id) {
    X.items.forEach(function (it) { if (it.id === id) gainItem(it); });
  }

  function take(id) {
    if (!X.lost) return;
    if (id === "weiquan") loseItem(X.lost);
  }

  function openMemory(m) {
    if (!viewer) return;
    viewer.innerHTML = "";
    var img = el("img");
    img.src = m.file;
    viewer.appendChild(img);
    var cap = el("div", "mv-cap", m.excerpt || m.caption || "");
    viewer.appendChild(cap);
    viewer.classList.add("show");
    viewer.onclick = function () { viewer.classList.remove("show"); };
  }

  function ensurePanel() {
    if (panel) return panel;
    panel = el("div");
    panel.id = "collect";
    panel.innerHTML =
      '<div class="cl-head">' +
      '<button class="cl-tab" data-tab="items">物品</button>' +
      '<button class="cl-tab" data-tab="memories">回忆</button>' +
      '<button class="cl-tab" data-tab="achievements">成就</button>' +
      '<button class="cl-close" type="button">关闭</button>' +
      "</div><div class=\"cl-body\"></div>";
    document.body.appendChild(panel);

    panel.addEventListener("click", function (e) {
      if (e.target.classList.contains("cl-close")) { close(); return; }
      var tab = e.target.getAttribute && e.target.getAttribute("data-tab");
      if (tab) { render(tab); }
    });
    return panel;
  }

  function render(tab) {
    ensurePanel();
    panel.querySelectorAll(".cl-tab").forEach(function (b) {
      b.classList.toggle("on", b.getAttribute("data-tab") === tab);
    });
    var body = panel.querySelector(".cl-body");
    body.innerHTML = "";

    if (tab === "items") {
      var ids = Object.keys(state.items);
      if (!ids.length) body.appendChild(el("p", "cl-empty", "还没有拿到任何东西。"));
      X.items.forEach(function (it) {
        if (!state.items[it.id]) return;
        var row = el("div", "cl-row");
        row.appendChild(el("div", "cl-name", it.name));
        row.appendChild(el("div", "cl-desc", it.desc));
        body.appendChild(row);
      });
      if (state.lost && state.lost[X.lost.id]) {
        var row2 = el("div", "cl-row lost");
        row2.appendChild(el("div", "cl-name", X.lost.name));
        row2.appendChild(el("div", "cl-desc", X.lost.desc));
        body.appendChild(row2);
      }
    }

    if (tab === "memories") {
      if (!state.cleared) {
        body.appendChild(el("p", "cl-empty", "记忆损失，暂时无法查看。通关之后再来看看。"));
        return;
      }
      if (!state.unlocked) {
        var box = el("div", "cl-code");
        box.appendChild(el("div", "cl-code-t", "记忆已修复。"));
        box.appendChild(el("div", "cl-code-s", "输入权限码以读取这些碎片。"));
        var input = el("input");
        input.type = "password";
        input.id = "cl-code-input";
        input.placeholder = "权限码";
        input.setAttribute("inputmode", "numeric");
        input.maxLength = 16;
        var btn = el("button", "cl-code-btn", "解锁");
        btn.id = "cl-code-btn";
        var tip = el("div", "cl-code-tip", "");
        tip.id = "cl-code-tip";
        box.appendChild(input);
        box.appendChild(btn);
        box.appendChild(tip);
        body.appendChild(box);
        var tryUnlock = function () {
          var v = (input.value || "").replace(/\s+/g, "");
          if (v === "07090624") {
            state.unlocked = true;
            persist();
            audioCue("achievement");
            render("memories");
          } else {
            tip.textContent = "权限码不对。";
            input.value = "";
            input.focus();
          }
        };
        btn.addEventListener("click", tryUnlock);
        input.addEventListener("keydown", function (e) {
          if (e.key === "Enter") { e.preventDefault(); e.stopPropagation(); tryUnlock(); }
        });
        setTimeout(function () { input.focus(); }, 60);
        return;
      }
      var grid = el("div", "cl-grid");
      X.memories.forEach(function (m) {
        if (!state.memories[m.file]) return;
        var cell = el("div", "cl-cell");
        var img = el("img");
        img.src = m.file;
        img.loading = "lazy";
        cell.appendChild(img);
        cell.appendChild(el("div", "cl-cap", m.caption || ""));
        cell.addEventListener("click", function () { openMemory(m); });
        grid.appendChild(cell);
      });
      body.appendChild(grid);
    }

    if (tab === "achievements") {
      X.achievements.forEach(function (a) {
        var got = !!state.achievements[a.id];
        var row = el("div", "cl-row" + (got ? "" : " off"));
        if (a.image && got) {
          var img = el("img", "cl-thumb");
          img.src = a.image;
          row.appendChild(img);
        }
        row.appendChild(el("div", "cl-name", got ? a.name : "未达成"));
        row.appendChild(el("div", "cl-desc", got ? a.desc : "　"));
        body.appendChild(row);
      });
    }
  }

  function open(tab) {
    ensurePanel();
    render(tab || "items");
    panel.classList.add("open");
  }

  function close() { if (panel) panel.classList.remove("open"); }

  function init(opts) {
    jumpTo = opts && opts.jumpTo;
    gainLayer = document.getElementById("gain");
    viewer = document.getElementById("memory-view");
    if (viewer) viewer.addEventListener("click", function () { viewer.classList.remove("show"); });
  }

  window.COLLECT = {
    init: init,
    onFrame: onFrame, onLine: onLine,
    grant: grant,
    take: take,
    award: function (id) {
      X.achievements.forEach(function (a) { if (a.id === id) gainAchievement(a); });
    },
    open: open,
    close: close,
    setCleared: function () { state.cleared = true; persist(); },
    isCleared: function () { return state.cleared; },
    isUnlocked: function () { return state.unlocked; },
    reset: function () { state = { items: {}, lost: {}, memories: {}, achievements: {}, cleared: false, unlocked: false }; persist(); }
  };
})();
