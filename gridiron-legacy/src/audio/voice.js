// Play-by-play voice: reads the commentary lines aloud with the device's built-in voice (optional).
let on = false;
let voice = null;
export function setVoiceEnabled(v) { on = !!v && typeof speechSynthesis !== 'undefined'; if (!on) try { speechSynthesis.cancel(); } catch { /* ignore */ } }
function pickVoice() {
  if (voice) return voice;
  try {
    const all = speechSynthesis.getVoices();
    voice = all.find((v) => /en[-_]US/i.test(v.lang) && /male|david|alex|daniel|fred|guy/i.test(v.name)) ?? all.find((v) => /^en/i.test(v.lang)) ?? null;
  } catch { voice = null; }
  return voice;
}
/** Say a line like an excited broadcaster (newer lines cut off older ones). */
export function speak(text, { hype = false } = {}) {
  if (!on || !text) return;
  try {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(String(text).replace(/[!]{2,}/g, '!'));
    const v = pickVoice(); if (v) u.voice = v;
    u.rate = hype ? 1.18 : 1.08; u.pitch = hype ? 1.1 : 0.95; u.volume = 1;
    speechSynthesis.speak(u);
  } catch { /* ignore */ }
}
