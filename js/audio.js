(function (global) {
  'use strict';

  var context = null;
  var enabled = true;
  var musicEnabled = false;
  var musicTimer = null;
  var noteIndex = 0;
  var ambientMode = 'none';
  var ambientNodes = [];
  var noiseBuffer = null;

  var PRESETS = {
    click: [{ f: 520, d: 0.06, t: 'square', v: 0.05 }],
    eat: [{ f: 320, d: 0.08, t: 'triangle', v: 0.08 }, { f: 440, d: 0.1, t: 'triangle', v: 0.07, delay: 0.09 }],
    happy: [{ f: 523, d: 0.1, t: 'sine', v: 0.08 }, { f: 659, d: 0.1, t: 'sine', v: 0.08, delay: 0.1 }, { f: 784, d: 0.16, t: 'sine', v: 0.08, delay: 0.2 }],
    sad: [{ f: 392, d: 0.14, t: 'sine', v: 0.07 }, { f: 311, d: 0.24, t: 'sine', v: 0.07, delay: 0.13 }],
    coin: [{ f: 880, d: 0.08, t: 'square', v: 0.05 }, { f: 1175, d: 0.14, t: 'square', v: 0.05, delay: 0.07 }],
    level: [{ f: 440, d: 0.1, t: 'triangle', v: 0.08 }, { f: 554, d: 0.1, t: 'triangle', v: 0.08, delay: 0.1 }, { f: 659, d: 0.1, t: 'triangle', v: 0.08, delay: 0.2 }, { f: 880, d: 0.25, t: 'triangle', v: 0.09, delay: 0.3 }],
    evolve: [{ f: 523, d: 0.12, t: 'sine', v: 0.08 }, { f: 659, d: 0.12, t: 'sine', v: 0.08, delay: 0.11 }, { f: 784, d: 0.12, t: 'sine', v: 0.08, delay: 0.22 }, { f: 1046, d: 0.35, t: 'sine', v: 0.09, delay: 0.33 }],
    sleep: [{ f: 523, d: 0.3, t: 'sine', v: 0.05 }, { f: 440, d: 0.35, t: 'sine', v: 0.05, delay: 0.25 }, { f: 349, d: 0.5, t: 'sine', v: 0.05, delay: 0.5 }],
    game: [{ f: 660, d: 0.07, t: 'square', v: 0.05 }, { f: 990, d: 0.12, t: 'square', v: 0.05, delay: 0.08 }],
    error: [{ f: 220, d: 0.18, t: 'sawtooth', v: 0.05 }, { f: 165, d: 0.22, t: 'sawtooth', v: 0.05, delay: 0.12 }],
    alert: [{ f: 740, d: 0.12, t: 'sine', v: 0.06 }, { f: 740, d: 0.12, t: 'sine', v: 0.06, delay: 0.2 }]
  };

  function getContext() {
    if (!enabled) return null;
    if (!context) {
      var AudioCtx = global.AudioContext || global.webkitAudioContext;
      if (!AudioCtx) return null;
      try { context = new AudioCtx(); } catch (error) { return null; }
    }
    if (context.state === 'suspended') context.resume();
    return context;
  }

  function tone(ctx, note) {
    var osc = ctx.createOscillator();
    var gain = ctx.createGain();
    var start = ctx.currentTime + (note.delay || 0);
    osc.type = note.t || 'sine';
    osc.frequency.setValueAtTime(note.f, start);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(note.v || 0.06, start + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + (note.d || 0.12));
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(start);
    osc.stop(start + (note.d || 0.12) + 0.03);
  }

  function play(name) {
    try {
      global.dispatchEvent(new CustomEvent('tamavida:sound', { detail: { name: name } }));
    } catch (error) {
      global.dispatchEvent(new Event('tamavida:sound'));
    }
    if (!enabled) return;
    var preset = PRESETS[name] || PRESETS.click;
    var ctx = getContext();
    if (!ctx) return;
    preset.forEach(function (note) { tone(ctx, note); });
  }

  var SCALE = [261.63, 329.63, 392, 523.25, 392, 329.63, 293.66, 349.23];

  function musicStep() {
    if (!musicEnabled || !enabled) return;
    var ctx = getContext();
    if (!ctx) return;
    tone(ctx, { f: SCALE[noteIndex % SCALE.length], d: 0.38, t: 'sine', v: 0.025 });
    if (noteIndex % 4 === 0) tone(ctx, { f: SCALE[noteIndex % SCALE.length] / 2, d: 0.5, t: 'triangle', v: 0.018 });
    noteIndex += 1;
  }

  function setMusic(value) {
    musicEnabled = !!value;
    if (musicTimer) { clearInterval(musicTimer); musicTimer = null; }
    if (musicEnabled) {
      musicStep();
      musicTimer = setInterval(musicStep, 520);
    }
  }

  function getNoiseBuffer(ctx) {
    if (noiseBuffer) return noiseBuffer;
    var length = Math.floor(ctx.sampleRate * 2);
    noiseBuffer = ctx.createBuffer(1, length, ctx.sampleRate);
    var data = noiseBuffer.getChannelData(0);
    for (var i = 0; i < length; i += 1) data[i] = Math.random() * 2 - 1;
    return noiseBuffer;
  }

  function createNoise(ctx, filterType, frequency, volume) {
    var source = ctx.createBufferSource();
    source.buffer = getNoiseBuffer(ctx);
    source.loop = true;
    var filter = ctx.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.value = frequency;
    var gain = ctx.createGain();
    gain.gain.value = volume;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    source.start();
    ambientNodes.push(source, filter, gain);
  }

  function createDrone(ctx, frequency, volume) {
    var osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = frequency;
    var gain = ctx.createGain();
    gain.gain.value = volume;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    ambientNodes.push(osc, gain);
  }

  function stopAmbient() {
    ambientNodes.forEach(function (node) {
      try { if (node.stop) node.stop(); } catch (error) {}
      try { node.disconnect(); } catch (error) {}
    });
    ambientNodes = [];
  }

  function setAmbient(mode) {
    var next = ['rain', 'snow', 'night', 'none'].indexOf(mode) !== -1 ? mode : 'none';
    if (!enabled) next = 'none';
    if (next === ambientMode) return;
    stopAmbient();
    ambientMode = next;
    if (next === 'none') return;
    var ctx = getContext();
    if (!ctx) { ambientMode = 'none'; return; }
    try {
      if (next === 'rain') createNoise(ctx, 'bandpass', 1100, 0.022);
      else if (next === 'snow') createNoise(ctx, 'lowpass', 520, 0.014);
      else if (next === 'night') {
        createDrone(ctx, 110, 0.008);
        createDrone(ctx, 164.81, 0.005);
      }
    } catch (error) {
      stopAmbient();
      ambientMode = 'none';
    }
  }

  global.TamaAudio = {
    play: play,
    setEnabled: function (value) {
      enabled = !!value;
      if (!enabled) { setMusic(false); setAmbient('none'); }
    },
    setMusic: setMusic,
    setAmbient: setAmbient,
    unlock: function () { getContext(); }
  };
})(window);
