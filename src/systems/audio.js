export function createAudio() {
  let ctx = null;
  let masterGain = null;
  let ambientGain = null;
  let windSource = null;
  let windFilter = null;
  let lastStepAt = 0;

  function ensureContext() {
    if (ctx) return ctx;
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return null;
    ctx = new AudioContext();
    masterGain = ctx.createGain();
    masterGain.gain.value = 0.5;
    masterGain.connect(ctx.destination);
    buildAmbient();
    return ctx;
  }

  function buildAmbient() {
    if (!ctx) return;
    const buffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) {
      data[i] = (Math.random() * 2 - 1) * 0.7;
    }
    windSource = ctx.createBufferSource();
    windSource.buffer = buffer;
    windSource.loop = true;
    windFilter = ctx.createBiquadFilter();
    windFilter.type = 'lowpass';
    windFilter.frequency.value = 400;
    ambientGain = ctx.createGain();
    ambientGain.gain.value = 0.0;
    windSource.connect(windFilter).connect(ambientGain).connect(masterGain);
    windSource.start();
  }

  function start() {
    const context = ensureContext();
    if (!context) return;
    if (context.state === 'suspended') {
      context.resume();
    }
  }

  function stop() {
    if (!ctx) return;
    ctx.suspend();
  }

  function playTone({ freq = 440, duration = 0.2, type = 'sine', gain = 0.05, rampTo = null }) {
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const amp = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    if (rampTo) {
      osc.frequency.exponentialRampToValueAtTime(rampTo, now + duration);
    }
    amp.gain.setValueAtTime(0.0001, now);
    amp.gain.linearRampToValueAtTime(gain, now + 0.02);
    amp.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.connect(amp).connect(masterGain);
    osc.start(now);
    osc.stop(now + duration + 0.05);
  }

  function playQuestChord() {
    playTone({ freq: 392, duration: 0.35, type: 'triangle', gain: 0.06 });
    playTone({ freq: 587, duration: 0.35, type: 'triangle', gain: 0.04 });
  }

  function playStep() {
    playTone({ freq: 140, duration: 0.12, type: 'triangle', gain: 0.03, rampTo: 90 });
  }

  function play(event) {
    if (!ctx) return;
    switch (event) {
      case 'lantern':
        playTone({ freq: 320, duration: 0.22, type: 'sine', gain: 0.05, rampTo: 440 });
        break;
      case 'herb':
        playTone({ freq: 660, duration: 0.18, type: 'triangle', gain: 0.04, rampTo: 520 });
        break;
      case 'door':
        playTone({ freq: 220, duration: 0.16, type: 'triangle', gain: 0.04, rampTo: 180 });
        playTone({ freq: 330, duration: 0.12, type: 'sine', gain: 0.03, rampTo: 260 });
        break;
      case 'loot':
        playTone({ freq: 520, duration: 0.14, type: 'triangle', gain: 0.04, rampTo: 740 });
        break;
      case 'sleep':
        playTone({ freq: 220, duration: 0.22, type: 'sine', gain: 0.035, rampTo: 440 });
        break;
      case 'marker':
        playTone({ freq: 260, duration: 0.28, type: 'sine', gain: 0.045, rampTo: 200 });
        break;
      case 'quest':
        playQuestChord();
        break;
      case 'deny':
        playTone({ freq: 180, duration: 0.18, type: 'sawtooth', gain: 0.04, rampTo: 120 });
        break;
      case 'playerAttack':
        playTone({ freq: 280, duration: 0.12, type: 'sawtooth', gain: 0.06, rampTo: 380 });
        break;
      case 'enemyHit':
        playTone({ freq: 200, duration: 0.1, type: 'square', gain: 0.04, rampTo: 150 });
        break;
      case 'enemyDeath':
        playTone({ freq: 340, duration: 0.25, type: 'sawtooth', gain: 0.05, rampTo: 100 });
        playTone({ freq: 240, duration: 0.3, type: 'triangle', gain: 0.03, rampTo: 80 });
        break;
      case 'death':
        playTone({ freq: 160, duration: 0.4, type: 'sawtooth', gain: 0.06, rampTo: 60 });
        playTone({ freq: 120, duration: 0.5, type: 'sine', gain: 0.04, rampTo: 40 });
        break;
      case 'levelUp':
        playTone({ freq: 392, duration: 0.15, type: 'triangle', gain: 0.06 });
        setTimeout(() => playTone({ freq: 523, duration: 0.15, type: 'triangle', gain: 0.06 }), 120);
        setTimeout(() => playTone({ freq: 659, duration: 0.2, type: 'triangle', gain: 0.07 }), 240);
        setTimeout(() => playTone({ freq: 784, duration: 0.35, type: 'triangle', gain: 0.08 }), 380);
        break;
      case 'purchase':
        playTone({ freq: 440, duration: 0.12, type: 'triangle', gain: 0.04, rampTo: 660 });
        playTone({ freq: 550, duration: 0.14, type: 'sine', gain: 0.03, rampTo: 700 });
        break;
      default:
        break;
    }
  }

  let lastBirdAt = 0;
  let lastCricketAt = 0;

  function update({ night = 0, moving = false, speed = 0, weather = 'clear' }) {
    if (!ctx || !ambientGain || !windFilter) return;
    const now = ctx.currentTime;

    // Wind ambient - louder during rain
    const weatherBoost = weather === 'rain' ? 0.04 : 0;
    const windTarget = 0.01 + night * 0.03 + weatherBoost;
    ambientGain.gain.setTargetAtTime(windTarget, now, 0.4);
    const drift = Math.sin(now * 0.15) * 80;
    windFilter.frequency.setTargetAtTime(320 + night * 220 + drift, now, 0.6);

    if (moving && speed > 0.1) {
      const interval = Math.max(0.22, 0.5 - Math.min(speed / 6, 1) * 0.2);
      if (now - lastStepAt > interval) {
        lastStepAt = now;
        playStep();
      }
    }

    // Ambient birds during the day
    if (night < 0.3 && now - lastBirdAt > 4 + Math.random() * 6) {
      lastBirdAt = now;
      const freq = 1200 + Math.random() * 800;
      playTone({ freq, duration: 0.08 + Math.random() * 0.1, type: 'sine', gain: 0.015, rampTo: freq * (0.7 + Math.random() * 0.6) });
    }

    // Ambient crickets at night
    if (night > 0.5 && now - lastCricketAt > 1.5 + Math.random() * 3) {
      lastCricketAt = now;
      playTone({ freq: 4200, duration: 0.06, type: 'sine', gain: 0.008 });
      playTone({ freq: 4400, duration: 0.06, type: 'sine', gain: 0.006 });
    }
  }

  return {
    start,
    stop,
    play,
    update
  };
}
