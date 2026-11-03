/* 声音：雨 + 音乐
   没有素材时静默运行，不报错、不卡住。
   把文件放进 audio/ 目录、名字对上，就会自动响。 */
(function () {
  "use strict";

  // 帧 → [雨型, 音量dB]   雨型：light / mid / heavy / storm / indoor / door / none
  var RAIN = {
    1: ["light", -28], 2: ["light", -28], 3: ["light", -28], 4: ["light", -28],
    5: ["light", -28], 6: ["light", -28], 7: ["light", -28],
    8: ["storm", -18], 9: ["storm", -18],
    10: ["indoor", -26], 11: ["indoor", -26], 12: ["indoor", -26],
    13: ["light", -28],
    14: ["mid", -22], 15: ["none", -60], 16: ["none", -60], 17: ["none", -60], 18: ["none", -60],
    19: ["mid", -34], 20: ["mid", -22],
    21: ["heavy", -20],
    22: ["mid", -26], 23: ["light", -26], 24: ["light", -26], 25: ["mid", -24],
    26: ["mid", -30], 27: ["light", -26], 28: ["none", -60], 29: ["mid", -24],
    30: ["mid", -24], 31: ["heavy", -22], 32: ["light", -34], 33: ["none", -70],
    34: ["light", -30], 35: ["none", -50], 36: ["heavy", -18], 37: ["indoor", -26],
    38: ["none", -50], 39: ["none", -50],
    40: ["none", -60], 41: ["none", -50], 42: ["light", -34],
    43: ["none", -60], 44: ["none", -70], 45: ["none", -34],
    46: ["light", -28], 47: ["light", -28], 48: ["light", -28], 49: ["light", -28],
    50: ["door", -30], 51: ["light", -30], 52: ["light", -28], 53: ["light", -28],
    54: ["light", -30]
  };

  var RAIN_FILE = {
    light: "audio/rain-light.wav",
    mid: "audio/rain-mid.wav",
    heavy: "audio/rain-heavy.wav",
    storm: "audio/rain-storm.wav",
    indoor: "audio/rain-indoor.wav",
    door: "audio/rain-door.wav"
  };

  // 章 → 音乐文件（留空就不放）
  var MUSIC = {
    0: { file: "audio/bgm-01.mp3", db: -26 },
    1: { file: "audio/bgm-02.mp3", db: -24 },
    2: { file: "audio/bgm-03.mp3", db: -26 },
    3: { file: "audio/bgm-04.mp3", db: -24 },
    4: { file: "audio/bgm-05.mp3", db: -26 },
    5: { file: "audio/bgm-06.mp3", db: -24 },
    6: { file: "audio/bgm-07.mp3", db: -26 },
    7: { file: "audio/bgm-08.mp3", db: -28 },
    8: { file: "audio/bgm-09.mp3", db: -26 },
    9: { file: "audio/bgm-10.mp3", db: -26 }
  };

  var MUTE_KEY = "wz.sound.v1";
  var muted = false;
  try { muted = localStorage.getItem(MUTE_KEY) === "1"; } catch (e) {}

  var unlocked = false;
  var ready = false;

  // 两层播放器，交叉淡入
  var rainA = null, rainB = null, rainIsA = true;
  var musicA = null, musicB = null, musicIsA = true;
  var curRain = "";
  var curMusic = "";

  var missing = {};

  function dbToGain(db) {
    if (db <= -60) return 0;
    return Math.pow(10, db / 20);
  }

  function makeLayer(src) {
    var a = new Audio();
    a.src = src;
    a.loop = true;
    a.preload = "auto";
    a.volume = 0;
    a.addEventListener("error", function () { missing[src] = true; }, { once: true });
    return a;
  }

  function tryPlay(el) {
    if (!el || missing[el.src]) return;
    var p = el.play();
    if (p && p.catch) p.catch(function () { /* 自动播放被挡，下次手势再试 */ });
  }

  function fade(el, to, ms, done) {
    if (!el) return;
    var from = el.volume;
    var t0 = performance.now();
    function step(now) {
      var k = Math.min(1, (now - t0) / ms);
      el.volume = Math.max(0, Math.min(1, from + (to - from) * k));
      if (k < 1) requestAnimationFrame(step);
      else if (done) done();
    }
    requestAnimationFrame(step);
  }

  function setRain(preset, db) {
    if (preset === "none" || !RAIN_FILE[preset]) {
      if (curRain) {
        fade(rainIsA ? rainA : rainB, 0, 1800);
        curRain = "";
      }
      return;
    }
    if (curRain === preset) {
      // 同一场雨，只调音量
      fade(rainIsA ? rainA : rainB, dbToGain(db), 900);
      return;
    }
    curRain = preset;
    var prev = rainIsA ? rainA : rainB;
    var next = rainIsA ? rainB : rainA;
    next = makeLayer(RAIN_FILE[preset]);
    if (rainIsA) { rainB = next; rainIsA = false; } else { rainA = next; rainIsA = true; }
    next.volume = 0;
    tryPlay(next);
    fade(next, dbToGain(db), 2000);
    if (prev && prev !== next) fade(prev, 0, 2000, function () { try { prev.pause(); } catch (e) {} });
  }

  function setMusic(chapter) {
    var m = MUSIC[chapter];
    var key = m && m.file ? m.file : "";
    if (key === curMusic) {
      if (key) fade(musicIsA ? musicA : musicB, dbToGain(m.db), 900);
      return;
    }
    curMusic = key;
    var prev = musicIsA ? musicA : musicB;
    var next = null;
    if (key) {
      next = makeLayer(key);
      if (musicIsA) { musicB = next; musicIsA = false; } else { musicA = next; musicIsA = true; }
      next.volume = 0;
      tryPlay(next);
      fade(next, dbToGain(m.db), 2600);
    }
    if (prev && prev !== next) fade(prev, 0, 2600, function () { try { prev.pause(); } catch (e) {} });
  }

  function unlock() {
    if (unlocked) return;
    unlocked = true;
    // 触发一次静音播放，放行后续
    var warm = new Audio();
    warm.src = RAIN_FILE.light;
    var p = warm.play();
    if (p && p.catch) p.catch(function () {});
    try { warm.pause(); } catch (e) {}
    if (curRain && curRain !== "none") setRain(curRain, -28);
    ready = true;
  }

  function frame(f, chapter) {
    if (muted) return;
    var r = RAIN[f];
    if (r) setRain(r[0], r[1]);
    setMusic(chapter);
  }

  function setMuted(v) {
    muted = !!v;
    try { localStorage.setItem(MUTE_KEY, muted ? "1" : "0"); } catch (e) {}
    [rainA, rainB, musicA, musicB].forEach(function (el) {
      if (el) el.muted = muted;
    });
  }

  function toggle() {
    setMuted(!muted);
    if (!muted) unlock();
    return muted;
  }

  window.AUDIO = {
    unlock: unlock,
    frame: frame,
    toggle: toggle,
    isMuted: function () { return muted; },
    missing: missing
  };
})();
