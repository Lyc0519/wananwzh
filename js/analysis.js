(function () {
  var panel = null;

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function ensurePanel() {
    if (panel) return panel;
    panel = el("div", "an-panel");
    panel.id = "analysis";
    panel.innerHTML =
      '<div class="an-inner">' +
      '  <button class="an-close" id="an-close" aria-label="关闭">×</button>' +
      '  <div class="an-head"><span class="an-kicker">解析</span><h2 class="an-title">剧情解析</h2></div>' +
      '  <div class="an-body"></div>' +
      "</div>";
    document.body.appendChild(panel);
    panel.querySelector("#an-close").addEventListener("click", function (e) {
      e.stopPropagation();
      close();
    });
    panel.addEventListener("click", function (e) {
      if (e.target === panel) close();
    });
    return panel;
  }

  function render() {
    ensurePanel();
    var body = panel.querySelector(".an-body");
    body.innerHTML = "";
    var cleared = false;
    try { cleared = !!(window.COLLECT && COLLECT.isCleared()); } catch (e) {}

    var A = window.ANALYSIS || { shallow: [], deep: [], eggs: [] };

    var shallow = el("div", "an-sec");
    shallow.appendChild(el("h3", "an-h", cleared ? "写在前面" : "先知道这么多"));
    (A.shallow || []).forEach(function (t) {
      shallow.appendChild(el("p", "an-p", t));
    });
    body.appendChild(shallow);

    if (!cleared) {
      var lock = el("div", "an-lock");
      lock.appendChild(el("div", "an-lock-t", "通关之后，这一页会展开。"));
      lock.appendChild(el("div", "an-lock-s", "完整的解析、九章题眼、伏笔与七个彩蛋，都在后面。"));
      body.appendChild(lock);
      return;
    }

    (A.deep || []).forEach(function (sec) {
      var s = el("div", "an-sec");
      s.appendChild(el("h3", "an-h", sec.h));
      if (sec.p) {
        sec.p.forEach(function (t) { s.appendChild(el("p", "an-p", t)); });
      }
      if (sec.table) {
        var tb = el("div", "an-table");
        sec.table.forEach(function (row) {
          var r = el("div", "an-row");
          r.appendChild(el("div", "an-cell k", row[0]));
          r.appendChild(el("div", "an-cell v", row[1]));
          tb.appendChild(r);
        });
        s.appendChild(tb);
      }
      body.appendChild(s);
    });

    var eggs = el("div", "an-sec an-eggs");
    eggs.appendChild(el("h3", "an-h", "十、彩蛋"));
    var got = 0;
    try {
      var raw = JSON.parse(localStorage.getItem("wz.analysis.v1") || "{}");
      got = raw.eggs || 0;
    } catch (e) {}
    (A.eggs || []).forEach(function (eg, i) {
      var row = el("div", "an-egg" + (i < got ? " on" : ""));
      row.appendChild(el("div", "an-egg-n", String(i + 1).padStart(2, "0")));
      var tx = el("div", "an-egg-tx");
      tx.appendChild(el("div", "an-egg-t", eg.t));
      tx.appendChild(el("div", "an-egg-d", eg.d));
      row.appendChild(tx);
      eggs.appendChild(row);
    });
    body.appendChild(eggs);

    if (got < (A.eggs || []).length) {
      var more = el("button", "an-more", "点亮下一个彩蛋");
      more.addEventListener("click", function (e) {
        e.stopPropagation();
        got += 1;
        try { localStorage.setItem("wz.analysis.v1", JSON.stringify({ eggs: got })); } catch (err) {}
        try { if (window.SFX) SFX.play("memory"); } catch (err) {}
        render();
        body.scrollTop = body.scrollHeight;
      });
      eggs.appendChild(more);
    }
  }

  function open() {
    ensurePanel();
    render();
    panel.classList.add("open");
  }

  function close() { if (panel) panel.classList.remove("open"); }

  window.ANALYSIS_UI = { open: open, close: close };
})();
