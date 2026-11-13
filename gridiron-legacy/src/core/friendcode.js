// Friend cards <-> shareable codes and links (gzip + base64url). Works offline, no server.
export const SHARE_URL = 'https://cartparti.github.io/Gridiron-Legacy/';
const b64u = (bytes) => { let s = ''; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000)); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
const unb64u = (str) => { const s = atob(str.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((str.length + 3) % 4)); const u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return u; };

export async function encodeCard(card) {
  const raw = new TextEncoder().encode(JSON.stringify(card));
  if (typeof CompressionStream === 'function') {
    try {
      const z = new Uint8Array(await new Response(new Blob([raw]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer());
      return `GLF2.${b64u(z)}`;
    } catch { /* plain below */ }
  }
  return `GLF1.${b64u(raw)}`;
}

/** Accepts a code, or a whole link with #friend=CODE in it. Resolves the card object, or null. */
export async function decodeCard(input) {
  try {
    const m = String(input ?? '').match(/GLF[12]\.[A-Za-z0-9_-]+/);
    if (!m) return null;
    const code = m[0];
    let text;
    if (code.startsWith('GLF2.')) text = await new Response(new Blob([unb64u(code.slice(5))]).stream().pipeThrough(new DecompressionStream('gzip'))).text();
    else text = new TextDecoder().decode(unb64u(code.slice(5)));
    if (text.length > 60000) return null;
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export const shareLink = (code) => `${SHARE_URL}#friend=${code}`;
