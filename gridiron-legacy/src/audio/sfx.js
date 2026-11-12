// Synthesized sound effects with the Web Audio API. No audio files needed.
let ctx = null;
let master = null;
let enabled = true;
let noiseBuf = null;

export function setSoundEnabled(on) {
  enabled = on;
}

function ac() {
  if (!enabled) return null;
  try {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 1.5, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

/** Shared audio graph for other modules (stadium crowd + music). Null when sound is off. */
export function audioGraph() {
  const c = ac();
  return c ? { ctx: c, master, noiseBuf } : null;
}
export const soundOn = () => enabled;

/** Call from a user gesture once so mobile browsers allow audio. */
export function unlockAudio() {
  ac();
}

function tone(freq, dur, { type = 'sine', vol = 0.3, slide = 0, delay = 0 } = {}) {
  const c = ac();
  if (!c) return;
  const t = c.currentTime + delay;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + dur + 0.05);
}

function noise(dur, { vol = 0.3, freq = 1000, q = 1, type = 'bandpass', delay = 0, attack = 0.01 } = {}) {
  const c = ac();
  if (!c) return;
  const t = c.currentTime + delay;
  const s = c.createBufferSource();
  s.buffer = noiseBuf;
  const f = c.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  f.Q.value = q;
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f).connect(g).connect(master);
  s.start(t);
  s.stop(t + dur + 0.05);
}

export const sfx = {
  click: () => tone(660, 0.05, { type: 'triangle', vol: 0.12 }),
  select: () => { tone(520, 0.06, { type: 'triangle', vol: 0.12 }); tone(780, 0.08, { type: 'triangle', vol: 0.1, delay: 0.05 }); },
  whistle: () => { tone(2900, 0.35, { type: 'sine', vol: 0.12 }); tone(3100, 0.35, { type: 'sine', vol: 0.06 }); },
  throw: () => noise(0.35, { vol: 0.25, freq: 900, q: 0.8, attack: 0.08 }),
  catch: () => { noise(0.08, { vol: 0.5, freq: 300, q: 2 }); tone(140, 0.1, { type: 'sine', vol: 0.3 }); },
  hit: () => { noise(0.18, { vol: 0.7, freq: 180, q: 1, type: 'lowpass' }); tone(70, 0.2, { type: 'sine', vol: 0.4, slide: -30 }); },
  crack: () => { noise(0.06, { vol: 0.9, freq: 2400, q: 2, type: 'bandpass' }); setTimeout(() => noise(0.12, { vol: 0.6, freq: 900, q: 1, type: 'bandpass' }), 40); tone(55, 0.35, { type: 'sine', vol: 0.45, slide: -25 }); },
  bounce: (k = 1) => { noise(0.06, { vol: 0.25 * k, freq: 420, q: 1.5, type: 'lowpass' }); tone(120, 0.07, { type: 'sine', vol: 0.18 * k, slide: -30 }); },
  juke: () => noise(0.18, { vol: 0.25, freq: 2400, q: 3, attack: 0.02 }),
  cheer: (big = false) => {
    noise(big ? 2.2 : 1.2, { vol: big ? 0.35 : 0.2, freq: 1400, q: 0.4, attack: 0.25 });
    noise(big ? 2 : 1, { vol: big ? 0.2 : 0.1, freq: 3000, q: 0.6, attack: 0.3 });
  },
  groan: () => { noise(1, { vol: 0.15, freq: 500, q: 0.5, attack: 0.2 }); tone(220, 0.6, { type: 'sawtooth', vol: 0.03, slide: -80 }); },
  touchdown: () => {
    [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.22, { type: 'square', vol: 0.08, delay: i * 0.11 }));
    sfx.cheer(true);
  },
  cash: () => { tone(1320, 0.08, { type: 'square', vol: 0.06 }); tone(1760, 0.18, { type: 'square', vol: 0.06, delay: 0.07 }); },
  levelUp: () => [440, 554, 659, 880].forEach((f, i) => tone(f, 0.15, { type: 'triangle', vol: 0.12, delay: i * 0.07 })),
  error: () => tone(160, 0.2, { type: 'square', vol: 0.08, slide: -40 }),
  thunder: () => { noise(2.2, { vol: 0.5, freq: 90, q: 0.6, type: 'lowpass', attack: 0.05 }); noise(1.4, { vol: 0.3, freq: 160, q: 0.8, type: 'lowpass', attack: 0.3, delay: 0.25 }); },
  tick: () => tone(1200, 0.02, { type: 'square', vol: 0.04 }),
};
