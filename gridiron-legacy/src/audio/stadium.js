// Stadium atmosphere, synthesized live: a crowd bed that swells and reacts (cheers, boos, groans,
// "ooohs", chants, air horns) and short original chiptune loops for the stadium speakers.
import { audioGraph } from './sfx.js';

let bed = null; // { src, gain, filters, lfo }
let music = null; // { timer, gain, stopAt }
let musicOn = true;

export function setMusicEnabled(on) { musicOn = on; if (!on) stopMusic(); }

// ------------------------------------------------------------------ crowd bed

/** Start the crowd murmur. level 0..1 */
export function startCrowd(level = 0.3) {
  const A = audioGraph();
  if (!A || bed) { if (bed) setCrowd(level); return; }
  const { ctx, master, noiseBuf } = A;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuf;
  src.loop = true;
  const f1 = ctx.createBiquadFilter(); f1.type = 'bandpass'; f1.frequency.value = 520; f1.Q.value = 0.6;
  const f2 = ctx.createBiquadFilter(); f2.type = 'lowpass'; f2.frequency.value = 2200;
  const gain = ctx.createGain(); gain.gain.value = 0.0001;
  // slow swell so it breathes like a real crowd
  const lfo = ctx.createOscillator(); lfo.frequency.value = 0.13;
  const lfoGain = ctx.createGain(); lfoGain.gain.value = 0.03;
  lfo.connect(lfoGain).connect(gain.gain);
  src.connect(f1).connect(f2).connect(gain).connect(master);
  src.start(); lfo.start();
  bed = { src, gain, lfo, ctx, f1 };
  setCrowd(level);
}

export function setCrowd(level, ramp = 0.6) {
  if (!bed) return;
  const t = bed.ctx.currentTime;
  bed.gain.gain.cancelScheduledValues(t);
  bed.gain.gain.setTargetAtTime(Math.max(0.0001, level * 0.22), t, ramp / 3);
  bed.f1.frequency.setTargetAtTime(420 + level * 500, t, ramp / 3);
}

export function stopCrowd() {
  if (!bed) return;
  const b = bed;
  bed = null;
  const t = b.ctx.currentTime;
  b.gain.gain.setTargetAtTime(0.0001, t, 0.25);
  setTimeout(() => { try { b.src.stop(); b.lfo.stop(); } catch { /* ignore */ } }, 1200);
}

// ------------------------------------------------------------------ reactions

function burst({ dur = 1.5, vol = 0.3, freq = 1200, q = 0.5, type = 'bandpass', attack = 0.2, delay = 0, vibrato = 0 }) {
  const A = audioGraph();
  if (!A) return;
  const { ctx, master, noiseBuf } = A;
  const t = ctx.currentTime + delay;
  const s = ctx.createBufferSource();
  s.buffer = noiseBuf;
  s.loop = true;
  const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
  if (vibrato) { const l = ctx.createOscillator(); l.frequency.value = 5; const lg = ctx.createGain(); lg.gain.value = vibrato; l.connect(lg).connect(f.frequency); l.start(t); l.stop(t + dur + 0.1); }
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f).connect(g).connect(master);
  s.start(t);
  s.stop(t + dur + 0.1);
}

function tone(freq, dur, { type = 'square', vol = 0.06, delay = 0, slide = 0 } = {}) {
  const A = audioGraph();
  if (!A) return;
  const { ctx, master } = A;
  const t = ctx.currentTime + delay;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.linearRampToValueAtTime(freq + slide, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.015);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + dur + 0.05);
}

const cheer = (size = 1) => { burst({ dur: 1.2 + size * 1.2, vol: 0.18 + size * 0.2, freq: 1300, q: 0.4, attack: 0.15 }); burst({ dur: 1 + size, vol: 0.1 + size * 0.12, freq: 2800, q: 0.7, attack: 0.25 }); };
const boo = (size = 1) => burst({ dur: 1.6 + size, vol: 0.14 + size * 0.12, freq: 320, q: 3, attack: 0.35, vibrato: 25 });
const groan = () => burst({ dur: 1.4, vol: 0.16, freq: 380, q: 1.5, attack: 0.3, vibrato: 10 });
const ooh = () => { burst({ dur: 1.2, vol: 0.18, freq: 600, q: 4, attack: 0.15, vibrato: 40 }); };
const claps = (n = 8, gap = 0.5, delay = 0) => { for (let i = 0; i < n; i++) burst({ dur: 0.12, vol: 0.22, freq: 1800, q: 0.8, attack: 0.005, delay: delay + i * gap }); };
export const airHorn = () => { [233, 294, 349].forEach((f) => tone(f, 1.1, { type: 'sawtooth', vol: 0.05 })); };

/**
 * Crowd reaction. kind: td, big, good, bad, turnover, hit, sack, incomplete, snap, defense.
 * homeGood: true when the play was good for the home team (the home crowd is the loud one).
 */
