/* 结尾回忆快闪：把房间之外的插画 + 模糊的回忆碎片，由慢到快切一遍，最后收黑。
   用法：FLASHBACK.play(function () { ... }); */
(function () {
  "use strict";

  // 房间里的那些帧不进快闪（P01–P07、P13、P46–P54）
  var ROOM = { 1: 1, 2: 1, 3: 1, 4: 1, 5: 1, 6: 1, 7: 1, 13: 1, 46: 1, 47: 1, 48: 1, 49: 1, 50: 1, 51: 1, 52: 1, 53: 1, 54: 1 };

  var D0 = 620;      // 第一刀，毫秒
  var D1 = 58;       // 最后一刀
  var CUTS = 50;     // 总刀数
  var BLACK_HOLD = 700;

  var layer = null;
  var flash = null;
  var running = false;
  var audio = null;

  function pad(n) { return n < 10 ? "0" + n : "" + n; }

  function buildList() {
    var frames = [];
    for (var f = 1; f <= 54; f++) {
      if (!ROOM[f]) frames.push("images/P" + pad(f) + ".webp");
    }
    var mems = [];
    var X = window.EXTRAS || {};
    (X.memories || []).forEach(function (m) { if (m.file) mems.push(m.file); });

    // 交替取：一张插画、一张碎片，让“回忆”的质感一层层盖上来
    var out = [];
    var i = 0, j = 0;
    while (out.length < CUTS && (i < frames.length || j < mems.length)) {
      if (i < frames.length) out.push({ src: frames[i++], blur: 0 });
      if (out.length >= CUTS) break;
      if (j < mems.length) out.push({ src: mems[j++], blur: 1 });
      if (out.length >= CUTS) break;
    }
    return out;
  }

  function ensureDom() {
    if (layer) return;
    var wrap = document.createElement("div");
    wrap.id = "flashback";
    wrap.innerHTML = '<div class="fb-stage"></div><div class="fb-flash"></div><div class="fb-vignette"></div>';
    document.body.appendChild(wrap);
    layer = wrap.querySelector(".fb-stage");
    flash = wrap.querySelector(".fb-flash");
  }

  // 上升音：噪声低通从窄到宽 + 次低音推高，收黑时一刀切断
  function startRiser(ms) {
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      var ctx = new AC();
      var dur = ms / 1000;

      var buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * dur), ctx.sampleRate);
      var d = buf.getChannelData(0);
      for (var i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * 0.6;

      var src = ctx.createBufferSource();
      src.buffer = buf;
      var lp = ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.setValueAtTime(260, ctx.currentTime);
      lp.frequency.exponentialRampToValueAtTime(6200, ctx.currentTime + dur * 0.92);
      var ng = ctx.createGain();
      ng.gain.setValueAtTime(0.0001, ctx.currentTime);
      ng.gain.exponentialRampToValueAtTime(0.22, ctx.currentTime + dur * 0.9);
      ng.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);

      src.connect(lp); lp.connect(ng); ng.connect(ctx.destination);
      src.start();

      var osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.setValueAtTime(46, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(92, ctx.currentTime + dur);
      var og = ctx.createGain();
      og.gain.setValueAtTime(0.0001, ctx.currentTime);
      og.gain.exponentialRampToValueAtTime(0.10, ctx.currentTime + dur * 0.95);
      og.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
      osc.connect(og); og.connect(ctx.destination);
      osc.start();

      audio = {
        stop: function () {
          try { src.stop(); osc.stop(); } catch (e) {}
          try { ctx.close(); } catch (e) {}
        }
      };
    } catch (e) { audio = null; }
  }

  function stopRiser() {
    if (audio) { audio.stop(); audio = null; }
  }

  function play(done) {
    if (running) return;
    running = true;

    var list = buildList();
    if (!list.length) { running = false; if (done) done(); return; }
    ensureDom();

    // 先预载，避免切到一半还在解图；最多等 1.4 秒
    var left = list.length;
    var started = false;
    function go() {
      if (started) return;
      started = true;
      run(list, done);
    }
    list.forEach(function (it) {
      var im = new Image();
      im.onload = im.onerror = function () { left -= 1; if (left <= 0) go(); };
      im.src = it.src;
    });
    window.setTimeout(go, 1400);
  }

  function run(list, done) {
    var wrap = document.getElementById("flashback");
    wrap.classList.add("show");
    layer.innerHTML = "";

    // 时间表：指数递减
    var t = 140;              // 先静一下，让“晚安”落地
    var plan = [];
    var total = 0;
    for (var i = 0; i < list.length; i++) {
      var k = list.length > 1 ? i / (list.length - 1) : 1;
      var dur = D0 * Math.pow(D1 / D0, k);
      plan.push({ at: t, dur: dur, item: list[i], i: i });
      t += dur;
    }
    total = t;

    startRiser(total + BLACK_HOLD);

    var img = document.createElement("img");
    img.className = "fb-img";
    layer.appendChild(img);

    plan.forEach(function (p) {
      window.setTimeout(function () {
        var it = p.item;
        img.src = it.src;
        img.style.filter = it.blur ? "blur(3px) saturate(0.65) brightness(0.92)" : "none";
        var sc = 1 + (Math.random() * 0.12 - 0.02);
        var rot = (Math.random() * 4 - 2);
        img.style.transition = "opacity " + Math.min(120, p.dur * 0.6) + "ms linear";
        img.style.transform = "scale(" + sc.toFixed(3) + ") rotate(" + rot.toFixed(2) + "deg)";
        img.style.opacity = "1";

        // 每几刀闪一下，模拟抽帧
        if (p.i % 6 === 5 || p.i > list.length - 8) {
          flash.classList.add("on");
          window.setTimeout(function () { flash.classList.remove("on"); }, 55);
        }
      }, p.at);
    });

    // 收黑
    window.setTimeout(function () {
      stopRiser();
      layer.innerHTML = "";
      wrap.classList.add("black");
      window.setTimeout(function () {
        wrap.classList.remove("show", "black");
        running = false;
        if (done) done();
      }, BLACK_HOLD);
    }, total);
  }

  window.FLASHBACK = { play: play, isRunning: function () { return running; } };
})();
