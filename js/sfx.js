/* 音效：按帧触发的动作音 + UI 音 */
(function () {
  "use strict";

  var BASE = "audio/sfx/";
  var VOLUME = 0.55;

  var NAMES = [
    "gain", "lose", "memory", "achievement", "panel",
    "doorbell", "door", "umbrella", "chopsticks", "bowls", "faucet",
    "fridge", "wheels", "message", "paper", "pat", "bottle_slide", "typing"
  ];

  var pool = {};
  NAMES.forEach(function (n) {
    var a = new Audio(BASE + n + ".wav");
    a.preload = "auto";
    a.volume = VOLUME;
    pool[n] = a;
  });

  // 帧 → 音效（每帧进入时只放一次）
  var FRAME = {
    2: ["doorbell"],
    4: ["chopsticks"],
    6: ["chopsticks"],
    13: ["chopsticks", "message"],
    46: ["chopsticks"],
    47: ["faucet", "bowls"],
    51: ["door"],
    53: ["fridge"],
    27: ["wheels"],
    29: ["wheels"],
    31: ["wheels"],
    10: ["message"],
    12: ["message"],
    26: ["message"],
    28: ["message"],
    37: ["message"],
    48: ["paper"],
    49: ["pat"],
    54: ["bottle_slide"],
    40: ["typing"],
    14: ["umbrella"],
    20: ["umbrella"],
    36: ["umbrella"]
  };

  var muted = false;
  try { muted = localStorage.getItem("wz.sound.v1") === "0"; } catch (e) {}
  var lastFrame = -1;

  function play(name, opts) {
    if (muted) return;
    var src = pool[name];
    if (!src) return;
    try {
      var node = src.cloneNode(true);
      node.volume = Math.min(1, VOLUME * ((opts && opts.gain) || 1));
      var p = node.play();
      if (p && p.catch) p.catch(function () {});
    } catch (e) {}
  }

  function onFrame(frame) {
    if (frame === lastFrame) return;
    lastFrame = frame;
    var list = FRAME[frame];
    if (!list) return;
    list.forEach(function (n, i) {
      if (i === 0) play(n);
      else window.setTimeout(function () { play(n, { gain: 0.7 }); }, 420 * i);
    });
  }

  function setMuted(v) { muted = !!v; }

  window.SFX = {
    play: play,
    onFrame: onFrame,
    setMuted: setMuted,
    isMuted: function () { return muted; },
    names: NAMES
  };
})();
