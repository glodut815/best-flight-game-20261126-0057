// Synthesised sound only: a WebAudio engine hum, wind, and event chimes.
// No audio files, no network. Everything starts on the first user gesture.

export function createAudio() {
  let ctx = null;
  let master = null;
  let engineOsc = null;
  let engineOsc2 = null;
  let engineGain = null;
  let engineFilter = null;
  let windSource = null;
  let windGain = null;
  let windFilter = null;
  let muted = false;
  let started = false;

  function ensure() {
    if (started) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.5;
      master.connect(ctx.destination);

      // Engine: two detuned sawtooths through a low-pass filter.
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 60;
      engineOsc2 = ctx.createOscillator();
      engineOsc2.type = 'square';
      engineOsc2.frequency.value = 30;
      engineFilter = ctx.createBiquadFilter();
      engineFilter.type = 'lowpass';
      engineFilter.frequency.value = 320;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      engineOsc.connect(engineFilter);
      engineOsc2.connect(engineFilter);
      engineFilter.connect(engineGain);
      engineGain.connect(master);
      engineOsc.start();
      engineOsc2.start();

      // Wind: looped noise through a band-pass filter.
      const len = ctx.sampleRate * 2;
      const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      windSource = ctx.createBufferSource();
      windSource.buffer = buffer;
      windSource.loop = true;
      windFilter = ctx.createBiquadFilter();
      windFilter.type = 'bandpass';
      windFilter.frequency.value = 500;
      windFilter.Q.value = 0.6;
      windGain = ctx.createGain();
      windGain.gain.value = 0;
      windSource.connect(windFilter);
      windFilter.connect(windGain);
      windGain.connect(master);
      windSource.start();
      started = true;
    } catch {
      started = false;
    }
  }

  // Continuous engine/wind levels from the flight state, called every frame.
  function update(flight) {
    if (!started || !ctx) return;
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    const t = ctx.currentTime;
    const running = flight.phase === 'flying' && flight.fuel > 0 && flight.throttle > 0.02;
    const rpm = 55 + flight.throttle * 90 + flight.speed * 0.35;
    engineOsc.frequency.setTargetAtTime(running ? rpm : 40, t, 0.08);
    engineOsc2.frequency.setTargetAtTime(running ? rpm * 0.5 : 20, t, 0.08);
    engineFilter.frequency.setTargetAtTime(240 + flight.throttle * 900, t, 0.1);
    engineGain.gain.setTargetAtTime(running ? 0.05 + flight.throttle * 0.06 : 0, t, 0.12);
    const windLevel = Math.min(0.16, (flight.speed / 95) * 0.16);
    windFilter.frequency.setTargetAtTime(400 + flight.speed * 9, t, 0.1);
    windGain.gain.setTargetAtTime(flight.phase === 'flying' ? windLevel : 0, t, 0.15);
  }

  function tone(freq, dur, type, vol, when = 0, slideTo = null) {
    if (!started || !ctx || muted) return;
    const t0 = ctx.currentTime + when;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, t0);
    gain.gain.linearRampToValueAtTime(vol, t0 + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(gain);
    gain.connect(master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  function noiseBurst(dur, vol, filterFreq) {
    if (!started || !ctx || muted) return;
    const t0 = ctx.currentTime;
    const len = Math.floor(ctx.sampleRate * dur);
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq;
    const gain = ctx.createGain();
    gain.gain.value = vol;
    src.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    src.start(t0);
  }

  // One-shot event sounds, named after what the player hears.
  function playEvent(name) {
    if (!started) return;
    switch (name) {
      case 'ring':
        tone(880, 0.16, 'sine', 0.25);
        tone(1318, 0.22, 'sine', 0.22, 0.08);
        break;
      case 'beacon':
        tone(659, 0.18, 'triangle', 0.25);
        tone(988, 0.26, 'triangle', 0.22, 0.1);
        break;
      case 'landed':
        noiseBurst(0.25, 0.3, 500);
        tone(392, 0.4, 'triangle', 0.2, 0.05);
        tone(523, 0.5, 'triangle', 0.2, 0.18);
        break;
      case 'hardlanding':
        noiseBurst(0.4, 0.45, 300);
        break;
      case 'crash':
        noiseBurst(0.9, 0.6, 220);
        tone(110, 0.8, 'sawtooth', 0.25, 0, 40);
        break;
      case 'stormhit':
        noiseBurst(0.3, 0.4, 900);
        tone(180, 0.3, 'square', 0.15, 0, 90);
        break;
      case 'complete':
        [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.35, 'triangle', 0.25, i * 0.12));
        break;
      case 'fuelout':
        tone(440, 0.3, 'square', 0.12);
        tone(330, 0.4, 'square', 0.12, 0.25);
        break;
      case 'flapsdown':
        tone(300, 0.12, 'triangle', 0.15, 0, 180);
        break;
      case 'flapsup':
        tone(180, 0.12, 'triangle', 0.15, 0, 300);
        break;
      case 'click':
        tone(700, 0.06, 'sine', 0.15);
        break;
      default:
        break;
    }
  }

  function setMuted(m) {
    muted = m;
    if (master && ctx) master.gain.setTargetAtTime(m ? 0 : 0.5, ctx.currentTime, 0.05);
  }

  return { ensure, update, playEvent, setMuted, isMuted: () => muted };
}