export function react(kind, homeGood = true) {
  if (kind === 'snap') { setCrowd(homeGood ? 0.35 : 0.55); return; } // home crowd gets loud when the visitors have the ball
  if (kind === 'defense') { claps(6, 0.55); return; } // "DE-FENSE" clap rhythm
  const swell = (lvl) => { setCrowd(lvl, 0.2); setTimeout(() => setCrowd(0.3, 2.5), 1800); };
  switch (kind) {
    case 'td':
      if (homeGood) { cheer(1.6); airHorn(); swell(0.9); claps(10, 0.4, 1.4); } else { boo(1.2); cheer(0.3); }
      break;
    case 'big': if (homeGood) { cheer(1); swell(0.7); } else { ooh(); boo(0.5); } break;
    case 'good': if (homeGood) cheer(0.5); else groan(); break;
    case 'bad': if (homeGood) groan(); else cheer(0.6); break;
    case 'turnover': if (homeGood) { cheer(1.3); airHorn(); swell(0.85); } else { boo(1.4); } break;
    case 'hit': ooh(); if (homeGood) cheer(0.4); break;
    case 'sack': if (homeGood) { cheer(1.1); swell(0.75); } else groan(); break;
    case 'incomplete': if (homeGood) cheer(0.35); else groan(); break;
    case 'ooh': ooh(); break; // a hall full of people reacting (draft night)
    case 'applause': cheer(0.6); claps(16, 0.16); break;
    case 'roar': cheer(1.8); airHorn(); swell(0.95); claps(14, 0.35, 1.2); break;
    default: break;
  }
}

// ------------------------------------------------------------------ stadium music (original chiptune loops)

const N = (n) => 440 * Math.pow(2, (n - 69) / 12); // MIDI note -> Hz
const SONGS = {
  // Draft night: a low suspense pulse while the pick comes in, then a big brass-style fanfare.
  tension: { bpm: 84, bass: [36, 0, 36, 0, 36, 0, 37, 0], lead: [0, 0, 63, 0, 0, 0, 62, 0], drums: ['k', 0, 0, 0, 'k', 0, 0, 'h'] },
  fanfare: { bpm: 126, bass: [48, 0, 55, 0, 52, 0, 55, 0], lead: [72, 76, 79, 0, 76, 79, 84, 0], drums: ['k', 'h', 's', 'h', 'k', 'k', 's', 'h'] },
  // Stomp-stomp-clap style pump-up loop.
  hype: { bpm: 112, bass: [40, 0, 40, 0, 43, 0, 45, 0], lead: [64, 0, 67, 0, 69, 67, 64, 0], drums: ['k', 0, 'k', 's', 'k', 0, 'k', 's'] },
  // Organ "charge"-style rising riff.
  charge: { bpm: 132, bass: [36, 36, 43, 43, 48, 48, 43, 43], lead: [60, 64, 67, 72, 0, 67, 72, 0], drums: ['k', 'h', 's', 'h', 'k', 'h', 's', 'h'] },
  // Bouncy big-play groove.
  groove: { bpm: 124, bass: [41, 0, 41, 44, 46, 0, 44, 41], lead: [68, 0, 70, 72, 0, 70, 68, 65], drums: ['k', 'h', 's', 'h', 'k', 'k', 's', 'h'] },
  // Laid-back menu loop: soft bass, gentle keys, light beat.
  menu: { bpm: 92, bass: [38, 0, 0, 38, 41, 0, 43, 0], lead: [62, 0, 65, 0, 69, 0, 67, 65], drums: ['k', 0, 'h', 0, 's', 0, 'h', 'h'] },
  // Big brassy anthem for cutscenes.
  anthem: { bpm: 96, bass: [36, 36, 41, 41, 43, 43, 36, 36], lead: [60, 64, 67, 72, 71, 67, 64, 67], drums: ['k', 0, 's', 0, 'k', 'k', 's', 0] },
};

export function playMusic(name = 'hype', { vol = 1, bars = 0 } = {}) {
  if (!musicOn) return;
  stopMusic();
  const A = audioGraph();
  if (!A) return;
  const song = SONGS[name] ?? SONGS.hype;
  const step = 60 / song.bpm / 2;
  let i = 0;
  const m = { gain: vol, alive: true };
  m.name = name;
  music = m;
  const tick = () => {
    if (!m.alive) return;
    const k = i % 8;
    const b = song.bass[k];
    const l = song.lead[k];
    const d = song.drums[k];
    if (b) tone(N(b), step * 0.9, { type: 'triangle', vol: 0.07 * m.gain });
    if (l) tone(N(l + (Math.floor(i / 8) % 4 === 3 ? 2 : 0)), step * 0.7, { type: 'square', vol: 0.025 * m.gain });
    if (d === 'k') { tone(110, 0.12, { type: 'sine', vol: 0.12 * m.gain, slide: -60 }); }
    if (d === 's') burst({ dur: 0.12, vol: 0.08 * m.gain, freq: 1800, q: 0.6, attack: 0.003 });
    if (d === 'h') burst({ dur: 0.04, vol: 0.03 * m.gain, freq: 7000, q: 1, attack: 0.002 });
    i++;
    if (bars && i >= bars * 8) { stopMusic(); return; }
    m.timer = setTimeout(tick, step * 1000);
  };
  tick();
}

/** Which song is playing (null when quiet). */
export const currentSong = () => (music ? music.name ?? 'song' : null);
export function stopMusic() {
  if (!music) return;
  music.alive = false;
  clearTimeout(music.timer);
  music = null;
}
