/* 
  橘猫电音蝌蚪（Otamatone-like）
  - 杆子 ribbon：按住上下滑动 = 连续音高
  - 猫头 head：按住上下拖动 = mouthOpen（驱动 wah + 嘴巴动画）
  - 小米平板：用 Pointer Events 支持双指分别控制 ribbon 与 mouth
*/

(() => {
  "use strict";

  const $ = (sel) => document.querySelector(sel);

  // --- UI elements ---
  const btnPower = $("#btnPower");
  const btnStop = $("#btnStop");
  const btnReset = $("#btnReset");
  const btnConfig = $("#btnConfig");
  const btnReload = $("#btnReload");
  const btnFullscreen = $("#btnFullscreen");
  const btnAuto = $("#btnAuto");
  const ribbon = $("#ribbon");
  const ribbonCursor = $("#ribbonCursor");
  const stem = document.querySelector(".stem");
  const head = $("#head");
  const mouthUpper = $("#mouthUpper");
  const mouthLower = $("#mouthLower");
  const eyeLeft = document.querySelector(".eye.left");
  const eyeRight = document.querySelector(".eye.right");
  const catHead = document.querySelector(".catHead");
  const earLeft = document.querySelector(".ear.left");
  const earRight = document.querySelector(".ear.right");
  const whiskerLeft = Array.from(document.querySelectorAll(".whiskers.left span"));
  const whiskerRight = Array.from(document.querySelectorAll(".whiskers.right span"));
  const viz = $("#viz");
  const fx = $("#fx");
  const readout = $("#readout");
  const replyBox = $("#replyBox");

  const vol = $("#vol");
  const vibDepth = $("#vibDepth");
  const vibRate = $("#vibRate");
  const drive = $("#drive");
  const wah = $("#wah");
  const mouthAmp = $("#mouthAmp");
  const eyeColor = $("#eyeColor");
  const range = $("#range");
  const songSelect = $("#songSelect");
  const loop = $("#loop");
  const speed = $("#speed");

  const volVal = $("#volVal");
  const vibDepthVal = $("#vibDepthVal");
  const vibRateVal = $("#vibRateVal");
  const driveVal = $("#driveVal");
  const wahVal = $("#wahVal");
  const mouthAmpVal = $("#mouthAmpVal");
  const eyeColorVal = $("#eyeColorVal");
  const rangeVal = $("#rangeVal");
  const speedVal = $("#speedVal");
  const songProgress = $("#songProgress");
  const songNote = $("#songNote");

  const segBtns = Array.from(document.querySelectorAll(".segBtn"));
  const fxBtns = Array.from(document.querySelectorAll(".fxBtn"));

  // --- Parameters (tuned for "Otamatone-ish") ---
  const defaults = {
    volume: 0.55,
    octave: 0,          // -1, 0, +1
    vibDepthHz: 7.0,    // vibrato depth in Hz
    vibRateHz: 5.6,     // vibrato rate in Hz
    drive: 0.25,        // 0..1
    wah: 0.85,          // 0..1 (strength)
    range: 0.58,        // 0..1 (controls min/max pitch span)
    mouthOpen: 0.55,    // 0..1
    mouthRaw: 0.55,     // 0..1 (pre-amp)
    mouthAmp: 1.0,      // 0.5..1.6
    pitchT: 0.5,        // 0..1 (0=high,1=low)
  };

  const params = { ...defaults };

  // --- Utility ---
  const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
  const lerp = (a, b, t) => a + (b - a) * t;
  const expMap = (t, fMin, fMax) => fMax * Math.pow(fMin / fMax, t); // t=0->fMax, t=1->fMin
  const fmt = (x, digits=2) => Number(x).toFixed(digits);
  const midiToFreq = (m) => 440 * Math.pow(2, (m - 69) / 12);

  // --- Audio Engine (Web Audio API) ---
  class Engine {
    constructor() {
      this.ctx = null;
      this.master = null;

      this.osc = null;
      this.oscGain = null;

      this.filter = null;
      this.shaper = null;

      this.analyser = null;

      this.lfo = null;
      this.lfoGain = null;

      this.isReady = false;
      this.isOn = false;

      this.targetFreq = 220;
      this.baseFreq = 220;
    }

    async init() {
      if (this.isReady) return;

      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioCtx({ latencyHint: "interactive" });

      // master
      this.master = this.ctx.createGain();
      this.master.gain.value = params.volume;

      // main osc chain
      this.osc = this.ctx.createOscillator();
      this.osc.type = "sawtooth";
      this.osc.frequency.value = this.targetFreq;

      this.oscGain = this.ctx.createGain();
      this.oscGain.gain.value = 0.0; // gated

      this.filter = this.ctx.createBiquadFilter();
      this.filter.type = "lowpass";
      this.filter.Q.value = 0.9;

      this.shaper = this.ctx.createWaveShaper();
      this.shaper.curve = makeDriveCurve(params.drive);
      this.shaper.oversample = "2x";

      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 2048;
      this.analyser.smoothingTimeConstant = 0.85;

      // vibrato LFO
      this.lfo = this.ctx.createOscillator();
      this.lfo.type = "sine";
      this.lfo.frequency.value = params.vibRateHz;

      this.lfoGain = this.ctx.createGain();
      this.lfoGain.gain.value = params.vibDepthHz;

      // Connect LFO to osc.frequency
      this.lfo.connect(this.lfoGain);
      this.lfoGain.connect(this.osc.frequency);

      // Audio graph
      // osc -> oscGain -> filter -> shaper -> master -> analyser -> destination
      this.osc.connect(this.oscGain);
      this.oscGain.connect(this.filter);
      this.filter.connect(this.shaper);
      this.shaper.connect(this.master);
      this.master.connect(this.analyser);
      this.analyser.connect(this.ctx.destination);

      // start sources
      this.osc.start();
      this.lfo.start();

      // initial tone
      this.setMouthOpen(params.mouthOpen, true);

      this.isReady = true;
      await this.ctx.resume();
    }

    setVolume(v) {
      if (!this.isReady) return;
      this.master.gain.setTargetAtTime(v, this.ctx.currentTime, 0.02);
    }

    setDrive(d) {
      if (!this.isReady) return;
      this.shaper.curve = makeDriveCurve(d);
    }

    setVibrato(depthHz, rateHz) {
      if (!this.isReady) return;
      this.lfoGain.gain.setTargetAtTime(depthHz, this.ctx.currentTime, 0.03);
      this.lfo.frequency.setTargetAtTime(rateHz, this.ctx.currentTime, 0.03);
    }

    setFrequency(freqHz) {
      this.targetFreq = freqHz;
      if (!this.isReady) return;

      // smooth glide
      const now = this.ctx.currentTime;
      this.osc.frequency.cancelScheduledValues(now);
      this.osc.frequency.setTargetAtTime(freqHz, now, 0.012);
    }

    setMouthOpen(m, immediate=false) {
      params.mouthOpen = clamp(m, 0, 1);

      // Wah mapping: mouthOpen -> cutoff and Q
      if (!this.isReady) return;
      const now = this.ctx.currentTime;

      const strength = params.wah;
      const cutoffMin = 380;
      const cutoffMax = lerp(2000, 4200, strength);
      const qMin = 0.8;
      const qMax = lerp(3.2, 6.0, strength);

      const cutoff = lerp(cutoffMin, cutoffMax, params.mouthOpen);
      const q = lerp(qMin, qMax, params.mouthOpen);

      const tc = immediate ? 0.001 : 0.02;
      this.filter.frequency.setTargetAtTime(cutoff, now, tc);
      this.filter.Q.setTargetAtTime(q, now, tc);
    }

    gate(on) {
      if (!this.isReady) return;
      const now = this.ctx.currentTime;

      if (on && !this.isOn) {
        this.isOn = true;
        // attack
        this.oscGain.gain.cancelScheduledValues(now);
        this.oscGain.gain.setTargetAtTime(0.95, now, 0.012);
      } else if (!on && this.isOn) {
        this.isOn = false;
        // release
        this.oscGain.gain.cancelScheduledValues(now);
        this.oscGain.gain.setTargetAtTime(0.0, now, 0.02);
      }
    }

    stopAll() {
      if (!this.isReady) return;
      this.gate(false);
      this.setMouthOpen(0.35);
      this.setFrequency(220);
    }
  }

  class Player {
    constructor(engine) {
      this.engine = engine;
      this.song = null;
      this.speed = 1;
      this.loop = false;
      this.noteIndex = 0;
      this.startTime = 0;
      this.timer = null;
      this.raf = null;
      this.timeouts = [];
      this.lookahead = 0.03;
      this.scheduleAhead = 0.12;
      this.totalDur = 0;
      this.isPlaying = false;
    }

    loadSongs() {
      if (typeof SONGS_DATA !== "undefined") return SONGS_DATA;
      return null;
    }

    play(songId, speed=1, loop=false) {
      if (!this.engine.isReady) {
        return this.engine.init().then(() => this.play(songId, speed, loop));
      }

      const data = this.loadSongs();
      if (!data || !data.songs || !data.songs[songId]) return;

      this.stop();
      this.song = data.songs[songId];
      this.speed = speed;
      this.loop = loop;
      this.noteIndex = 0;
      this.isPlaying = true;
      if (ribbon) ribbon.classList.add("auto");
      this.totalDur = this.song.notes.reduce((m, n) => Math.max(m, n.t + n.d), 0);
      this.startTime = this.engine.ctx.currentTime + 0.05;

      this.timer = setInterval(() => this.scheduler(), this.lookahead * 1000);
      this.updateUI();
    }

    stop() {
      this.isPlaying = false;
      if (this.timer) clearInterval(this.timer);
      this.timer = null;
      if (this.raf) cancelAnimationFrame(this.raf);
      this.raf = null;
      this.timeouts.forEach((t) => clearTimeout(t));
      this.timeouts.length = 0;
      if (this.engine.isReady) {
        this.engine.gate(false);
      }
      if (ribbon) ribbon.classList.remove("auto");
      if (btnAuto) btnAuto.textContent = "播放";
      if (songProgress) songProgress.style.width = "0%";
      if (songNote) songNote.textContent = "—";
    }

    scheduler() {
      if (!this.isPlaying || !this.song) return;
      const now = this.engine.ctx.currentTime;
      const notes = this.song.notes;

      while (this.noteIndex < notes.length) {
        const n = notes[this.noteIndex];
        const noteTime = this.startTime + n.t / this.speed;
        if (noteTime > now + this.scheduleAhead) break;
        this.scheduleNote(n, this.noteIndex, notes);
        this.noteIndex += 1;
      }

      const endTime = this.startTime + this.totalDur / this.speed;
      if (now > endTime + 0.1 && this.noteIndex >= notes.length) {
        if (this.loop) {
          this.noteIndex = 0;
          this.startTime = this.engine.ctx.currentTime + 0.05;
        } else {
          this.stop();
        }
      }
    }

    scheduleNote(note, idx, notes) {
      const when = this.startTime + note.t / this.speed;
      const dur = note.d / this.speed;
      const next = notes[idx + 1];
      const gap = next ? (next.t - (note.t + note.d)) / this.speed : 0.2;

      const freq = midiToFreq(note.midi);
      const vel = clamp(note.vel ?? 0.9, 0, 1);
      const open = clamp(0.45 + vel * 0.5, 0.3, 1);

      const startDelay = Math.max(0, (when - this.engine.ctx.currentTime) * 1000);
      const startT = setTimeout(() => {
        if (!this.isPlaying) return;
        this.engine.setFrequency(freq);
        this.engine.gate(true);
        setRibbonCursorFromFreq(freq);
        setPitchFromFreq(freq);
        applyMouthOpen(open);
        updateReadout(freq);
      }, startDelay);
      this.timeouts.push(startT);

      if (gap > 0.04) {
        const endDelay = Math.max(0, (when + dur - this.engine.ctx.currentTime) * 1000);
        const endT = setTimeout(() => {
          if (!this.isPlaying) return;
          this.engine.gate(false);
          applyMouthOpen(defaults.mouthRaw);
        }, endDelay);
        this.timeouts.push(endT);
      }
    }

    updateUI() {
      if (!this.isPlaying || !this.song) return;
      const now = this.engine.ctx.currentTime;
      const t = clamp((now - this.startTime) * this.speed, 0, this.totalDur);
      const pct = this.totalDur > 0 ? (t / this.totalDur) * 100 : 0;
      if (songProgress) songProgress.style.width = `${pct}%`;

      const notes = this.song.notes;
      for (let i = this.noteIndex - 1; i >= 0; i--) {
        const n = notes[i];
        if (t >= n.t && t <= n.t + n.d) {
          if (songNote) songNote.textContent = `MIDI ${n.midi}`;
          break;
        }
      }

      this.raf = requestAnimationFrame(() => this.updateUI());
    }
  }

  function makeDriveCurve(amount) {
    const k = 5 + amount * 60;
    const n = 1024;
    const curve = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const x = (i * 2) / (n - 1) - 1;
      // soft clip
      curve[i] = Math.tanh(k * x) / Math.tanh(k);
    }
    return curve;
  }

  const engine = new Engine();
  const player = new Player(engine);

  // --- Mouth drawing (SVG path) ---
  // We'll draw a cute "cat mouth" that opens with params.mouthOpen.
  function updateMouthPath() {
    const open = params.mouthOpen; // 0..1

    // mouth center
    const cx = 256;
    const cy = 338;

    // width & height (open/close)
    const w = lerp(90, 135, open);
    const h = lerp(2, 46, open);

    const left = cx - w / 2;
    const right = cx + w / 2;
    const top = cy - h;
    const bottom = cy + h;

    // Upper lip: cat-like double-bump with a soft center dip
    const dip = lerp(4, 14, open);
    const bump = lerp(6, 18, open);
    const upper = [
      `M ${left} ${cy}`,
      `Q ${left + w * 0.18} ${cy - bump} ${cx - w * 0.12} ${cy - dip}`,
      `Q ${cx} ${cy} ${cx + w * 0.12} ${cy - dip}`,
      `Q ${right - w * 0.18} ${cy - bump} ${right} ${cy}`,
      "Z",
    ].join(" ");

    // Lower lip arc (original style)
    const lower = [
      `M ${left} ${cy}`,
      `Q ${cx} ${bottom} ${right} ${cy}`,
      "Z",
    ].join(" ");

    const fillAlpha = lerp(0.12, 0.6, open);
    mouthUpper.setAttribute("d", upper);
    mouthLower.setAttribute("d", lower);
    mouthUpper.style.fill = `rgba(20,10,6,${fillAlpha.toFixed(2)})`;
    mouthLower.style.fill = `rgba(20,10,6,${fillAlpha.toFixed(2)})`;

    updateEyes(open);
  }

  function updateEyes(open) {
    const t = clamp(open, 0, 1);
    const eyeY = lerp(0, -6, t);
    const eyeS = lerp(1.0, 0.7, t * 0.85);
    const pupilY = lerp(0, 4, t);
    const pitchHi = 1 - clamp(params.pitchT, 0, 1);
    const pupilS = lerp(1.15, 0.45, pitchHi);
    if (eyeLeft) {
      eyeLeft.style.setProperty("--eye-y", `${eyeY}px`);
      eyeLeft.style.setProperty("--eye-s", `${eyeS}`);
      eyeLeft.style.setProperty("--pupil-y", `${pupilY}px`);
      eyeLeft.style.setProperty("--pupil-s", `${pupilS}`);
    }
    if (eyeRight) {
      eyeRight.style.setProperty("--eye-y", `${eyeY}px`);
      eyeRight.style.setProperty("--eye-s", `${eyeS}`);
      eyeRight.style.setProperty("--pupil-y", `${pupilY}px`);
      eyeRight.style.setProperty("--pupil-s", `${pupilS}`);
    }
  }

  function updateEars() {
    const t = clamp(params.pitchT, 0, 1);
    const lift = lerp(0, -10, 1 - t);
    const stretch = lerp(1.0, 1.45, 1 - t);
    const tilt = lerp(0, 12, 1 - t);
    if (earLeft) {
      earLeft.style.setProperty("--ear-y", `${lift}px`);
      earLeft.style.setProperty("--ear-stretch", `${stretch}`);
      earLeft.style.setProperty("--ear-rot", `${-6 - tilt}deg`);
    }
    if (earRight) {
      earRight.style.setProperty("--ear-y", `${lift}px`);
      earRight.style.setProperty("--ear-stretch", `${stretch}`);
      earRight.style.setProperty("--ear-rot", `${6 + tilt}deg`);
    }
  }

  function updateWhiskers(now) {
    const t = clamp(params.pitchT, 0, 1);
    const energy = (engine.isOn ? 1 : 0.4) * lerp(0.6, 1.0, 1 - t);
    const baseLeft = [-12, 0, 12];
    const baseRight = [12, 0, -12];
    whiskerLeft.forEach((w, i) => {
      const jitter = Math.sin(now * 0.004 + i * 1.7) * 3 * energy;
      w.style.setProperty("--whisker-rot", `${baseLeft[i] + jitter}deg`);
    });
    whiskerRight.forEach((w, i) => {
      const jitter = Math.sin(now * 0.004 + i * 1.9 + 1.4) * 3 * energy;
      w.style.setProperty("--whisker-rot", `${baseRight[i] + jitter}deg`);
    });
  }

  // --- Pitch mapping from ribbon position ---
  function getRibbonTFromPointer(clientY) {
    const rect = ribbon.getBoundingClientRect();
    return clamp((clientY - rect.top) / rect.height, 0, 1); // 0 top, 1 bottom
  }

  function getRibbonFreqFromPointer(clientY) {
    const t = getRibbonTFromPointer(clientY);
    const { fMin, fMax } = getRangeBounds();

    // exponential mapping (more natural)
    let f = expMap(t, fMin, fMax);

    // octave shift
    f *= Math.pow(2, params.octave);

    return f;
  }

  function getRangeBounds() {
    const span = lerp(2.8, 4.6, params.range); // octaves
    const fCenter = 330; // around E4
    const fMax = fCenter * Math.pow(2, span/2);
    const fMin = fCenter / Math.pow(2, span/2);
    return { fMin, fMax };
  }

  function setRibbonCursor(clientY) {
    const rect = ribbon.getBoundingClientRect();
    const t = getRibbonTFromPointer(clientY);
    const y = t * rect.height;
    ribbonCursor.style.top = `${y}px`;
  }

  function setRibbonCursorFromFreq(freq) {
    const rect = ribbon.getBoundingClientRect();
    const { fMin, fMax } = getRangeBounds();
    const f = freq / Math.pow(2, params.octave);
    const t = clamp(Math.log(f / fMax) / Math.log(fMin / fMax), 0, 1);
    const y = t * rect.height;
    ribbonCursor.style.top = `${y}px`;
  }

  function setPitchFromPointer(clientY) {
    params.pitchT = getRibbonTFromPointer(clientY);
    updateEars();
  }

  function setPitchFromFreq(freq) {
    const { fMin, fMax } = getRangeBounds();
    const f = freq / Math.pow(2, params.octave);
    const t = clamp(Math.log(f / fMax) / Math.log(fMin / fMax), 0, 1);
    params.pitchT = t;
    updateEars();
  }

  function applyMouthOpen(rawOpen, immediate=false) {
    const raw = clamp(rawOpen, 0, 1);
    params.mouthRaw = raw;
    const scaled = clamp(params.mouthRaw * params.mouthAmp, 0, 1);
    engine.setMouthOpen(scaled, immediate);
    updateMouthPath();
  }

  function setMouthFromRibbon(clientY) {
    if (pointers.mouthId !== null) return; // mouth drag takes precedence
    const t = getRibbonTFromPointer(clientY);
    const open = lerp(0.25, 0.9, 1 - t); // higher pitch -> more open
    applyMouthOpen(open);
  }

  // --- Pointer handling (multi-touch) ---
  const pointers = {
    ribbonId: null,
    mouthId: null,
    mouthStartY: 0,
    mouthStartOpen: params.mouthRaw,
    lastFreq: null,
    configId: null,
    configStartX: 0,
    configStartY: 0,
    configStemX: 0,
    configStemY: 0,
  };

  // --- Config mode (move stem position) ---
  const appRoot = document.querySelector(".app");
  const CONFIG_KEY = "otama_stem_pos";
  let configMode = false;
  const stemPos = { x: 0, y: 0 };

  function applyStemPos() {
    stem.style.setProperty("--stem-x", `${stemPos.x}px`);
    stem.style.setProperty("--stem-y", `${stemPos.y}px`);
  }

  function loadStemPos() {
    try {
      const raw = localStorage.getItem(CONFIG_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (typeof parsed.x === "number") stemPos.x = parsed.x;
      if (typeof parsed.y === "number") stemPos.y = parsed.y;
      applyStemPos();
    } catch (_) {
      // ignore invalid saved value
    }
  }

  function saveStemPos() {
    localStorage.setItem(CONFIG_KEY, JSON.stringify({ x: stemPos.x, y: stemPos.y }));
  }

  function setConfigMode(on) {
    configMode = on;
    appRoot.classList.toggle("config-mode", configMode);
    btnConfig.textContent = configMode ? "配置位置：开" : "配置位置";
  }

  function ensureAudioFromGesture() {
    // called inside a user gesture (pointer down)
    if (!engine.isReady) {
      engine.init().catch((err) => {
        console.error(err);
      });
      btnPower.textContent = "声音已启用";
      btnPower.classList.add("active");
    } else if (engine.ctx && engine.ctx.state !== "running") {
      engine.ctx.resume();
    }
  }

  ribbon.addEventListener("pointerdown", (ev) => {
    ensureAudioFromGesture();

    if (pointers.ribbonId !== null) return; // already taken
    pointers.ribbonId = ev.pointerId;
    ribbon.setPointerCapture(ev.pointerId);
    ribbon.classList.add("active");

    const f = getRibbonFreqFromPointer(ev.clientY);
    pointers.lastFreq = f;
    engine.setFrequency(f);
    engine.gate(true);

    setRibbonCursor(ev.clientY);
    setPitchFromPointer(ev.clientY);
    setMouthFromRibbon(ev.clientY);
    updateReadout(f);
  });

  ribbon.addEventListener("pointermove", (ev) => {
    if (pointers.ribbonId !== ev.pointerId) return;

    const f = getRibbonFreqFromPointer(ev.clientY);
    pointers.lastFreq = f;
    engine.setFrequency(f);

    setRibbonCursor(ev.clientY);
    setPitchFromPointer(ev.clientY);
    setMouthFromRibbon(ev.clientY);
    updateReadout(f);
  });

  function endRibbonPointer(ev) {
    if (pointers.ribbonId !== ev.pointerId) return;

    ribbon.classList.remove("active");
    pointers.ribbonId = null;
    engine.gate(false);
    updateReadout(null);
  }

  ribbon.addEventListener("pointerup", endRibbonPointer);
  ribbon.addEventListener("pointercancel", endRibbonPointer);
  ribbon.addEventListener("lostpointercapture", (ev) => {
    if (pointers.ribbonId === ev.pointerId) {
      ribbon.classList.remove("active");
      pointers.ribbonId = null;
      engine.gate(false);
      updateReadout(null);
    }
  });

  head.addEventListener("pointerdown", (ev) => {
    ensureAudioFromGesture();

    if (pointers.mouthId !== null) return;
    pointers.mouthId = ev.pointerId;
    head.setPointerCapture(ev.pointerId);

    pointers.mouthStartY = ev.clientY;
    pointers.mouthStartOpen = params.mouthRaw;
  });

  head.addEventListener("pointermove", (ev) => {
    if (pointers.mouthId !== ev.pointerId) return;

    const dy = ev.clientY - pointers.mouthStartY;

    // Drag up -> open more, drag down -> close
    const m = clamp(pointers.mouthStartOpen - dy / 220, 0, 1);
    applyMouthOpen(m);
  });

  function endMouthPointer(ev) {
    if (pointers.mouthId !== ev.pointerId) return;
    pointers.mouthId = null;
  }

  head.addEventListener("pointerup", endMouthPointer);
  head.addEventListener("pointercancel", endMouthPointer);
  head.addEventListener("lostpointercapture", (ev) => {
    if (pointers.mouthId === ev.pointerId) pointers.mouthId = null;
  });

  stem.addEventListener("pointerdown", (ev) => {
    if (!configMode) return;
    if (pointers.configId !== null) return;
    pointers.configId = ev.pointerId;
    stem.setPointerCapture(ev.pointerId);
    pointers.configStartX = ev.clientX;
    pointers.configStartY = ev.clientY;
    pointers.configStemX = stemPos.x;
    pointers.configStemY = stemPos.y;
  });

  stem.addEventListener("pointermove", (ev) => {
    if (pointers.configId !== ev.pointerId) return;
    const dx = ev.clientX - pointers.configStartX;
    const dy = ev.clientY - pointers.configStartY;
    stemPos.x = pointers.configStemX + dx;
    stemPos.y = pointers.configStemY + dy;
    applyStemPos();
  });

  function endConfigPointer(ev) {
    if (pointers.configId !== ev.pointerId) return;
    pointers.configId = null;
    saveStemPos();
  }

  stem.addEventListener("pointerup", endConfigPointer);
  stem.addEventListener("pointercancel", endConfigPointer);
  stem.addEventListener("lostpointercapture", (ev) => {
    if (pointers.configId === ev.pointerId) {
      pointers.configId = null;
      saveStemPos();
    }
  });

  // Prevent page scroll/zoom gesture interfering (still allows OS-level gestures)
  document.addEventListener("touchmove", (ev) => {
    if (ev.target.closest(".instrument")) ev.preventDefault();
  }, { passive: false });

  // --- UI controls ---
  function setOctave(o) {
    params.octave = o;
    segBtns.forEach((b) => b.classList.toggle("active", Number(b.dataset.oct) === o));
  }

  segBtns.forEach((b) => {
    b.addEventListener("click", () => {
      setOctave(Number(b.dataset.oct));
    });
  });

  btnPower.addEventListener("click", async () => {
    await engine.init();
    btnPower.textContent = "声音已启用";
    btnPower.classList.add("active");
  });

  btnStop.addEventListener("click", () => {
    player.stop();
    if (btnAuto) btnAuto.textContent = "播放";
    if (!engine.isReady) return;
    engine.stopAll();
    applyMouthOpen(defaults.mouthRaw, true);
    updateMouthPath();
    updateReadout(null);
  });

  btnReset.addEventListener("click", () => {
    player.stop();
    if (btnAuto) btnAuto.textContent = "播放";
    Object.assign(params, defaults);
    syncUIFromParams();
    if (engine.isReady) {
      engine.setVolume(params.volume);
      engine.setVibrato(params.vibDepthHz, params.vibRateHz);
      engine.setDrive(params.drive);
      applyMouthOpen(params.mouthRaw, true);
    }
    updateMouthPath();
    updateReadout(null);
  });

  btnConfig.addEventListener("click", () => {
    setConfigMode(!configMode);
  });

  btnReload.addEventListener("click", () => {
    if (isFullscreen()) {
      sessionStorage.setItem("otama_fs_restore", "1");
    } else {
      sessionStorage.removeItem("otama_fs_restore");
    }
    const url = new URL(window.location.href);
    url.searchParams.set("v", String(Date.now()));
    window.location.replace(url.toString());
  });

  function isFullscreen() {
    return !!document.fullscreenElement;
  }

  function updateFullscreenLabel() {
    if (!btnFullscreen) return;
    btnFullscreen.textContent = isFullscreen() ? "退出全屏" : "全屏";
  }

  if (btnFullscreen) {
    btnFullscreen.addEventListener("click", async () => {
      try {
        if (isFullscreen()) {
          await document.exitFullscreen();
        } else {
          await document.documentElement.requestFullscreen({ navigationUI: "hide" });
        }
      } catch (_) {
        // ignore if fullscreen is blocked
      }
      updateFullscreenLabel();
    });

    document.addEventListener("fullscreenchange", updateFullscreenLabel);
    updateFullscreenLabel();
  }

  function bindRange(input, onChange) {
    input.addEventListener("input", () => onChange(Number(input.value)));
  }

  bindRange(vol, (v) => {
    params.volume = v;
    if (engine.isReady) engine.setVolume(v);
    volVal.textContent = fmt(v, 2);
  });

  bindRange(vibDepth, (v) => {
    params.vibDepthHz = v;
    if (engine.isReady) engine.setVibrato(params.vibDepthHz, params.vibRateHz);
    vibDepthVal.textContent = `${fmt(v, 1)} Hz`;
  });

  bindRange(vibRate, (v) => {
    params.vibRateHz = v;
    if (engine.isReady) engine.setVibrato(params.vibDepthHz, params.vibRateHz);
    vibRateVal.textContent = `${fmt(v, 1)} Hz`;
  });

  bindRange(drive, (v) => {
    params.drive = v;
    if (engine.isReady) engine.setDrive(v);
    driveVal.textContent = fmt(v, 2);
  });

  bindRange(wah, (v) => {
    params.wah = v;
    if (engine.isReady) engine.setMouthOpen(params.mouthOpen);
    wahVal.textContent = fmt(v, 2);
  });

  bindRange(mouthAmp, (v) => {
    params.mouthAmp = v;
    applyMouthOpen(params.mouthRaw);
    mouthAmpVal.textContent = fmt(v, 2);
  });

  if (eyeColor && catHead) {
    const EYE_KEY = "otama_eye_color";
    const savedEye = localStorage.getItem(EYE_KEY);
    if (savedEye) {
      eyeColor.value = savedEye;
    }
    const applyEye = (val) => {
      catHead.style.setProperty("--iris", val);
      if (eyeColorVal) eyeColorVal.textContent = val.toUpperCase();
    };
    applyEye(eyeColor.value || "#66c36a");
    eyeColor.addEventListener("input", () => {
      applyEye(eyeColor.value);
      localStorage.setItem(EYE_KEY, eyeColor.value);
    });
  }

  bindRange(range, (v) => {
    params.range = v;
    rangeVal.textContent = fmt(v, 2);
  });

  // --- Auto play UI ---
  if (speed) {
    speed.value = 1;
    speedVal.textContent = "1.00x";
    bindRange(speed, (v) => {
      speedVal.textContent = `${fmt(v, 2)}x`;
    });
  }

  function loadSongOptions() {
    if (!songSelect) return;
    const data = player.loadSongs();
    songSelect.innerHTML = "";
    if (!data || !data.index) {
      const opt = document.createElement("option");
      opt.value = "";
      opt.textContent = "未找到曲库";
      songSelect.appendChild(opt);
      return;
    }
    data.index.forEach((s) => {
      const opt = document.createElement("option");
      opt.value = s.id;
      opt.textContent = s.title;
      songSelect.appendChild(opt);
    });
    if (songSelect.options.length > 0) songSelect.selectedIndex = 0;
  }

  if (btnAuto) {
    btnAuto.addEventListener("click", () => {
      ensureAudioFromGesture();
      if (player.isPlaying) {
        player.stop();
        btnAuto.textContent = "播放";
        return;
      }
      const songId = songSelect ? songSelect.value : "";
      if (!songId) return;
      const spd = speed ? Number(speed.value) : 1;
      const lp = loop ? loop.checked : false;
      player.play(songId, spd, lp);
      btnAuto.textContent = "停止";
    });
  }

  function syncUIFromParams() {
    vol.value = params.volume;
    vibDepth.value = params.vibDepthHz;
    vibRate.value = params.vibRateHz;
    drive.value = params.drive;
    wah.value = params.wah;
    mouthAmp.value = params.mouthAmp;
    range.value = params.range;

    volVal.textContent = fmt(params.volume, 2);
    vibDepthVal.textContent = `${fmt(params.vibDepthHz, 1)} Hz`;
    vibRateVal.textContent = `${fmt(params.vibRateHz, 1)} Hz`;
    driveVal.textContent = fmt(params.drive, 2);
    wahVal.textContent = fmt(params.wah, 2);
    mouthAmpVal.textContent = fmt(params.mouthAmp, 2);
    rangeVal.textContent = fmt(params.range, 2);

    setOctave(params.octave);
  }

  // --- Visualization ---
  const vctx = viz.getContext("2d");
  const freqData = new Uint8Array(1024);

  // --- FX system ---
  const fctx = fx ? fx.getContext("2d") : null;
  let fxMode = "none";
  let fxLastTime = performance.now();
  let lastFirework = 0;
  let lastSparkle = 0;
  const fireworks = [];
  const sparkles = [];
  let fxFrameSkip = 0;

  function drawViz() {
    const now = performance.now();
    const dt = Math.min(0.05, (now - fxLastTime) / 1000);
    fxLastTime = now;

    const w = viz.width;
    const h = viz.height;

    vctx.clearRect(0, 0, w, h);

    // background grid
    vctx.globalAlpha = 1.0;
    vctx.fillStyle = "rgba(0,0,0,0.25)";
    vctx.fillRect(0, 0, w, h);

    vctx.strokeStyle = "rgba(255,255,255,0.08)";
    vctx.lineWidth = 1;
    for (let x = 0; x <= w; x += 60) {
      vctx.beginPath();
      vctx.moveTo(x, 0);
      vctx.lineTo(x, h);
      vctx.stroke();
    }
    for (let y = 0; y <= h; y += 50) {
      vctx.beginPath();
      vctx.moveTo(0, y);
      vctx.lineTo(w, y);
      vctx.stroke();
    }

    if (engine.isReady) {
      engine.analyser.getByteFrequencyData(freqData);

      const bins = freqData.length;
      const barW = w / bins;

      vctx.fillStyle = "rgba(255,176,87,0.85)";
      for (let i = 0; i < bins; i++) {
        const v = freqData[i] / 255;
        const bh = v * (h - 10);
        const x = i * barW;
        vctx.fillRect(x, h - bh, Math.max(1, barW - 1), bh);
      }

      // top gloss
      vctx.fillStyle = "rgba(255,255,255,0.05)";
      vctx.fillRect(0, 0, w, 26);
    }

    if (fxFrameSkip++ % 2 === 0) drawFx(now, dt);
    updateWhiskers(now);
    requestAnimationFrame(drawViz);
  }

  // Fit canvas to CSS size for crisp drawing
  function resizeViz() {
    const rect = viz.getBoundingClientRect();
    const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    viz.width = Math.floor(rect.width * dpr);
    viz.height = Math.floor(rect.height * dpr);
  }

  function resizeFx() {
    if (!fx || !fctx) return;
    const rect = fx.getBoundingClientRect();
    const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    fx.width = Math.floor(rect.width * dpr);
    fx.height = Math.floor(rect.height * dpr);
  }

  window.addEventListener("resize", () => {
    resizeViz();
    resizeFx();
  });

  function setFxMode(mode) {
    fxMode = mode;
    fxBtns.forEach((b) => b.classList.toggle("active", b.dataset.fx === mode));
  }

  fxBtns.forEach((b) => {
    b.addEventListener("click", () => setFxMode(b.dataset.fx));
  });

  function spawnFirework() {
    if (!fx) return;
    if (fireworks.length > 420) return;
    const w = fx.width;
    const h = fx.height;
    const cx = w * (0.2 + Math.random() * 0.6);
    const cy = h * (0.08 + Math.random() * 0.32);
    const count = 18 + Math.floor(Math.random() * 10);
    const hue = 20 + Math.random() * 40;
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 80 + Math.random() * 160;
      fireworks.push({
        x: cx,
        y: cy,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        life: 1.0 + Math.random() * 0.6,
        age: 0,
        hue,
        size: 2 + Math.random() * 2,
      });
    }
  }

  function spawnSparkle() {
    if (!fx) return;
    if (sparkles.length > 260) return;
    const w = fx.width;
    const h = fx.height;
    sparkles.push({
      x: Math.random() * w,
      y: h + 10,
      vx: -10 + Math.random() * 20,
      vy: -24 - Math.random() * 40,
      life: 3 + Math.random() * 2.5,
      age: 0,
      size: 1 + Math.random() * 2,
    });
  }

  function drawFx(now, dt) {
    if (!fx || !fctx) return;
    const w = fx.width;
    const h = fx.height;
    fctx.clearRect(0, 0, w, h);
    if (fxMode === "none") return;
    const pitchHi = 1 - clamp(params.pitchT, 0, 1);
    const playing = engine.isOn;

    if (fxMode === "fireworks") {
      const interval = lerp(1100, 520, pitchHi);
      if (playing && now - lastFirework > interval) {
        spawnFirework();
        lastFirework = now;
      }
      for (let i = fireworks.length - 1; i >= 0; i--) {
        const p = fireworks[i];
        p.age += dt;
        p.vy += 160 * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        const t = p.age / p.life;
        if (t >= 1) {
          fireworks.splice(i, 1);
          continue;
        }
        const alpha = Math.max(0, 1 - t);
        const hue = 20 + pitchHi * 40 + (p.hue - 20);
        fctx.fillStyle = `hsla(${hue}, 90%, 65%, ${alpha})`;
        fctx.beginPath();
        fctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        fctx.fill();
      }
    } else if (fxMode === "sparkles") {
      const interval = lerp(220, 90, pitchHi);
      if (playing && now - lastSparkle > interval) {
        spawnSparkle();
        lastSparkle = now;
      }
      for (let i = sparkles.length - 1; i >= 0; i--) {
        const s = sparkles[i];
        s.age += dt;
        s.x += s.vx * dt;
        s.y += s.vy * dt;
        const t = s.age / s.life;
        if (t >= 1) {
          sparkles.splice(i, 1);
          continue;
        }
        const alpha = 0.6 * Math.sin(t * Math.PI);
        const hue = 28 + pitchHi * 35;
        fctx.fillStyle = `hsla(${hue}, 90%, 70%, ${alpha})`;
        fctx.fillRect(s.x, s.y, s.size, s.size);
      }
    } else if (fxMode === "glow") {
      const base = playing ? 0.6 : 0.25;
      const pulse = base + (playing ? 0.4 : 0.2) * Math.sin(now / 900);
      const r = Math.min(w, h) * (0.28 + 0.08 * pulse);
      let cx = w * 0.5;
      let cy = h * 0.35;
      if (head && fx) {
        const hr = head.getBoundingClientRect();
        const fr = fx.getBoundingClientRect();
        cx = (hr.left + hr.right) * 0.5 - fr.left;
        cy = (hr.top + hr.bottom) * 0.5 - fr.top;
      }
      const g = fctx.createRadialGradient(cx, cy, r * 0.2, cx, cy, r);
      const hue = 25 + pitchHi * 35;
      g.addColorStop(0, `hsla(${hue}, 90%, 65%, ${0.35 * pulse})`);
      g.addColorStop(1, `hsla(${hue}, 90%, 65%, 0)`);
      fctx.fillStyle = g;
      fctx.fillRect(0, 0, w, h);
    }
  }

  // --- Readout ---
  function updateReadout(freq) {
    if (freq == null) {
      readout.textContent = "—";
      return;
    }
    readout.textContent = `freq: ${fmt(freq, 1)} Hz   mouth: ${fmt(params.mouthOpen, 2)}   oct: ${params.octave}`;
  }

  // --- Init UI + mouth ---
  syncUIFromParams();
  applyMouthOpen(params.mouthRaw, true);
  updateEars();
  loadSongOptions();
  if (speedVal && speed) speedVal.textContent = `${fmt(Number(speed.value || 1), 2)}x`;
  if (sessionStorage.getItem("otama_fs_restore") === "1") {
    sessionStorage.removeItem("otama_fs_restore");
    const restore = () => {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen({ navigationUI: "hide" }).catch(() => {});
      }
    };
    document.addEventListener("pointerdown", restore, { once: true });
  }
  if (replyBox) {
    const REPLY_KEY = "otama_reply_draft";
    const saved = localStorage.getItem(REPLY_KEY);
    if (saved) replyBox.value = saved;
    replyBox.addEventListener("input", () => {
      localStorage.setItem(REPLY_KEY, replyBox.value);
    });
  }
  loadStemPos();
  setConfigMode(false);
  resizeViz();
  resizeFx();
  requestAnimationFrame(drawViz);

})();
