// SOLMARA — every sound is synthesized with WebAudio: no audio files, no
// network. A tiny synth for shots, punches and pickups, an engine hum that
// follows speed, a two-tone police siren, and a lazy sun-soaked music loop.

export function createAudio() {
  let context = null;
  let muted = false;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let musicTimer = null;
  let musicStep = 0;

  function ensure() {
    if (context) return context;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      context = new AudioContext();
    } catch {
      context = null;
    }
    return context;
  }

  function unlock() {
    const ctx = ensure();
    if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
  }

  function setMuted(value) {
    muted = value;
    if (engineGain) engineGain.gain.value = 0;
    if (sirenGain) sirenGain.gain.value = 0;
  }

  function isMuted() {
    return muted;
  }

  function tone(freq, seconds, type, volume, when = 0, slideTo = null) {
    if (muted) return;
    const ctx = ensure();
    if (!ctx) return;
    const start = ctx.currentTime + when;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, start);
    if (slideTo !== null) osc.frequency.exponentialRampToValueAtTime(slideTo, start + seconds);
    gain.gain.setValueAtTime(volume, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + seconds);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(start);
    osc.stop(start + seconds + 0.02);
  }

  function noiseBurst(seconds, volume, filterFreq) {
    if (muted) return;
    const ctx = ensure();
    if (!ctx) return;
    const length = Math.max(1, Math.floor(ctx.sampleRate * seconds));
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq;
    const gain = ctx.createGain();
    gain.gain.value = volume;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    source.start();
  }

  // One-shot effects, named for what they are.
  function shot() {
    noiseBurst(0.12, 0.5, 2400);
    tone(160, 0.08, 'square', 0.18, 0, 60);
  }

  function punch() {
    noiseBurst(0.08, 0.35, 500);
    tone(90, 0.1, 'sine', 0.3, 0, 50);
  }

  function pickup() {
    tone(660, 0.1, 'sine', 0.25);
    tone(990, 0.14, 'sine', 0.25, 0.09);
  }

  function cash() {
    tone(880, 0.09, 'triangle', 0.25);
    tone(1174, 0.09, 'triangle', 0.25, 0.08);
    tone(1568, 0.16, 'triangle', 0.25, 0.16);
  }

  function missionDone() {
    [523, 659, 784, 1046].forEach((freq, index) => tone(freq, 0.16, 'triangle', 0.28, index * 0.11));
  }

  function missionFail() {
    [392, 330, 262].forEach((freq, index) => tone(freq, 0.2, 'sawtooth', 0.16, index * 0.14));
  }

  function busted() {
    tone(220, 0.5, 'sawtooth', 0.2, 0, 110);
    tone(165, 0.6, 'sawtooth', 0.18, 0.3, 82);
  }

  function crash() {
    noiseBurst(0.25, 0.5, 900);
  }

  // The engine hum follows the car's speed; call every frame while driving.
  function engine(speedRatio) {
    if (muted) return;
    const ctx = ensure();
    if (!ctx) return;
    if (!engineOsc) {
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 420;
      engineOsc.connect(filter);
      filter.connect(engineGain);
      engineGain.connect(ctx.destination);
      engineOsc.start();
    }
    const target = 0.05 + speedRatio * 0.06;
    engineGain.gain.setTargetAtTime(target, ctx.currentTime, 0.08);
    engineOsc.frequency.setTargetAtTime(55 + speedRatio * 130, ctx.currentTime, 0.08);
  }

  function engineOff() {
    if (engineGain) engineGain.gain.setTargetAtTime(0, context.currentTime, 0.05);
  }

  // Two-tone siren while any police cruiser is close; call every frame.
  function siren(active) {
    if (muted || !active) {
      if (sirenGain) sirenGain.gain.setTargetAtTime(0, context.currentTime, 0.1);
      return;
    }
    const ctx = ensure();
    if (!ctx) return;
    if (!sirenOsc) {
      sirenOsc = ctx.createOscillator();
      sirenOsc.type = 'triangle';
      sirenGain = ctx.createGain();
      sirenGain.gain.value = 0;
      sirenOsc.connect(sirenGain);
      sirenGain.connect(ctx.destination);
      sirenOsc.start();
      let high = false;
      setInterval(() => {
        if (!sirenOsc) return;
        high = !high;
        sirenOsc.frequency.setTargetAtTime(high ? 880 : 660, ctx.currentTime, 0.05);
      }, 420);
    }
    sirenGain.gain.setTargetAtTime(0.045, ctx.currentTime, 0.1);
  }

  // A lazy loop: warm pad chords with a walking bass, one bar at a time.
  const CHORDS = [
    [130.81, 164.81, 196.0],
    [110.0, 164.81, 196.0],
    [98.0, 146.83, 196.0],
    [123.47, 164.81, 196.0],
  ];

  function startMusic() {
    if (musicTimer || muted) return;
    const ctx = ensure();
    if (!ctx) return;
    musicTimer = setInterval(() => {
      if (muted || !ctx) return;
      const chord = CHORDS[musicStep % CHORDS.length];
      musicStep += 1;
      chord.forEach((freq) => tone(freq, 1.9, 'triangle', 0.045));
      tone(chord[0] / 2, 0.5, 'sine', 0.09, 0.5);
      tone(chord[0] / 2, 0.5, 'sine', 0.09, 1.5);
    }, 2000);
  }

  return {
    unlock, setMuted, isMuted, shot, punch, pickup, cash, missionDone,
    missionFail, busted, crash, engine, engineOff, siren, startMusic,
  };
}
