// Save system: 3 save slots plus settings, stored in localStorage.
//
// Every storage call is wrapped in try/catch. If storage is unavailable
// (private browsing, blocked cookies, Node tests) we fall back to an
// in-memory map so the game still runs; it just won't persist.

export const SLOT_COUNT = 3;
export const SAVE_VERSION = 1;
const PREFIX = 'gridiron-legacy:';
const memory = new Map();

function storageGet(key) {
  try {
    const v = globalThis.localStorage.getItem(PREFIX + key);
    return v === null ? (memory.get(key) ?? null) : v;
  } catch {
    return memory.get(key) ?? null;
  }
}

function storageSet(key, value) {
  memory.set(key, value);
  try {
    globalThis.localStorage.setItem(PREFIX + key, value);
    return true;
  } catch {
    return false; // quota exceeded or storage blocked: memory copy still works
  }
}

function storageRemove(key) {
  memory.delete(key);
  try {
    globalThis.localStorage.removeItem(PREFIX + key);
  } catch {
    /* ignore */
  }
}

/** Short summary shown on the save slot cards, stored separately so the slot list loads fast. */
export function metaFor(state) {
  const p = state.player;
  return {
    name: `${p.first} ${p.last}`,
    position: p.position,
    age: p.age,
    stage: state.career.stage,
    year: state.career.year,
    ovr: Math.round(p.ovr ?? 0),
    teamAbbr: state.career.teamAbbr ?? '',
    savedAt: Date.now(),
  };
}

export function saveGame(slot, state) {
  try {
    const data = JSON.stringify({ version: SAVE_VERSION, state });
    const okData = storageSet(`slot${slot}`, data);
    storageSet(`slot${slot}:meta`, JSON.stringify(metaFor(state)));
    return okData;
  } catch {
    return false;
  }
}

export function loadGame(slot) {
  try {
    const raw = storageGet(`slot${slot}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return migrate(parsed);
  } catch {
    return null;
  }
}

/** Upgrade older save formats here when SAVE_VERSION changes. */
function migrate(parsed) {
  if (!parsed || typeof parsed !== 'object' || !parsed.state) return null;
  return parsed.state;
}

export function deleteSave(slot) {
  storageRemove(`slot${slot}`);
  storageRemove(`slot${slot}:meta`);
}

export function listSlots() {
  const out = [];
  for (let i = 0; i < SLOT_COUNT; i++) {
    let meta = null;
    try {
      const raw = storageGet(`slot${i}:meta`);
      meta = raw ? JSON.parse(raw) : null;
    } catch {
      meta = null;
    }
    out.push({ slot: i, empty: !meta, meta });
  }
  return out;
}

export function exportSave(slot) {
  return storageGet(`slot${slot}`);
}

// ---- backup codes: the save squeezed (gzip when the browser can) into one copy-paste line
const b64 = (bytes) => { let s = ''; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000)); return btoa(s); };
const unb64 = (str) => { const s = atob(str); const u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return u; };
/** A backup code for a slot ("GL2." = gzip, "GL1." = plain). */
export async function exportCode(slot) {
  const text = storageGet(`slot${slot}`);
  if (!text) return null;
  const raw = new TextEncoder().encode(text);
  if (typeof CompressionStream === 'function') {
    try {
      const zipped = new Uint8Array(await new Response(new Blob([raw]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer());
      return `GL2.${b64(zipped)}`;
    } catch { /* fall through */ }
  }
  return `GL1.${b64(raw)}`;
}
/** Restore a backup code (or raw save JSON) into a slot. */
export async function importCode(slot, code) {
  try {
    code = String(code ?? '').trim();
    let text = code;
    if (code.startsWith('GL2.')) text = await new Response(new Blob([unb64(code.slice(4))]).stream().pipeThrough(new DecompressionStream('gzip'))).text();
    else if (code.startsWith('GL1.')) text = new TextDecoder().decode(unb64(code.slice(4)));
    return importSave(slot, text);
  } catch {
    return false;
  }
}
/** Ask the browser not to clear our saves when space is low (installed apps usually get this). */
export function requestPersist() {
  try { navigator.storage?.persist?.(); } catch { /* ignore */ }
}

export function importSave(slot, text) {
  try {
    const parsed = JSON.parse(text);
    const state = migrate(parsed);
    if (!state || !state.player || !state.career) return false;
    return saveGame(slot, state);
  } catch {
    return false;
  }
}

const DEFAULT_SETTINGS = { theme: 'auto', sound: true, reducedMotion: false, blood: true, music: true, gameSpeed: 0.85, tutorials: true, lastSlot: null, seenTips: {} };

export function loadSettings() {
  try {
    const raw = storageGet('settings');
    return { ...DEFAULT_SETTINGS, ...(raw ? JSON.parse(raw) : {}) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(settings) {
  try {
    storageSet('settings', JSON.stringify(settings));
  } catch {
    /* ignore */
  }
}
