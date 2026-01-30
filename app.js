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
  const avatarToggleBtn = $("#avatarToggleBtn");
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
  const syllableType = $("#syllableType");
  const syllableCount = $("#syllableCount");
  const syllableStyle = $("#syllableStyle");
  const syllableToggle = $("#syllableToggle");
  const stylePreset = $("#stylePreset");
  const syllableRate = $("#syllableRate");
  const syllableGap = $("#syllableGap");
  const syllableArtic = $("#syllableArtic");

  const volVal = $("#volVal");
  const vibDepthVal = $("#vibDepthVal");
  const vibRateVal = $("#vibRateVal");
  const driveVal = $("#driveVal");
  const wahVal = $("#wahVal");
  const mouthAmpVal = $("#mouthAmpVal");
  const eyeColorVal = $("#eyeColorVal");
  const sakaEyePalette = $("#sakaEyePalette");
  const rangeVal = $("#rangeVal");
  const speedVal = $("#speedVal");
  const songProgress = $("#songProgress");
  const songNote = $("#songNote");
  const syllableCountVal = $("#syllableCountVal");
  const stylePresetVal = $("#stylePresetVal");
  const phonemeEngine = $("#phonemeEngine");
  const syllableRateVal = $("#syllableRateVal");
  const syllableGapVal = $("#syllableGapVal");
  const syllableArticVal = $("#syllableArticVal");

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

  const SYLLABLE_STYLES = {
    off:   { name: "off",   dryMix: 1.0,  formantMix: 0.0, sustain: 0.0, aF1: 800, aF2: 1400, nF1: 300, nF2: 1000, q: 8, glide: 0.04, noiseGain: 0.0 },
    soft:  { name: "soft",  dryMix: 0.9,  formantMix: 0.45, sustain: 0.65, aF1: 650, aF2: 1200, nF1: 300, nF2: 1000, q: 6, glide: 0.05, noiseGain: 0.0 },
    cute:  { name: "cute",  dryMix: 0.6,  formantMix: 0.8,  sustain: 0.75, aF1: 750, aF2: 1550, nF1: 320, nF2: 1050, q: 8, glide: 0.04, noiseGain: 0.015 },
    robot: { name: "robot", dryMix: 0.5,  formantMix: 0.9,  sustain: 0.7,  aF1: 500, aF2: 1100, nF1: 250, nF2: 900,  q: 12,glide: 0.025,noiseGain: 0.03 },
    opera: { name: "opera", dryMix: 0.75, formantMix: 0.7,  sustain: 0.7,  aF1: 900, aF2: 1400, nF1: 320, nF2: 1000, q: 5, glide: 0.06, noiseGain: 0.0 },
  };

  const VOWEL_FORMANTS = {
    a: { f1: 800, f2: 1150, f3: 2900 },
    i: { f1: 300, f2: 2200, f3: 3000 },
    u: { f1: 350, f2: 600,  f3: 2700 },
    o: { f1: 450, f2: 800,  f3: 2830 },
    e: { f1: 400, f2: 2000, f3: 2600 },
  };

  const SYLLABLE_TYPES = {
    na:  { vowel: "a", consType: "nasal", consDur: 0.05, transDur: 0.06, consF1: 280, consF2: 900,  brightness: 0.85, noise: null },
    da:  { vowel: "a", consType: "plosive", consDur: 0.03, transDur: 0.05, consF1: 420, consF2: 1500, brightness: 1.05, noise: { kind: "plosive", c: 3400, q: 5, g: 0.18, d: 0.03, hp: 2800 } },
    sa:  { vowel: "a", consType: "fricative", consDur: 0.11, transDur: 0.06, consF1: 420, consF2: 1600, brightness: 1.1,  noise: { kind: "fricative", c: 7600, q: 7, g: 0.14, d: 0.14, hp: 2200 } },
    shi: { vowel: "i", consType: "fricative", consDur: 0.12, transDur: 0.06, consF1: 340, consF2: 2100, brightness: 1.15, noise: { kind: "fricative", c: 4300, q: 6, g: 0.13, d: 0.15, hp: 1700 } },
    ma:  { vowel: "a", consType: "nasal", consDur: 0.055, transDur: 0.06, consF1: 260, consF2: 820,  brightness: 0.8,  noise: null },
    la:  { vowel: "e", consType: "liquid", consDur: 0.04, transDur: 0.05, consF1: 520, consF2: 1500, brightness: 1.05, noise: null },
  };

  const VOICE_PRESETS = {
    0: { name: "Clean",  copies: 1, voiceMix: 0.35, noiseMul: 0.7, qMul: 0.9, detuneMul: 0.6, brightness: 0.9, consonantMul: 0.8 },
    1: { name: "Otama",  copies: 1, voiceMix: 1.0,  noiseMul: 1.0, qMul: 1.0, detuneMul: 1.0, brightness: 1.0, consonantMul: 1.0 },
    2: { name: "Kuri",   copies: 3, voiceMix: 1.35, noiseMul: 1.2, qMul: 1.1, detuneMul: 1.4, brightness: 1.05, consonantMul: 1.15 },
    3: { name: "Robot",  copies: 2, voiceMix: 1.2,  noiseMul: 0.8, qMul: 1.25, detuneMul: 1.15, brightness: 1.1, consonantMul: 1.2 },
    4: { name: "Whisper",copies: 1, voiceMix: 0.6,  noiseMul: 1.4, qMul: 0.85, detuneMul: 0.8, brightness: 0.85, consonantMul: 0.7 },
  };

  // --- Avatar mode ---
  let avatarMode = "cat";
  const storedAvatar = localStorage.getItem("otama_avatar_mode");
  if (storedAvatar === "cat" || storedAvatar === "saka") avatarMode = storedAvatar;
  let syllableStyleValue = localStorage.getItem("otama_syllable_style") || "";
  let syllableStyleUserSet = !!syllableStyleValue;
  let syllableEnabled = localStorage.getItem("otama_syllable_on");
  syllableEnabled = syllableEnabled === null ? true : syllableEnabled === "1";
  let stylePresetValue = Number(localStorage.getItem("otama_style_preset"));
  if (!Number.isFinite(stylePresetValue)) stylePresetValue = 1;
  stylePresetValue = clamp(stylePresetValue, 0, 4);
  let phonemeEngineValue = localStorage.getItem("otama_phoneme_engine") || "formant";
  if (phonemeEngineValue !== "formant" && phonemeEngineValue !== "tadpole") phonemeEngineValue = "formant";
  let sakaEyePaletteValue = localStorage.getItem("otama_saka_eye_palette") || "classic";
  let syllRateHz = Number(localStorage.getItem("otama_syll_rate_hz"));
  if (!Number.isFinite(syllRateHz)) syllRateHz = 7.5;
  let syllGapMs = Number(localStorage.getItem("otama_syll_gap_ms"));
  if (!Number.isFinite(syllGapMs)) syllGapMs = 25;
  let syllArtic = Number(localStorage.getItem("otama_syll_artic"));
  if (!Number.isFinite(syllArtic)) syllArtic = 0.75;

  function applyAvatarMode() {
    if (head) {
      head.classList.toggle("mode-cat", avatarMode === "cat");
      head.classList.toggle("mode-saka", avatarMode === "saka");
    }
    if (avatarToggleBtn) {
      avatarToggleBtn.textContent = avatarMode === "cat" ? "🐱" : "🐟";
    }
    if (!syllableStyleUserSet) {
      syllableStyleValue = avatarMode === "saka" ? "cute" : "off";
      if (syllableStyle) syllableStyle.value = syllableStyleValue;
      if (engine.isReady) engine.setSyllableStyle(syllableEnabled ? syllableStyleValue : "off");
    }
    updateMouthPath();
    updateEars();
    updateWhiskers(performance.now());
  }

  // --- Audio Engine (Web Audio API) ---
  class Engine {
    constructor() {
      this.ctx = null;
      this.master = null;

      this.osc = null;
      this.oscGain = null;
      this.osc2 = null;
      this.osc2Gain = null;

      this.filter = null;
      this.shaper = null;
      this.postMix = null;
      this.dryPostGain = null;
      this.crusher = null;
      this.crushGain = null;
      this.dryGain = null;
      this.formantMixGain = null;
      this.formantSum = null;
      this.formantBanks = [];
      this.nasalBP = null;
      this.nasalGain = null;
      this.syllableGateGain = null;
      this.noise = null;
      this.noiseGain = null;
      this.noiseHP = null;
      this.noiseBuf = null;
      this.voiceMixMul = 1.0;
      this.voiceStyle = { copies: 1, detuneMul: 1.0, noiseMul: 1.0, qMul: 1.0, brightness: 1.0, consonantMul: 1.0 };
      this.phonemeEngine = "formant";
      this.crushBits = 6;
      this.crushNormFreq = 0.18;
      this.crushPhase = 0;
      this.crushLast = 0;

      this.analyser = null;

      this.lfo = null;
      this.lfoGain = null;

      this.isReady = false;
      this.isOn = false;
      this.syllableStyle = "off";
      this.syllableParams = null;
      this.syllRateHz = 7.5;
      this.syllGapMs = 25;
      this.syllArticulation = 0.75;

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

      this.osc2 = this.ctx.createOscillator();
      this.osc2.type = "sawtooth";
      this.osc2.frequency.value = this.targetFreq * 1.01;
      this.osc2Gain = this.ctx.createGain();
      this.osc2Gain.gain.value = 0.0;

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
      this.lfoGain.connect(this.osc2.frequency);

      // Audio graph
      // osc -> oscGain -> filter -> (dry + formant) -> shaper -> master -> analyser -> destination
      this.osc.connect(this.oscGain);
      this.osc2.connect(this.osc2Gain);
      this.osc2Gain.connect(this.oscGain);
      this.oscGain.connect(this.filter);

      this.dryGain = this.ctx.createGain();
      this.dryGain.gain.value = 1.0;

      this.formantSum = this.ctx.createGain();
      this.formantMixGain = this.ctx.createGain();
      this.formantMixGain.gain.value = 0.0;

      this.filter.connect(this.dryGain);

      // Formant banks (for "voice copies" / grain)
      const bankDefs = [
        { detune: 0.0, delay: 0.0, pan: 0.0, gain: 1.0 },
        { detune: 0.012, delay: 0.008, pan: -0.12, gain: 0.6 },
        { detune: -0.010, delay: 0.014, pan: 0.12, gain: 0.55 },
      ];
      this.formantBanks = bankDefs.map((def) => {
        const f1 = this.ctx.createBiquadFilter();
        const f2 = this.ctx.createBiquadFilter();
        const f3 = this.ctx.createBiquadFilter();
        f1.type = "bandpass";
        f2.type = "bandpass";
        f3.type = "bandpass";
        f1.frequency.value = 800;
        f2.frequency.value = 1400;
        f3.frequency.value = 2900;
        f1.Q.value = 8;
        f2.Q.value = 8;
        f3.Q.value = 8;

        const g1 = this.ctx.createGain();
        const g2 = this.ctx.createGain();
        const g3 = this.ctx.createGain();
        g1.gain.value = 0.6;
        g2.gain.value = 0.5;
        g3.gain.value = 0.35;

        const sum = this.ctx.createGain();
        const bankGain = this.ctx.createGain();
        bankGain.gain.value = def.gain;
        const delay = this.ctx.createDelay(0.05);
        delay.delayTime.value = def.delay;
        const pan = this.ctx.createStereoPanner();
        pan.pan.value = def.pan;

        this.filter.connect(f1);
        this.filter.connect(f2);
        this.filter.connect(f3);
        f1.connect(g1);
        f2.connect(g2);
        f3.connect(g3);
        g1.connect(sum);
        g2.connect(sum);
        g3.connect(sum);
        sum.connect(bankGain);
        bankGain.connect(delay);
        delay.connect(pan);
        pan.connect(this.formantSum);

        return { f1, f2, f3, g1, g2, g3, sum, bankGain, delay, pan, detune: def.detune, baseGain: def.gain, baseDelay: def.delay, basePan: def.pan };
      });

      // Nasal helper for "n/m" onsets (kept very subtle)
      this.nasalBP = this.ctx.createBiquadFilter();
      this.nasalBP.type = "bandpass";
      this.nasalBP.frequency.value = 250;
      this.nasalBP.Q.value = 8;
      this.nasalGain = this.ctx.createGain();
      this.nasalGain.gain.value = 0.0;
      this.filter.connect(this.nasalBP);
      this.nasalBP.connect(this.nasalGain);
      this.nasalGain.connect(this.formantSum);

      this.formantSum.connect(this.formantMixGain);

      this.dryGain.connect(this.shaper);
      this.formantMixGain.connect(this.shaper);

      // Post mix (tadpole bitcrush path)
      this.postMix = this.ctx.createGain();
      this.dryPostGain = this.ctx.createGain();
      this.dryPostGain.gain.value = 1.0;
      this.crushGain = this.ctx.createGain();
      this.crushGain.gain.value = 0.0;
      this.crusher = this.ctx.createScriptProcessor(512, 1, 1);
      this.crusher.onaudioprocess = (e) => {
        const input = e.inputBuffer.getChannelData(0);
        const output = e.outputBuffer.getChannelData(0);
        const step = Math.pow(0.5, this.crushBits);
        let phase = this.crushPhase;
        let last = this.crushLast;
        const freq = this.crushNormFreq;
        for (let i = 0; i < input.length; i++) {
          phase += freq;
          if (phase >= 1.0) {
            phase -= 1.0;
            last = step * Math.floor(input[i] / step + 0.5);
          }
          output[i] = last;
        }
        this.crushPhase = phase;
        this.crushLast = last;
      };
      this.shaper.connect(this.dryPostGain);
      this.dryPostGain.connect(this.postMix);
      this.shaper.connect(this.crusher);
      this.crusher.connect(this.crushGain);
      this.crushGain.connect(this.postMix);

      // Precomputed noise buffer for consonant bursts
      this.noiseBuf = this.ctx.createBuffer(1, this.ctx.sampleRate, this.ctx.sampleRate);
      const ndata = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < ndata.length; i++) ndata[i] = Math.random() * 2 - 1;

      this.syllableGateGain = this.ctx.createGain();
      this.syllableGateGain.gain.value = 1.0;

      this.postMix.connect(this.syllableGateGain);
      this.syllableGateGain.connect(this.master);
      this.master.connect(this.analyser);
      this.analyser.connect(this.ctx.destination);

      // start sources
      this.osc.start();
      this.osc2.start();
      this.lfo.start();

      // initial tone
      this.setMouthOpen(params.mouthOpen, true);
      this.setSyllableStyle("off");

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

    // Syllable styles (formant mix + n->a glide)
    setSyllableStyle(styleName) {
      if (!this.isReady) return;
      this.syllableStyle = styleName;
      this.syllableParams = SYLLABLE_STYLES[styleName] || SYLLABLE_STYLES.off;
      const { dryMix, formantMix } = this.syllableParams;
      const voice = formantMix * this.voiceMixMul;
      const dry = dryMix * (0.9 + 0.1 * (1 - this.voiceMixMul));
      this.dryGain.gain.setTargetAtTime(dry, this.ctx.currentTime, 0.02);
      this.formantMixGain.gain.setTargetAtTime(voice, this.ctx.currentTime, 0.02);
      if (this.syllableGateGain) {
        const base = this.syllableStyle === "off" ? 1.0 : 1.0;
        this.syllableGateGain.gain.setTargetAtTime(base, this.ctx.currentTime, 0.01);
      }
      this.applyPhonemeEngine();
    }

    setPhonemeEngine(mode="formant") {
      if (!this.isReady) return;
      this.phonemeEngine = mode === "tadpole" ? "tadpole" : "formant";
      this.applyPhonemeEngine();
    }

    applyPhonemeEngine() {
      if (!this.isReady) return;
      const now = this.ctx.currentTime;
      const syllOn = this.syllableStyle !== "off";
      const tadpoleOn = this.phonemeEngine === "tadpole" && syllOn;
      const styleBoost = this.voiceStyle?.copies === 3 ? 1.15 : 1.0;
      const osc2Target = tadpoleOn ? 0.14 * styleBoost : 0.0;
      const crushTarget = tadpoleOn ? 0.35 * styleBoost : 0.0;
      if (this.osc2Gain) this.osc2Gain.gain.setTargetAtTime(osc2Target, now, 0.02);
      if (this.crushGain) this.crushGain.gain.setTargetAtTime(crushTarget, now, 0.02);
      if (this.dryPostGain) this.dryPostGain.gain.setTargetAtTime(1.0, now, 0.02);
      this.crushBits = tadpoleOn ? 6 : 8;
      this.crushNormFreq = tadpoleOn ? 0.2 : 0.08;
    }

    // Voice strength controlled by style preset
    setVoiceStylePreset(preset=1) {
      if (!this.isReady) return;
      const cfg = VOICE_PRESETS[preset] || VOICE_PRESETS[1];
      this.voiceMixMul = cfg.voiceMix;
      this.voiceStyle = {
        copies: cfg.copies,
        detuneMul: cfg.detuneMul,
        noiseMul: cfg.noiseMul,
        qMul: cfg.qMul,
        brightness: cfg.brightness,
        consonantMul: cfg.consonantMul,
      };
      const now = this.ctx.currentTime;
      this.formantBanks.forEach((bank, i) => {
        const target = i < cfg.copies ? bank.baseGain : 0.0;
        bank.bankGain.gain.cancelScheduledValues(now);
        bank.bankGain.gain.setTargetAtTime(target, now, 0.03);
        bank.delay.delayTime.setTargetAtTime(bank.baseDelay, now, 0.03);
        bank.pan.pan.setTargetAtTime(bank.basePan, now, 0.03);
      });
      if (this.syllableStyle) this.setSyllableStyle(this.syllableStyle);
      this.applyPhonemeEngine();
    }

    // Syllable articulation controls (rate/gap/articulation)
    setSyllableParams(rateHz, gapMs, artic) {
      this.syllRateHz = clamp(rateHz, 3, 12);
      this.syllGapMs = clamp(gapMs, 0, 60);
      this.syllArticulation = clamp(artic, 0, 1);
    }

    triggerSyllable(when, vel=0.9, dur=0.25, count=1, type="na") {
      if (!this.isReady) return;
      const p = this.syllableParams || SYLLABLE_STYLES.off;
      if (!p || p.name === "off") return;

      const now = this.ctx.currentTime;
      const t0 = Math.max(when, now);
      const attack = lerp(0.012, 0.004, this.syllArticulation);
      const decay = 0.08;
      const release = lerp(0.03, 0.01, this.syllArticulation);
      const gap = Math.max(0.015, this.syllGapMs / 1000);
      const period = 1 / Math.max(3, this.syllRateHz);
      const maxByRate = Math.max(1, Math.floor(dur / period) + 1);
      const pulses = Math.max(1, Math.min(Math.floor(count) || 1, maxByRate));
      const pulseAmp = lerp(0.55, 1.0, this.syllArticulation) * (0.7 + vel * 0.3);
      const typeCfg = SYLLABLE_TYPES[type] || SYLLABLE_TYPES.na;
      const vowel = VOWEL_FORMANTS[typeCfg.vowel] || VOWEL_FORMANTS.a;
      const seg = Math.max(0.06, period);
      const mix = p.formantMix * this.voiceMixMul;
      const style = this.voiceStyle || { detuneMul: 1.0, noiseMul: 1.0, qMul: 1.0, brightness: 1.0, consonantMul: 1.0 };

      this.formantMixGain.gain.cancelScheduledValues(t0);
      if (this.syllableGateGain) this.syllableGateGain.gain.cancelScheduledValues(t0);
      if (this.nasalGain) this.nasalGain.gain.cancelScheduledValues(t0);
      this.formantBanks.forEach((bank) => {
        bank.f1.frequency.cancelScheduledValues(t0);
        bank.f2.frequency.cancelScheduledValues(t0);
        bank.f3.frequency.cancelScheduledValues(t0);
        bank.f1.Q.cancelScheduledValues(t0);
        bank.f2.Q.cancelScheduledValues(t0);
        bank.f3.Q.cancelScheduledValues(t0);
        bank.g1.gain.cancelScheduledValues(t0);
        bank.g2.gain.cancelScheduledValues(t0);
        bank.g3.gain.cancelScheduledValues(t0);
      });

      for (let i = 0; i < pulses; i++) {
        const t = t0 + i * seg;
        const hold = Math.max(0, seg - attack - release - gap);
        const consDur = typeCfg.consDur ?? 0.04;
        const transDur = typeCfg.transDur ?? p.glide;
        const tTransEnd = t + consDur + transDur;
        const bright = (typeCfg.brightness ?? 1.0) * style.brightness;

        // Syllable gate pulse (clear "na-na-na" gaps)
        if (this.syllableGateGain) {
          const pre = pulseAmp * 0.28;
          this.syllableGateGain.gain.setValueAtTime(pre, t);
          this.syllableGateGain.gain.linearRampToValueAtTime(pulseAmp, t + attack);
          this.syllableGateGain.gain.setValueAtTime(pulseAmp, t + attack + hold);
          this.syllableGateGain.gain.linearRampToValueAtTime(0.0, t + attack + hold + release);
        }

        this.formantMixGain.gain.setValueAtTime(0.0, t);
        this.formantMixGain.gain.linearRampToValueAtTime(mix * (0.6 + vel * 0.4), t + attack);
        this.formantMixGain.gain.linearRampToValueAtTime(mix * p.sustain, t + attack + decay);
        this.formantMixGain.gain.linearRampToValueAtTime(0.0, t + attack + hold + release);

        // Consonant phase -> transition -> vowel (formant glide)
        const consF1 = typeCfg.consF1 ?? 420;
        const consF2 = typeCfg.consF2 ?? 1200;
        const q = p.q * style.qMul;
        this.formantBanks.forEach((bank) => {
          const detune = 1 + bank.detune * style.detuneMul;
          bank.f1.frequency.setValueAtTime(consF1 * detune, t);
          bank.f2.frequency.setValueAtTime(consF2 * detune, t);
          bank.f3.frequency.setValueAtTime(vowel.f3 * detune, t);
          bank.f1.frequency.linearRampToValueAtTime(vowel.f1 * detune, tTransEnd);
          bank.f2.frequency.linearRampToValueAtTime(vowel.f2 * detune, tTransEnd);
          bank.f3.frequency.linearRampToValueAtTime(vowel.f3 * detune, tTransEnd);
          bank.f1.Q.setValueAtTime(q, t);
          bank.f2.Q.setValueAtTime(q, t);
          bank.f3.Q.setValueAtTime(q, t);
          bank.g1.gain.setValueAtTime(0.6, t);
          bank.g2.gain.setValueAtTime(0.5, t);
          bank.g3.gain.setValueAtTime(0.35 * bright, t);
          if (typeCfg.consType === "nasal") {
            bank.g3.gain.setValueAtTime(0.18 * bright, t);
            bank.g3.gain.linearRampToValueAtTime(0.35 * bright, tTransEnd);
          }
        });

        // Nasal helper during consonant phase
        if (this.nasalGain) {
          if (typeCfg.consType === "nasal") {
            const nasalPeak = 0.18 * style.consonantMul;
            this.nasalGain.gain.setValueAtTime(0.0, t);
            this.nasalGain.gain.linearRampToValueAtTime(nasalPeak, t + 0.01);
            this.nasalGain.gain.linearRampToValueAtTime(0.0, tTransEnd);
          } else {
            this.nasalGain.gain.setValueAtTime(0.0, t);
          }
        }

        // Consonant transient noise
        if (typeCfg.noise) {
          const burst = this.ctx.createBufferSource();
          burst.buffer = this.noiseBuf;
          const hp = this.ctx.createBiquadFilter();
          hp.type = "highpass";
          hp.frequency.value = typeCfg.noise.hp || 1800;
          const bp = this.ctx.createBiquadFilter();
          bp.type = "bandpass";
          bp.frequency.value = typeCfg.noise.c;
          bp.Q.value = typeCfg.noise.q;
          const g = this.ctx.createGain();
          const noisePeak = typeCfg.noise.g * style.noiseMul * style.consonantMul * (0.7 + vel * 0.5);
          const nStart = t + Math.min(0.006, attack * 0.6);
          g.gain.setValueAtTime(0.0, nStart);
          g.gain.linearRampToValueAtTime(noisePeak, nStart + 0.004);
          g.gain.linearRampToValueAtTime(0.0, nStart + typeCfg.noise.d);
          burst.connect(hp);
          hp.connect(bp);
          bp.connect(g);
          g.connect(this.formantSum);
          burst.start(nStart);
          burst.stop(nStart + typeCfg.noise.d + 0.03);
        }
      }
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
      if (this.osc2) {
        this.osc2.frequency.cancelScheduledValues(now);
        this.osc2.frequency.setTargetAtTime(freqHz * 1.01, now, 0.012);
      }
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
        if (this.formantMixGain) {
          this.formantMixGain.gain.cancelScheduledValues(now);
          this.formantMixGain.gain.setTargetAtTime(0.0, now, 0.02);
        }
        if (this.syllableGateGain) {
          this.syllableGateGain.gain.cancelScheduledValues(now);
          this.syllableGateGain.gain.setTargetAtTime(1.0, now, 0.02);
        }
        if (this.nasalGain) {
          this.nasalGain.gain.cancelScheduledValues(now);
          this.nasalGain.gain.setTargetAtTime(0.0, now, 0.02);
        }
      }
    }

    stopAll() {
      if (!this.isReady) return;
      this.gate(false);
      this.setMouthOpen(0.35);
      this.setFrequency(220);
      if (this.formantMixGain) {
        const now = this.ctx.currentTime;
        this.formantMixGain.gain.cancelScheduledValues(now);
        this.formantMixGain.gain.setTargetAtTime(0.0, now, 0.02);
      }
      if (this.syllableGateGain) {
        const now = this.ctx.currentTime;
        this.syllableGateGain.gain.cancelScheduledValues(now);
        this.syllableGateGain.gain.setTargetAtTime(1.0, now, 0.02);
      }
      if (this.nasalGain) {
        const now = this.ctx.currentTime;
        this.nasalGain.gain.cancelScheduledValues(now);
        this.nasalGain.gain.setTargetAtTime(0.0, now, 0.02);
      }
      if (this.formantBanks.length) {
        const now = this.ctx.currentTime;
        this.formantBanks.forEach((bank) => {
          bank.f1.frequency.cancelScheduledValues(now);
          bank.f2.frequency.cancelScheduledValues(now);
          bank.f3.frequency.cancelScheduledValues(now);
          bank.g1.gain.cancelScheduledValues(now);
          bank.g2.gain.cancelScheduledValues(now);
          bank.g3.gain.cancelScheduledValues(now);
        });
      }
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
      if (syllableStyle && this.engine.isReady) {
        this.engine.setSyllableStyle(syllableEnabled ? (syllableStyle.value || "off") : "off");
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
      const open = clamp(lerp(0.25, 0.9, params.pitchT), 0.25, 1);

      const startDelay = Math.max(0, (when - this.engine.ctx.currentTime) * 1000);
      if (syllableEnabled) {
        const sc = syllableCount ? Number(syllableCount.value) : 1;
        const st = syllableType ? syllableType.value : "na";
        this.engine.triggerSyllable(when, vel, dur, sc, st);
      }
      const startT = setTimeout(() => {
        if (!this.isPlaying) return;
        this.engine.setFrequency(freq);
        this.engine.gate(true);
        setRibbonCursorFromFreq(freq);
        setPitchFromFreq(freq);
        applyMouthOpen(clamp(lerp(0.25, 0.9, params.pitchT), 0.25, 1));
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
          if (pointers.mouthId === null) {
            applyMouthOpen(clamp(lerp(0.25, 0.9, params.pitchT), 0.25, 1));
          }
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

    if (avatarMode === "saka") {
      const scale = 5.12; // map 0..100 to viewBox 0..512
      const ySplit = 52;
      const yTop = ySplit + 1;
      const yTip = yTop + lerp(10, 22, open);
      const xL = 42;
      const xR = 58;
      const d = [
        `M ${xL * scale} ${yTop * scale}`,
        `L ${xR * scale} ${yTop * scale}`,
        `L ${50 * scale} ${yTip * scale}`,
        "Z",
      ].join(" ");
      mouthUpper.setAttribute("d", d);
      mouthUpper.style.fill = "rgba(15,10,8,0.95)";
      mouthLower.setAttribute("d", "");
      mouthLower.style.fill = "transparent";
      return;
    }

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
    const sakaY = lerp(12, -12, pitchHi);
    const sakaX = lerp(-5, 5, pitchHi);
    const sakaEyeY = sakaY * 0.45;
    const sakaEyeX = sakaX * 0.45;
    const sakaEyeS = 1 + pitchHi * 0.07;
    if (eyeLeft) {
      eyeLeft.style.setProperty("--eye-y", `${eyeY}px`);
      eyeLeft.style.setProperty("--eye-s", `${eyeS}`);
      if (avatarMode !== "saka") eyeLeft.style.setProperty("--pupil-y", `${pupilY}px`);
      eyeLeft.style.setProperty("--pupil-s", `${pupilS}`);
      if (avatarMode === "saka") {
        eyeLeft.style.setProperty("--pupil-x", `${sakaX}px`);
        eyeLeft.style.setProperty("--pupil-y", `${sakaY}px`);
        eyeLeft.style.setProperty("--eye-x", `${sakaEyeX}px`);
        eyeLeft.style.setProperty("--eye-y", `${sakaEyeY}px`);
        eyeLeft.style.setProperty("--eye-scale", `${sakaEyeS}`);
      } else {
        eyeLeft.style.setProperty("--pupil-x", "0px");
        eyeLeft.style.setProperty("--eye-x", "0px");
        eyeLeft.style.setProperty("--eye-scale", "1");
      }
    }
    if (eyeRight) {
      eyeRight.style.setProperty("--eye-y", `${eyeY}px`);
      eyeRight.style.setProperty("--eye-s", `${eyeS}`);
      if (avatarMode !== "saka") eyeRight.style.setProperty("--pupil-y", `${pupilY}px`);
      eyeRight.style.setProperty("--pupil-s", `${pupilS}`);
      if (avatarMode === "saka") {
        eyeRight.style.setProperty("--pupil-x", `${-sakaX}px`);
        eyeRight.style.setProperty("--pupil-y", `${sakaY}px`);
        eyeRight.style.setProperty("--eye-x", `${-sakaEyeX}px`);
        eyeRight.style.setProperty("--eye-y", `${sakaEyeY}px`);
        eyeRight.style.setProperty("--eye-scale", `${sakaEyeS}`);
      } else {
        eyeRight.style.setProperty("--pupil-x", "0px");
        eyeRight.style.setProperty("--eye-x", "0px");
        eyeRight.style.setProperty("--eye-scale", "1");
      }
    }
  }

  function updateEars() {
    if (avatarMode === "saka") return;
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
    if (avatarMode === "saka") return;
    const t = clamp(params.pitchT, 0, 1);
    const energy = (engine.isOn ? 1 : 0.4) * lerp(0.6, 1.0, 1 - t);
    const baseLeft = [20, 6, -10];
    const baseRight = [-20, -6, 10];
    const yOffsets = [-9, 0, 9];
    whiskerLeft.forEach((w, i) => {
      const jitter = Math.sin(now * 0.004 + i * 1.7) * 2.5 * energy;
      w.style.setProperty("--whisker-rot", `${baseLeft[i] + jitter}deg`);
      w.style.setProperty("--whisker-y", `${yOffsets[i]}px`);
    });
    whiskerRight.forEach((w, i) => {
      const jitter = Math.sin(now * 0.004 + i * 1.9 + 1.4) * 2.5 * energy;
      w.style.setProperty("--whisker-rot", `${baseRight[i] + jitter}deg`);
      w.style.setProperty("--whisker-y", `${yOffsets[i]}px`);
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
    updateEyes(params.mouthOpen);
  }

  function setPitchFromFreq(freq) {
    const { fMin, fMax } = getRangeBounds();
    const f = freq / Math.pow(2, params.octave);
    const t = clamp(Math.log(f / fMax) / Math.log(fMin / fMax), 0, 1);
    params.pitchT = t;
    updateEars();
    updateEyes(params.mouthOpen);
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
    const open = lerp(0.25, 0.9, t); // higher pitch -> smaller mouth
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
  let syllableHoldTimer = null;

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
      const initPromise = engine.init().then(() => {
        engine.setVoiceStylePreset(stylePresetValue);
        engine.setPhonemeEngine(phonemeEngineValue);
        engine.setSyllableParams(syllRateHz, syllGapMs, syllArtic);
        if (syllableStyle) {
          const style = syllableEnabled ? (syllableStyle.value || "off") : "off";
          engine.setSyllableStyle(style);
        } else if (!syllableStyleUserSet) {
          engine.setSyllableStyle(avatarMode === "saka" ? "cute" : "off");
        }
      }).catch((err) => {
        console.error(err);
      });
      btnPower.textContent = "声音已启用";
      btnPower.classList.add("active");
      return initPromise;
    } else if (engine.ctx && engine.ctx.state !== "running") {
      engine.ctx.resume();
    }
    return Promise.resolve();
  }

  function stopSyllableHold() {
    if (syllableHoldTimer) {
      clearInterval(syllableHoldTimer);
      syllableHoldTimer = null;
    }
  }

  function startSyllableHold(vel) {
    if (!syllableEnabled || !engine.isReady) return;
    stopSyllableHold();
    const sc = syllableCount ? Number(syllableCount.value) : 1;
    const st = syllableType ? syllableType.value : "na";
    const dur = 0.9;
    engine.triggerSyllable(engine.ctx.currentTime, vel, dur, sc, st);
    const interval = Math.max(0.35, 0.9 * (6 / Math.max(3, syllRateHz)));
    syllableHoldTimer = setInterval(() => {
      if (!engine.isOn || !engine.isReady) return;
      engine.triggerSyllable(engine.ctx.currentTime, vel, dur, sc, st);
    }, interval * 1000);
  }

  ribbon.addEventListener("pointerdown", (ev) => {
    const needsInit = !engine.isReady;
    const initPromise = ensureAudioFromGesture();

    if (pointers.ribbonId !== null) return; // already taken
    pointers.ribbonId = ev.pointerId;
    ribbon.setPointerCapture(ev.pointerId);
    ribbon.classList.add("active");

    const f = getRibbonFreqFromPointer(ev.clientY);
    pointers.lastFreq = f;
    const startSound = () => {
      if (!engine.isReady) return;
      engine.setFrequency(pointers.lastFreq ?? f);
      if (syllableEnabled) startSyllableHold(clamp(params.volume, 0.2, 1));
      engine.gate(true);
    };
    if (!needsInit) {
      startSound();
    } else {
      initPromise.then(() => {
        if (pointers.ribbonId === ev.pointerId) startSound();
      });
    }

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
    stopSyllableHold();
    engine.gate(false);
    updateReadout(null);
  }

  ribbon.addEventListener("pointerup", endRibbonPointer);
  ribbon.addEventListener("pointercancel", endRibbonPointer);
  ribbon.addEventListener("lostpointercapture", (ev) => {
    if (pointers.ribbonId === ev.pointerId) {
      ribbon.classList.remove("active");
      pointers.ribbonId = null;
      stopSyllableHold();
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
    engine.setVoiceStylePreset(stylePresetValue);
    engine.setSyllableParams(syllRateHz, syllGapMs, syllArtic);
    if (syllableStyle) engine.setSyllableStyle(syllableEnabled ? (syllableStyle.value || "off") : "off");
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

  if (avatarToggleBtn) {
    avatarToggleBtn.addEventListener("click", () => {
      avatarMode = avatarMode === "cat" ? "saka" : "cat";
      localStorage.setItem("otama_avatar_mode", avatarMode);
      applyAvatarMode();
    });
  }

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

  // --- Syllable style UI ---
  if (syllableStyle) {
    if (!syllableStyleUserSet) {
      syllableStyleValue = avatarMode === "saka" ? "cute" : "off";
    }
    syllableStyle.value = syllableStyleValue || "off";
    if (engine.isReady) engine.setSyllableStyle(syllableStyle.value);
    syllableStyle.addEventListener("change", () => {
      syllableStyleUserSet = true;
      syllableStyleValue = syllableStyle.value;
      localStorage.setItem("otama_syllable_style", syllableStyleValue);
      if (engine.isReady && syllableEnabled) engine.setSyllableStyle(syllableStyleValue);
    });
  }

  if (phonemeEngine) {
    phonemeEngine.value = phonemeEngineValue;
    phonemeEngine.addEventListener("change", () => {
      phonemeEngineValue = phonemeEngine.value === "tadpole" ? "tadpole" : "formant";
      localStorage.setItem("otama_phoneme_engine", phonemeEngineValue);
      if (engine.isReady) engine.setPhonemeEngine(phonemeEngineValue);
    });
  }

  if (syllableToggle) {
    syllableToggle.checked = syllableEnabled;
    syllableToggle.addEventListener("change", () => {
      syllableEnabled = syllableToggle.checked;
      localStorage.setItem("otama_syllable_on", syllableEnabled ? "1" : "0");
      if (engine.isReady) {
        engine.setSyllableStyle(syllableEnabled ? (syllableStyle?.value || "off") : "off");
      }
    });
  }

  if (syllableType) {
    const savedType = localStorage.getItem("otama_syllable_type");
    if (savedType && SYLLABLE_TYPES[savedType]) syllableType.value = savedType;
    syllableType.addEventListener("change", () => {
      localStorage.setItem("otama_syllable_type", syllableType.value);
    });
  }

  if (syllableCount) {
    syllableCount.value = syllableCount.value || "1";
    const updateCountVal = () => {
      if (syllableCountVal) syllableCountVal.textContent = `${syllableCount.value}x`;
    };
    updateCountVal();
    syllableCount.addEventListener("input", updateCountVal);
  }

  if (syllableRate) {
    syllableRate.value = String(syllRateHz);
    const updateRate = () => {
      syllRateHz = Number(syllableRate.value);
      if (syllableRateVal) syllableRateVal.textContent = `${syllRateHz.toFixed(1)} Hz`;
      localStorage.setItem("otama_syll_rate_hz", String(syllRateHz));
      if (engine.isReady) engine.setSyllableParams(syllRateHz, syllGapMs, syllArtic);
    };
    syllableRate.addEventListener("input", updateRate);
    updateRate();
  }

  if (syllableGap) {
    syllableGap.value = String(syllGapMs);
    const updateGap = () => {
      syllGapMs = Number(syllableGap.value);
      if (syllableGapVal) syllableGapVal.textContent = `${syllGapMs} ms`;
      localStorage.setItem("otama_syll_gap_ms", String(syllGapMs));
      if (engine.isReady) engine.setSyllableParams(syllRateHz, syllGapMs, syllArtic);
    };
    syllableGap.addEventListener("input", updateGap);
    updateGap();
  }

  if (syllableArtic) {
    syllableArtic.value = String(syllArtic);
    const updateArtic = () => {
      syllArtic = Number(syllableArtic.value);
      if (syllableArticVal) syllableArticVal.textContent = syllArtic.toFixed(2);
      localStorage.setItem("otama_syll_artic", String(syllArtic));
      if (engine.isReady) engine.setSyllableParams(syllRateHz, syllGapMs, syllArtic);
    };
    syllableArtic.addEventListener("input", updateArtic);
    updateArtic();
  }

  // --- Style preset (visual + voice strength) ---
  function applyStylePreset(preset) {
    const val = Math.max(0, Math.min(4, Number(preset)));
    stylePresetValue = val;
    const presetCfg = VOICE_PRESETS[val] || VOICE_PRESETS[1];
    const pattern = val === 0 ? 0.18 : val === 2 ? 0.40 : val === 3 ? 0.32 : val === 4 ? 0.22 : 0.28;
    const outline = val === 0 ? 0.65 : val === 2 ? 1.1 : val === 3 ? 1.05 : val === 4 ? 0.75 : 0.9;
    const highlight = val === 0 ? 0.08 : val === 2 ? 0.15 : val === 3 ? 0.12 : val === 4 ? 0.10 : 0.12;
    const vignette = val === 0 ? 0.10 : val === 2 ? 0.18 : val === 3 ? 0.16 : val === 4 ? 0.12 : 0.14;
    document.documentElement.style.setProperty("--pattern-opacity", pattern);
    document.documentElement.style.setProperty("--outline-mul", outline);
    document.documentElement.style.setProperty("--highlight-opacity", highlight);
    document.documentElement.style.setProperty("--vignette-opacity", vignette);
    if (engine.isReady) engine.setVoiceStylePreset(val);
    if (stylePresetVal) stylePresetVal.textContent = presetCfg.name || String(val);
    localStorage.setItem("otama_style_preset", String(val));
  }

  function applySakaEyePalette(preset) {
    const palettes = {
      classic: { eye: "#ffffff", iris: "#111111" },
      mint: { eye: "#f1fffb", iris: "#3a7f74" },
      sky: { eye: "#f4fbff", iris: "#4f86c9" },
      amber: { eye: "#fff8ed", iris: "#b76a2c" },
      plum: { eye: "#fbf2ff", iris: "#6a3f8f" },
    };
    const p = palettes[preset] || palettes.classic;
    if (head) {
      head.style.setProperty("--fish-eye", p.eye);
      head.style.setProperty("--fish-iris", p.iris);
    }
  }

  if (stylePreset) {
    stylePreset.value = String(stylePresetValue);
    stylePreset.addEventListener("input", () => applyStylePreset(stylePreset.value));
    applyStylePreset(stylePresetValue);
  }

  if (sakaEyePalette) {
    if (!["classic","mint","sky","amber","plum"].includes(sakaEyePaletteValue)) {
      sakaEyePaletteValue = "classic";
    }
    sakaEyePalette.value = sakaEyePaletteValue;
    applySakaEyePalette(sakaEyePaletteValue);
    sakaEyePalette.addEventListener("change", () => {
      sakaEyePaletteValue = sakaEyePalette.value;
      localStorage.setItem("otama_saka_eye_palette", sakaEyePaletteValue);
      applySakaEyePalette(sakaEyePaletteValue);
    });
  }

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
  applyAvatarMode();
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
