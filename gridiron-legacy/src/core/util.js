// Small helpers shared by the simulation and the UI.

export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const sum = (arr) => arr.reduce((a, b) => a + b, 0);
export const avg = (arr) => (arr.length ? sum(arr) / arr.length : 0);

export function fmtMoney(n) {
  const neg = n < 0;
  const a = Math.abs(n);
  let s;
  if (a >= 1e9) s = `$${(a / 1e9).toFixed(2)}B`;
  else if (a >= 1e6) s = `$${(a / 1e6).toFixed(a >= 1e7 ? 1 : 2)}M`;
  else if (a >= 1e4) s = `$${Math.round(a / 1e3)}K`;
  else s = `$${Math.round(a).toLocaleString('en-US')}`;
  return neg ? `-${s}` : s;
}

export function ordinal(n) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

export const deepClone = (o) => JSON.parse(JSON.stringify(o));

/** Replace {tokens} in text with values from a map. Unknown tokens stay as-is. */
export function fillTokens(text, tokens) {
  return text.replace(/\{(\w+)\}/g, (m, k) => (tokens[k] !== undefined ? tokens[k] : m));
}

export function signed(n, digits = 0) {
  const v = Number(n.toFixed(digits));
  return (v > 0 ? '+' : '') + v;
}
